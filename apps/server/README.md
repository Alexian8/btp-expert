# @btp/server

Backend HTTP de BatiDesk (Express + SQLite + JWT).

Implémente le contrat REST consommé par `ApiDataService` côté client. Permet
de basculer l'app desktop vers un mode multi-poste / web sans toucher aux
features (la couche `IDataService` est identique).

## Démarrage

```bash
cp .env.example .env
# Générer un secret JWT solide :
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
npm install
npm run dev
```

Premier démarrage : créer l'admin via le endpoint bootstrap (une seule fois,
refuse les appels suivants) :

```bash
curl -X POST http://localhost:3001/api/auth/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"votre-mot-de-passe"}'
```

## Endpoints

| Méthode | Route                       | Auth | Description                  |
|---------|-----------------------------|------|------------------------------|
| GET     | `/api/health`               | non  | Ping/version                 |
| POST    | `/api/auth/bootstrap`       | non  | Créer le 1er admin           |
| POST    | `/api/auth/login`           | non  | Login → token JWT            |
| POST    | `/api/auth/logout`          | non  | (stateless, le client jette) |
| GET     | `/api/auth/me`              | oui  | User courant                 |
| GET     | `/api/{resource}`           | oui  | Liste (filter en query)      |
| GET     | `/api/{resource}/count`     | oui  | Comptage                     |
| GET     | `/api/{resource}/:id`       | oui  | Détail                       |
| POST    | `/api/{resource}`           | oui  | Création                     |
| PATCH   | `/api/{resource}/:id`       | oui  | Mise à jour partielle        |
| DELETE  | `/api/{resource}/:id`       | oui  | Suppression                  |
| GET     | `/api/settings`             | oui  | Lire toutes les settings     |
| PATCH   | `/api/settings`             | oui  | Patch settings (JSON values) |

`{resource}` ∈ `clients`, `fournisseurs`, `chantiers` (à enrichir).

## Bascule depuis l'app desktop

Côté `apps/desktop/.env` :

```env
VITE_USE_REMOTE_API=true
VITE_API_BASE_URL=https://votre-serveur.fr
```

Le `DataServiceFactory` ([apps/desktop/src/lib/dataServiceFactory.ts](../desktop/src/lib/dataServiceFactory.ts))
détecte le flag et instancie automatiquement `ApiDataService`.

## Tests

```bash
npm test
```

Les tests utilisent SQLite en `:memory:` et `supertest` — pas de fichier `.db`
créé sur le disque.

## Architecture

- `src/config.ts` — env validé par Zod
- `src/db.ts` — connexion SQLite + migrations
- `src/auth.ts` — JWT helpers + middleware
- `src/repository.ts` — `SqliteRepository` générique (filter/sort/CRUD)
- `src/routes/crud.ts` — router REST générique
- `src/routes/auth.ts` — login / bootstrap / me
- `src/app.ts` — assemblage Express
- `src/index.ts` — point d'entrée (listen)
