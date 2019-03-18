## Example GraphQL server
This is based on the book "Learning GraphQL".

## Trying it
You'll need a MongoDB to connect to.
Quick and carefree docker setup for local development:
```
$ docker run --name photo-share-db -p 27017:27017 -d mongo:4
```

Furthermore you'll have to provide a `.env` file with the following keys:
```
DB_HOST=mongodb://localhost:27017/photo-share
CLIENT_ID=<your-client-id>
CLIENT_SECRET=<your-client-secret>
```

Once you have the above prerequisites, just start the app:
```
$ npm start
```

Visit the [playground-url](http://localhost:4000/playground) to inspect the schema and interact with the API.
