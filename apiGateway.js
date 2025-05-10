// apiGateway.js
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const cors = require('cors');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');

// --- Configuration ---
const MOVIE_SERVICE_GRPC_TARGET = 'localhost:50051';
// const TVSHOW_SERVICE_GRPC_TARGET = 'localhost:50052'; // Si vous l'implémentez
const KAFKA_BROKERS = ['localhost:9092'];
const KAFKA_CLIENT_ID = 'api-gateway';
const MOVIE_TOPIC = 'movies_topic'; // Le gateway pourrait publier sur le même topic ou un topic d'audit
const GATEWAY_PORT = 3000;

// --- Charger les fichiers proto ---
const movieProtoPath = 'movie.proto';
const tvShowProtoPath = 'tvShow.proto'; // Assurez-vous qu'il existe

const movieProtoDefinition = protoLoader.loadSync(movieProtoPath, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const tvShowProtoDefinition = protoLoader.loadSync(tvShowProtoPath, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});

const moviePackage = grpc.loadPackageDefinition(movieProtoDefinition).movie;
// const tvShowPackage = grpc.loadPackageDefinition(tvShowProtoDefinition).tvShow;

// --- Clients gRPC ---
const movieClient = new moviePackage.MovieService(MOVIE_SERVICE_GRPC_TARGET, grpc.credentials.createInsecure());
// const tvShowClient = new tvShowPackage.TVShowService(TVSHOW_SERVICE_GRPC_TARGET, grpc.credentials.createInsecure());

// --- Schéma et Résolveurs GraphQL ---
const typeDefs = require('./schema'); // Assurez-vous que ce fichier est correct
const resolvers = require('./resolvers'); // Assurez-vous que ce fichier est correct

// --- Configuration Kafka pour API Gateway ---
const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS
});
const gatewayProducer = kafka.producer();

const sendGatewayKafkaMessage = async (topic, messagePayload) => {
  try {
    await gatewayProducer.send({
      topic,
      messages: [{ value: JSON.stringify(messagePayload) }],
    });
    console.log(`[APIGateway Kafka Producer] Message envoyé à ${topic}:`, messagePayload);
  } catch (error) {
    console.error(`[APIGateway Kafka Producer] Erreur d'envoi à ${topic}:`, error);
  }
};

// --- Application Express et Apollo Server ---
const app = express();
app.use(cors());
app.use(bodyParser.json());

const apolloServer = new ApolloServer({ typeDefs, resolvers });

async function startApiGateway() {
    try {
        // Kafka Producer pour le Gateway
        await gatewayProducer.connect();
        console.log('[APIGateway Kafka Producer] Connecté');

        // Apollo Server
        await apolloServer.start();
        app.use('/graphql', cors(), bodyParser.json(), expressMiddleware(apolloServer, {
            context: async ({ req }) => ({ token: req.headers.token }), // Exemple de contexte
        }));
        console.log(`[APIGateway] GraphQL disponible sur http://localhost:${GATEWAY_PORT}/graphql`);

        // --- Endpoints RESTful ---
        app.get('/movies', (req, res) => {
            movieClient.searchMovies({ query: req.query.q || "" }, (err, response) => {
                if (err) {
                    console.error("[APIGateway GET /movies] Error:", err);
                    res.status(500).send({ error: err.details || "Internal server error" });
                } else {
                    res.json(response.movies || []);
                }
            });
        });

        app.get('/movies/:id', (req, res) => {
            const id = req.params.id;
            movieClient.getMovie({ movie_id: id }, (err, response) => {
                if (err) {
                    console.error(`[APIGateway GET /movies/${id}] Error:`, err);
                    if (err.code === grpc.status.NOT_FOUND) {
                        res.status(404).send({ error: err.details || "Movie not found" });
                    } else {
                        res.status(500).send({ error: err.details || "Internal server error" });
                    }
                } else {
                    res.json(response.movie);
                }
            });
        });

        app.post('/movies', (req, res) => { // Pas besoin d'async ici si le callback gère l'asynchronie
            const { title, description } = req.body;
            if (!title || !description) {
                return res.status(400).send({ error: 'Title and description are required' });
            }
            
            movieClient.createMovie({ title, description }, async (err, movie) => { // Le callback peut être async pour await Kafka
                if (err) {
                    console.error("[APIGateway POST /movies] Error creating movie via gRPC:", err);
                    // Envoyer un message Kafka d'échec depuis le gateway si pertinent
                    await sendGatewayKafkaMessage(MOVIE_TOPIC, { type: 'GATEWAY_MOVIE_CREATION_FAILED', error: err.details, requestData: {title, description} });
                    res.status(500).send({ error: err.details || "Failed to create movie" });
                } else {
                    // Message Kafka du Gateway après succès de l'appel gRPC et création du film par le microservice.
                    // Le microservice film aura déjà publié MOVIE_CREATED.
                    // Cette publication est spécifique au Gateway (ex: audit, event de gateway).
                    await sendGatewayKafkaMessage(MOVIE_TOPIC, { type: 'GATEWAY_MOVIE_CREATION_REQUEST_PROCESSED', data: movie });
                    res.status(201).json(movie);
                }
            });
        });

        // Ajoutez les endpoints pour TV Shows ici de manière similaire

        // Démarrer l'application Express
        app.listen(GATEWAY_PORT, () => {
            console.log(`[APIGateway] Serveur REST & GraphQL en cours d'exécution sur le port ${GATEWAY_PORT}`);
        });

    } catch (error) {
        console.error("[APIGateway] Erreur au démarrage:", error);
        process.exit(1);
    }
}

startApiGateway();

// --- Gestion de l'arrêt propre ---
const gracefulGatewayShutdown = async () => {
    console.log("[APIGateway] Arrêt en cours...");
    try {
        await gatewayProducer.disconnect();
        console.log("[APIGateway Kafka Producer] Déconnecté");
        await apolloServer.stop(); // Arrêter Apollo Server
        console.log("[APIGateway] Apollo Server arrêté");
    } catch (err) {
        console.error("[APIGateway] Erreur lors de la déconnexion:", err);
    }
    process.exit(0);
};

process.on('SIGINT', gracefulGatewayShutdown);
process.on('SIGTERM', gracefulGatewayShutdown);