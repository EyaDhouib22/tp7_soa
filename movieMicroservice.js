// movieMicroservice.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const mongoose = require('mongoose');
const { Kafka } = require('kafkajs');

// --- Configuration ---
const MONGODB_URI = 'mongodb://localhost:27017/movies_db';
const KAFKA_BROKERS = ['localhost:9092'];
const KAFKA_CLIENT_ID_PREFIX = 'movie-service';
const MOVIE_TOPIC = 'movies_topic';
const GRPC_PORT = 50051;

// --- Charger le fichier movie.proto ---
const movieProtoPath = 'movie.proto';
const movieProtoDefinition = protoLoader.loadSync(movieProtoPath, {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const movieProto = grpc.loadPackageDefinition(movieProtoDefinition).movie;

// --- Connexion MongoDB et Schéma ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log('[MovieService] MongoDB connecté'))
    .catch(err => {
        console.error('[MovieService] Erreur de connexion MongoDB:', err);
        process.exit(1);
    });

const movieSchema = new mongoose.Schema({
    title: String,
    description: String,
}, {
    timestamps: true, // Ajoute createdAt et updatedAt
    toJSON: { virtuals: true }, // Assure que les virtuels sont inclus dans toJSON
    toObject: { virtuals: true } // Assure que les virtuels sont inclus dans toObject
});

movieSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

const MovieModel = mongoose.model('Movie', movieSchema);

// --- Configuration Kafka ---
const kafka = new Kafka({
  clientId: `${KAFKA_CLIENT_ID_PREFIX}-producer-consumer`,
  brokers: KAFKA_BROKERS
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: `${KAFKA_CLIENT_ID_PREFIX}-group` });

const sendMessage = async (topic, messagePayload) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(messagePayload) }],
    });
    console.log(`[MovieService Kafka Producer] Message envoyé à ${topic}:`, messagePayload);
  } catch (error) {
    console.error(`[MovieService Kafka Producer] Erreur d'envoi à ${topic}:`, error);
  }
};

// --- Implémentation du service gRPC ---
const movieService = {
    getMovie: async (call, callback) => {
        try {
            const movie = await MovieModel.findById(call.request.movie_id).exec();
            if (movie) {
                callback(null, { movie: movie.toObject() });
            } else {
                callback({ code: grpc.status.NOT_FOUND, message: 'Movie not found' });
            }
        } catch (err) {
            console.error("[MovieService gRPC getMovie] Error:", err);
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    searchMovies: async (call, callback) => {
        try {
            const { query } = call.request;
            let filter = {};
            if (query) {
                filter = { 
                    $or: [
                        { title: { $regex: query, $options: 'i' } },
                        { description: { $regex: query, $options: 'i' } }
                    ]
                };
            }
            const movies = await MovieModel.find(filter).sort({ createdAt: -1 }).exec();
            callback(null, { movies: movies.map(m => m.toObject()) });
        } catch (err) {
            console.error("[MovieService gRPC searchMovies] Error:", err);
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    createMovie: async (call, callback) => {
        try {
            const { title, description } = call.request;
            const newMovie = new MovieModel({ title, description });
            const savedMovie = await newMovie.save();
            const movieObject = savedMovie.toObject();
            
            console.log("[MovieService gRPC createMovie] Movie created in DB:", movieObject);
            await sendMessage(MOVIE_TOPIC, { type: 'MOVIE_CREATED', data: movieObject });
            
            callback(null, movieObject); // Le proto attend un Movie directement
        } catch (err) {
            console.error("[MovieService gRPC createMovie] Error:", err);
            await sendMessage(MOVIE_TOPIC, { type: 'MOVIE_CREATION_FAILED', error: err.message, request: call.request });
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    }
    // Implémentez updateMovie et deleteMovie ici, avec publication Kafka
};

// --- Démarrage du serveur gRPC et des clients Kafka ---
async function startMovieMicroservice() {
    try {
        // Kafka Producer
        await producer.connect();
        console.log('[MovieService Kafka Producer] Connecté');

        // Kafka Consumer
        await consumer.connect();
        console.log('[MovieService Kafka Consumer] Connecté');
        await consumer.subscribe({ topic: MOVIE_TOPIC, fromBeginning: true });
        // Pourrait s'abonner à d'autres topics (ex: tvshows_topic pour des events)
        // await consumer.subscribe({ topic: 'tvshows_events_topic', fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = JSON.parse(message.value.toString());
                console.log(`[MovieService Kafka Consumer] Message reçu de ${topic}:`, {
                    partition,
                    offset: message.offset,
                    type: event.type,
                    data: event.data,
                    error: event.error
                });
                // Logique de traitement des messages (si ce service doit réagir à des événements)
                // Par exemple, si un film est mis à jour par un autre service et qu'on doit invalider un cache local.
            },
        });

        // gRPC Server
        const server = new grpc.Server();
        server.addService(movieProto.MovieService.service, movieService);
        server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
            if (err) {
                console.error('[MovieService gRPC] Échec de la liaison du serveur:', err);
                process.exit(1);
            }
            console.log(`[MovieService gRPC] Serveur s'exécute sur le port ${boundPort}`);
            server.start();
        });

    } catch (error) {
        console.error("[MovieService] Erreur au démarrage:", error);
        process.exit(1);
    }
}

startMovieMicroservice();

// --- Gestion de l'arrêt propre ---
const gracefulShutdown = async () => {
    console.log("[MovieService] Arrêt en cours...");
    try {
        // Arrêter le serveur gRPC n'est pas direct, il se ferme avec le process.
        // On se concentre sur la déconnexion des clients externes.
        await producer.disconnect();
        console.log("[MovieService Kafka Producer] Déconnecté");
        await consumer.disconnect();
        console.log("[MovieService Kafka Consumer] Déconnecté");
        await mongoose.disconnect();
        console.log("[MovieService] MongoDB déconnecté");
    } catch (err) {
        console.error("[MovieService] Erreur lors de la déconnexion:", err);
    }
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);