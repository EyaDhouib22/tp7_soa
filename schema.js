// schema.js
const { gql } = require('@apollo/server');

// Définir le schéma GraphQL
const typeDefs = `#graphql
  type Movie {
    id: String!
    title: String!
    description: String!
  }

  type TVShow {
    id: String!
    title: String!
    description: String!
  }

  type Query {
    movie(id: String!): Movie
    movies(query: String): [Movie] # Ajout d'un argument query optionnel
    tvShow(id: String!): TVShow
    tvShows(query: String): [TVShow] # Ajout d'un argument query optionnel
  }
   type Mutation { 
    createMovie(title: String!, description: String!): Movie
  }


`;

module.exports = typeDefs;