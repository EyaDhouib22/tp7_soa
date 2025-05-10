// resolvers.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Charger les fichiers proto pour les films et les séries TV
const movieProtoPath = 'movie.proto';
const tvShowProtoPath = 'tvShow.proto';

const movieProtoDefinition = protoLoader.loadSync(movieProtoPath, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const tvShowProtoDefinition = protoLoader.loadSync(tvShowProtoPath, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});

const movieProto = grpc.loadPackageDefinition(movieProtoDefinition).movie;
const tvShowProto = grpc.loadPackageDefinition(tvShowProtoDefinition).tvShow;

// Clients gRPC
const movieClient = new movieProto.MovieService('localhost:50051', grpc.credentials.createInsecure());
const tvShowClient = new tvShowProto.TVShowService('localhost:50052', grpc.credentials.createInsecure());

// Définir les résolveurs pour les requêtes GraphQL
const resolvers = {
    Query: {
        movie: (_, { id }) => {
            return new Promise((resolve, reject) => {
                movieClient.getMovie({ movie_id: id }, (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response.movie);
                    }
                });
            });
        },
        movies: (_, { query }) => { // Prend en compte l'argument query
            return new Promise((resolve, reject) => {
                movieClient.searchMovies({ query: query || "" }, (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response.movies);
                    }
                });
            });
        },
        tvShow: (_, { id }) => {
            return new Promise((resolve, reject) => {
                tvShowClient.getTvshow({ tv_show_id: id }, (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response.tv_show);
                    }
                });
            });
        },
        tvShows: (_, { query }) => { // Prend en compte l'argument query
            return new Promise((resolve, reject) => {
                tvShowClient.searchTvshows({ query: query || "" }, (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response.tv_shows);
                    }
                });
            });
        },
    },
    Mutation: { 
    createMovie: (_, { title, description }) => {
      const client = new movieProto.MovieService('localhost:50051', grpc.credentials.createInsecure());
      return new Promise((resolve, reject) => {
        client.createMovie({ title, description }, (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response);
          }
        });
      });
    },
  },
};

module.exports = resolvers;