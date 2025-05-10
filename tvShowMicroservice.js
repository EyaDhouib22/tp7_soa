// tvShowMicroservice.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Charger le fichier tvShow.proto
const tvShowProtoPath = 'tvShow.proto'; // Assurez-vous que ce chemin est correct
const tvShowProtoDefinition = protoLoader.loadSync(tvShowProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const tvShowProto = grpc.loadPackageDefinition(tvShowProtoDefinition).tvShow;

// Simuler une base de données de séries TV
const tvShowsDB = [
    { id: '1', title: 'Breaking Bad', description: 'A chemistry teacher turned drug kingpin.' },
    { id: '2', title: 'Game of Thrones', description: 'Noble families vie for control of Westeros.' },
];

// Implémenter le service de séries TV
const tvShowService = {
    getTvshow: (call, callback) => { // Nommé selon le .proto du TP
        const tv_show = tvShowsDB.find(s => s.id === call.request.tv_show_id);
        if (tv_show) {
            callback(null, { tv_show });
        } else {
            callback({
                code: grpc.status.NOT_FOUND,
                details: "TV Show not found"
            });
        }
    },
    searchTvshows: (call, callback) => { // Nommé selon le .proto du TP
        const { query } = call.request;
        let foundTVShows = tvShowsDB;
        if (query) {
            foundTVShows = tvShowsDB.filter(s => s.title.toLowerCase().includes(query.toLowerCase()));
        }
        callback(null, { tv_shows: foundTVShows });
    },
    // Ajouter d'autres méthodes au besoin
};

// Créer et démarrer le serveur gRPC
const server = new grpc.Server();
server.addService(tvShowProto.TVShowService.service, tvShowService);
const port = 50052;
server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error('Échec de la liaison du serveur (séries TV):', err);
        return;
    }
    console.log(`Microservice de séries TV s'exécute sur le port ${port}`);
    server.start();
});
console.log(`Microservice de séries TV en cours d'exécution sur le port ${port}`);