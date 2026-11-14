# Méridien

Carnet d’intention en français. Une question par jour, quelques lignes. Vanilla JS, zéro build, local-first (localStorage).

## Quoi / où

- `index.html` + `style.css` + `app.js` — l’app complète, sans framework ni étape de build.
- `api/backup.js` — fonction serverless Vercel (Node, CJS) pour la sauvegarde/restauration cloud.
- Données locales : clés `meridien.carnets`, `meridien.questions`, `meridien.pages`, `meridien.prefs` (+ `meridien.cloudKey` pour la passphrase, jamais envoyée).

## Déployer sur Vercel

1. `npm install` (installe `@vercel/blob`).
2. Pousser le repo sur GitHub, importer le projet dans Vercel.
3. Créer un store **Vercel Blob** et le lier au projet : la variable `BLOB_READ_WRITE_TOKEN` est injectée automatiquement.
4. Déployer. L’app est statique ; seule `/api/backup` tourne en serverless.

## Sauvegarde cloud et chiffrement

- Boutons dans **Statistiques → Sauvegarde cloud**.
- Le contenu (`{version: 2, carnets, questions, pages, prefs}`) est chiffré **dans le navigateur** : PBKDF2 (SHA-256, 150 000 itérations, sel aléatoire) → AES-GCM 256.
- Le sel et l’IV voyagent avec le blob (le sel n’est pas un secret) ; la passphrase ne quitte jamais l’appareil.
- Le serveur stocke et renvoie des octets opaques (`meridien-backup.json` dans Vercel Blob). Il ne voit jamais le clair.
- La passphrase est stockée en clair dans `localStorage` (`meridien.cloudKey`) sur cet appareil uniquement — choisissez-en une forte ; sans elle, la sauvegarde est illisible.
- Restauration : validation de la structure (comme l’import JSON), confirmation modale, puis remplacement local.

## Raccourcis

`1` Aujourd’hui · `2` Archive · `3` Statistiques · `4` Année · `/` Chercher · `⌘K`/`Ctrl+K` Palette · `Échap` Fermer · `⌘↵`/`Ctrl+↵` Garder la page · `E` Exporter (dans Statistiques) · `N` Nouveau carnet · `⌘⇧D` Encre de nuit.

## Données

Tout reste dans le navigateur sauf si vous cliquez « Sauvegarder dans le cloud ». Export/import JSON manuel disponible dans Statistiques (« Exporter (.json) » / « Restaurer une archive »).
