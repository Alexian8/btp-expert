# Monitoring d'erreurs avec Sentry

Sentry est câblé sur les 3 cibles de l'application :

- **Electron desktop** (main process + renderer) via `@sentry/electron`
- **Web SPA** via `@sentry/react`
- **API serveur Express** via `@sentry/node`

Si aucune DSN n'est configurée, **les SDKs sont no-op** : aucune connexion
réseau, aucun overhead.

## Mise en route (5 min)

### 1. Créer les projets Sentry

Sur [sentry.io](https://sentry.io), crée trois projets dans une même
organisation :

| Projet                 | Plateforme              | Nom suggéré           |
| ---------------------- | ----------------------- | --------------------- |
| Desktop Electron       | Electron                | `btp-expert-desktop`  |
| Web SPA                | Browser JavaScript / React | `btp-expert-web`   |
| API serveur            | Node.js (Express)       | `btp-expert-server`   |

Chaque projet te donne une **DSN** de la forme
`https://<key>@<org>.ingest.sentry.io/<project>`.

### 2. Configurer les DSN

**Desktop (Electron)** — dans `apps/desktop/.env` :

```bash
SENTRY_DSN=https://...@sentry.io/...
```

Cette DSN est lue par `electron/main.js` au démarrage. Le renderer hérite
automatiquement via IPC — pas besoin de la dupliquer.

**Web SPA** — dans `apps/web/.env` (créer à partir de
`apps/web/.env.example`) :

```bash
VITE_SENTRY_DSN=https://...@sentry.io/...
```

C'est une variable de **build-time** : il faut re-builder le bundle après
avoir changé la valeur (`npm run build -w @btp/web`).

**Serveur** — dans `apps/server/.env` :

```bash
SENTRY_DSN=https://...@sentry.io/...
```

### 3. Tester

Trigger une erreur volontaire :

- **Electron renderer** : ouvre la console du dev tools et tape
  `throw new Error("test sentry")` — l'event doit apparaître dans Sentry
  dans la minute.
- **Web** : pareil dans la console du navigateur.
- **Serveur** : `curl https://intranet.jacobhabitat-dev.fr/api/__sentry-test`
  (route à ajouter en dev si besoin) ou laisse une vraie erreur 500 sortir.

## Confidentialité

Par défaut, les SDKs sont configurés avec :

- `sendDefaultPii: false` — pas d'IP, pas de cookies par défaut
- `tracesSampleRate: 0` — pas de performance tracing (les events tracing
  comptent dans le quota)
- `beforeSend` scrub : suppression des headers `Authorization` et `Cookie`
  avant envoi

Données qui peuvent quand même partir vers Sentry :

- Stack traces (logique métier visible)
- URL de la requête (paths, query string si présent dans le throw)
- Messages d'erreur (peuvent contenir des valeurs si tu interpoles dans
  les erreurs : `throw new Error(\`Client ${email} introuvable\`)`)

Si une route manipule des données ultra-sensibles (paiement, mot de passe
clair), wrap son code avec `Sentry.withScope` et filtre toi-même avant
le throw. Ou ajoute des règles côté Sentry → Settings → Data Scrubbers.

## Coûts

Free tier Sentry : **5 000 errors/mois** et 10 000 spans (tracing) sur le
plan Developer. Largement suffisant pour un usage en boutique. Au-delà,
plan Team à ~26 €/mois.

Pour limiter le bruit :

- Garde `tracesSampleRate: 0` (errors only).
- Active **Inbound Filters** dans Sentry sur les erreurs récurrentes peu
  utiles (ResizeObserver, network offline, etc.).
- Configure des **alertes** uniquement sur les erreurs nouvelles ou en
  pic — pas sur chaque event.

## Désactiver complètement

Laisse les variables d'env vides ou supprime-les. Les SDKs détectent
l'absence de DSN et ne s'initialisent pas.

## Source maps (optionnel, plus tard)

Pour avoir des stack traces lisibles en prod, il faut uploader les source
maps après chaque build. Ça nécessite un Sentry auth token et une étape
en CI. Voir https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/
quand tu seras prêt.
