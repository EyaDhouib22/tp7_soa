# TP7 : Microservices avec REST, GraphQL, gRPC et Kafka

**A.U. : 2024/2025**
**Matière :** SoA et Architecture Microservices
**Enseignant :** Dr. Salah Gontara
**Classe :** 4Info

## Objectif(s) du TP

Ce travail pratique vise à mettre en œuvre une architecture de microservices complète et moderne. Les principaux objectifs sont :

*   Créer deux microservices distincts (Films et Séries TV) communiquant via gRPC.
*   Mettre en place une API Gateway servant de point d'entrée unique pour les clients, exposant des endpoints RESTful et une interface GraphQL.
*   Intégrer Apache Kafka pour une communication asynchrone et fiable entre les microservices, et potentiellement avec l'API Gateway.

## Architecture Globale

Le système sera composé des éléments suivants :

1.  **Microservice Films :** Responsable de la gestion des données relatives aux films. Il expose ses fonctionnalités via une interface gRPC.
2.  **Microservice Séries TV :** Responsable de la gestion des données relatives aux séries TV. Il expose également ses fonctionnalités via une interface gRPC.
3.  **API Gateway :** Point d'entrée central pour toutes les requêtes clientes. Elle communique avec les microservices Films et Séries TV en utilisant gRPC. Elle expose :
    *   Des endpoints RESTful pour les opérations CRUD de base.
    *   Une interface GraphQL pour des requêtes de données flexibles et précises.
4.  **Apache Kafka :** Utilisé comme bus de messages pour la communication asynchrone. Les microservices peuvent produire des événements (ex: création d'un film) et consommer des événements pour la synchronisation ou d'autres logiques métier.

## Outils et Technologies Utilisés

*   **Node.js :** Environnement d'exécution JavaScript côté serveur.
*   **Express.js :** Framework web pour Node.js, utilisé pour l'API Gateway (REST).
*   **Apollo Server :** Serveur GraphQL pour Node.js, intégré à l'API Gateway.
*   **gRPC :** Framework RPC haute performance pour la communication inter-services.
    *   `@grpc/grpc-js`
    *   `@grpc/proto-loader`
*   **Protocol Buffers (Protobuf) :** Mécanisme de sérialisation de données structurées, utilisé avec gRPC.
*   **Apache Kafka :** Plateforme de streaming d'événements distribuée.
    *   `kafkajs` (client Kafka pour Node.js)
*   **Autres :** `body-parser`, `cors`.

## Étapes de Réalisation du TP

Le TP est divisé en plusieurs étapes séquentielles pour construire progressivement l'architecture :

1.  **Mise en place des microservices :**
    *   Définition des schémas Protobuf (`.proto`) pour les films et les séries TV.
    *   Création des serveurs gRPC pour le microservice Films et le microservice Séries TV.
2.  **Configuration de l'API Gateway :**
    *   Mise en place d'un serveur Express.
    *   Intégration d'Apollo Server pour GraphQL.
    *   Implémentation des endpoints REST.
    *   Connexion aux microservices via des clients gRPC.
3.  **Définition du schéma GraphQL :**
    *   Spécification des types (`Movie`, `TVShow`), des requêtes (`Query`) et des mutations (`Mutation`).
4.  **Implémentation des resolvers GraphQL :**
    *   Logique pour récupérer les données des microservices via gRPC en réponse aux requêtes GraphQL.
5.  **Intégration de Kafka :**
    *   Configuration de Zookeeper et Kafka.
    *   Création des topics Kafka (`movies_topic`, `tvshows_topic`).
    *   Implémentation de la logique de producteur dans les microservices (et/ou l'API Gateway) pour envoyer des messages lors d'événements (ex: création/mise à jour).
    *   Implémentation de la logique de consommateur dans les microservices pour réagir aux messages Kafka (ex: synchronisation de données).
6.  **Tests et Améliorations :**
    *   Test des endpoints REST et des requêtes GraphQL.
    *   Ajout d'opérations de création (CRUD) via REST, GraphQL et gRPC.
    *   Optionnel : Connexion à une base de données persistante (ex: MongoDB, PostgreSQL) au lieu de données en mémoire.

## Structure du Projet (Suggestion)

Il est recommandé d'organiser les fichiers de manière logique pour faciliter la gestion et la compréhension du projet. Par exemple, un dossier principal `tp-microservices` contenant tous les fichiers JavaScript, les fichiers `.proto`, et le `package.json`.

## Démarrage des Services

L'ordre de démarrage des composants est important :

1.  **Zookeeper** (via WSL2 ou une installation native si disponible/préférée)
2.  **Serveur Kafka** (via WSL2 ou une installation native)
3.  **Microservice Films** (`node movieMicroservice.js`)
4.  **Microservice Séries TV** (`node tvShowMicroservice.js`)
5.  **API Gateway** (`node apiGateway.js`)
