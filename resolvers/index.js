const { GraphQLScalarType } = require('graphql')
const { authorizeWithGithub } = require('../lib')
const fetch = require('node-fetch')
const ObjectID = require('mongodb').ObjectID

const resolvers = {
  Query: {
    me: (parent, args, { currentUser }) => currentUser,

    totalPhotos: (parent, args, { db }) =>
      db.collection('photos')
        .estimatedDocumentCount(),

    allPhotos: (parent, args, { db }) =>
      db.collection('photos')
        .find()
        .toArray(),

    totalUsers: (parent, args, { db }) =>
      db.collection('users')
        .estimatedDocumentCount(),

    allUsers: (parent, args, { db }) =>
      db.collection('users')
        .find()
        .toArray()
  },
  Mutation: {
    async postPhoto(parent, args, { db, currentUser, pubsub }) {
      if (!currentUser) {
        throw new Error('only an authorized user can post a photo')
      }

      var newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date()
      }
      const { insertedId } = await db.collection('photos').insertOne(newPhoto)
      newPhoto.id = insertedId

      pubsub.publish('photo-added', { newPhoto })

      return newPhoto
    },

    async tagPhoto(parent, args, { db, currentUser }) {
      if (!currentUser) {
        throw new Error('only an authorized user can tag a photo')
      }

      var newTag = {
        photoID: args.photoID,
        userID: args.githubLogin
      }
      await db.collection('tags').insertOne(newTag)
      return await db.collection('photos').findOne({ _id: ObjectID(args.photoID) })
    },

    async githubAuth(parent, { code }, { db }) {

      let {
        message,
        access_token,
        avatar_url,
        login,
        name
      } = await authorizeWithGithub({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code
      })

      if (message) {
        throw new Error(message)
      }

      let latestUserInfo = {
        name,
        githubLogin: login,
        githubToken: access_token,
        avatar: avatar_url
      }

      const { ops: [user] } = await db
        .collection('users')
        .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true })

      return { user, token: access_token }

    },

    addFakeUsers: async (parent, { count }, { db }) => {
      var randomUserApi = `https://randomuser.me/api/?results=${count}`

      var { results } = await fetch(randomUserApi).then(res => res.json())

      var users = results.map(r => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1
      }))

      await db.collection('users').insertMany(users)

      return users
    },

    async fakeUserAuth(parent, { githubLogin }, { db }) {
      var user = await db.collection('users').findOne({ githubLogin })

      if (!user) {
        throw new Error(`Cannot find user with githubLogin "${githubLogin}"`)
      }

      return {
        token: user.githubToken,
        user
      }
    }
  },
  Subscription: {
    newPhoto: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator('photo-added')
    }
  },
  Photo: {
    id: parent => parent.id || parent._id,
    url: parent => `/img/photos/${parent._id}.jpq`,
    postedBy: (parent, args, { db }) =>
      db.collection('users').findOne({ githubLogin: parent.userID }),
    taggedUsers: (parent, args, { db }) =>
      db.collection('tags').find({ photoID: parent._id.toString() })
        .map(tag => tag.userID)
        .map(userID =>
          db.collection('users').findOne({ githubLogin: userID })
        )
        .toArray()
  },
  User: {
    postedPhotos: (parent, args, { db }) =>
      db.collection('photos').find({ userID: parent.githubLogin }).toArray(),
    inPhotos: (parent, args, { db }) =>
      db.collection('tags').find({ userID: parent.githubLogin })
        .map(tag => tag.photoID)
        .map(photoID =>
          db.collection('photos').findOne({ _id: ObjectID(photoID) })
        )
        .toArray()
  },
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'A valid date time value',
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  })
}

module.exports = resolvers
