# Lexium — backend fonctionnel

## État actuel (24 septembre 2026)

Fonctionne réellement, testé avec une vraie base PostgreSQL :
- Authentification (inscription / connexion / session)
- Mes dossiers (créer, ouvrir, supprimer)
- Documents (importer un PDF ou coller du texte, lister)
- Échéances (créer, lister par dossier)
- Recherche juridique (3 sujets réels et vérifiés via Légifrance, avec liens
  officiels — voir `recherche.js` pour brancher l'API PISTE de Légifrance et
  passer à une recherche réellement en direct)

Le code est écrit mais **pas testé avec une vraie clé** (aucune clé disponible
dans l'environnement de développement) :
- Analyse de documents par IA (`ai.js` → `analyzeDocument`)
- Assistant conversationnel (`ai.js` → `chatAnswer`)

Tant qu'aucune clé n'est configurée, ces deux fonctions renvoient une erreur
503 claire côté serveur, affichée proprement dans l'interface plutôt que de
planter.

## Pour déployer sur Render

1. Pousser ce dépôt sur GitHub (dépôt vide à créer, ou dossier dans un dépôt
   existant).
2. Sur Render (le compte déjà connecté contient un espace de travail
   "My Workspace") :
   - Créer un service **PostgreSQL** (plan gratuit pour commencer). Render
     fournit automatiquement une variable `DATABASE_URL` si la base est
     "reliée" (linked) au service web.
   - Créer un **Web Service** à partir de ce dépôt :
     - Runtime : Node
     - Build command : `npm install`
     - Start command : `npm start`
     - Région : Frankfurt (hébergement en Europe)
3. Dans les variables d'environnement du service web, ajouter :
   - `ANTHROPIC_API_KEY` — votre clé, créée sur console.anthropic.com.
     **À ajouter directement dans Render, jamais dans une conversation.**
   - `SESSION_SECRET` — une longue chaîne aléatoire quelconque.
   - `NODE_ENV=production`
   - `DATABASE_URL` — normalement injectée automatiquement si la base est
     reliée au service ; sinon, la copier depuis la page de la base Postgres.

Le schéma de base de données se crée tout seul au démarrage (`db/index.js`
exécute `db/schema.sql` à chaque lancement — sans danger, `CREATE TABLE IF
NOT EXISTS`).

## Prochaines étapes suggérées

- Brancher l'API PISTE de Légifrance dans `recherche.js` pour une recherche
  juridique réellement en direct (compte gratuit sur piste.gouv.fr).
- Vérifier/formaliser le chiffrement au repos de la base et les engagements
  de la page "Sécurité" avant d'y déposer de vraies données de client.
- Ajouter une page "Mentions légales" / "Confidentialité" réelles avant toute
  diffusion publique.
