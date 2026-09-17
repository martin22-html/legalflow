# LegalFlow AI — v1

Assistant IA pour cabinet d'avocat : analyse de documents, rédaction de
projets d'actes, recherche juridique sourcée, gestion de dossiers et
d'échéances. Version 1 fonctionnelle, à déployer sur votre propre
hébergement — indépendante de claude.ai.

## Ce qui fonctionne dans cette v1

- **Comptes cabinet** : inscription/connexion par email + mot de passe.
- **Dossiers** : création, liste, fiche dossier (client, domaine, notes).
- **Analyse de documents** : collez un texte (contrat, courrier, pièce,
  situation) → résumé, qualification juridique, délais à vérifier,
  tâches, pièces à réunir, points à vérifier.
- **Rédaction** : génère un premier projet (courrier, mise en demeure,
  note de synthèse, trame de conclusions, email) à partir du contexte
  du dossier — toujours à relire et compléter.
- **Recherche juridique** : utilise la recherche web en direct (pas de
  connaissances figées) et renvoie des sources cliquables à vérifier
  et imprimer avant de les verser aux débats.
- **Échéances** : liste par dossier, cochables.

Tout appelle réellement l'API Anthropic avec **votre propre clé** —
ça fonctionne pour n'importe qui qui ouvre le site, pas seulement dans
claude.ai.

## Lancer en local (pour tester avant de déployer)

Prérequis : Node.js 18 ou plus récent ([nodejs.org](https://nodejs.org)).

```bash
cd legalflow-ai
npm install
cp .env.example .env
```

Ouvrez `.env` et remplacez `ANTHROPIC_API_KEY` par votre propre clé,
obtenue sur [console.anthropic.com](https://console.anthropic.com)
(rubrique "API Keys" — nécessite un compte avec du crédit).

```bash
npm start
```

Puis ouvrez `http://localhost:3000` dans votre navigateur.

## Déployer en ligne (accessible à n'importe qui, hors claude.ai)

L'option la plus simple sans compétence technique particulière est
**Render** (render.com) :

1. Créez un compte sur render.com.
2. Créez un dépôt Git avec ce dossier (sur GitHub par exemple), ou
   utilisez l'option "Upload" de Render si disponible.
3. Sur Render : **New > Web Service**, connectez le dépôt.
4. Render détecte Node.js automatiquement. Renseignez :
   - Build command : `npm install`
   - Start command : `npm start`
5. Dans l'onglet **Environment**, ajoutez vos variables :
   - `ANTHROPIC_API_KEY` = votre clé
   - `SESSION_SECRET` = une longue chaîne aléatoire au choix
6. Déployez. Render vous donne une URL du type
   `https://legalflow-ai-xxxx.onrender.com` que vous pouvez transmettre
   à n'importe qui.

Railway (railway.app) fonctionne de façon très similaire si vous
préférez.

**Note sur la base de données** : la version actuelle utilise SQLite,
un fichier local — parfait pour tester et pour un usage mono-cabinet,
mais sur certains hébergeurs (dont Render en offre gratuite), le
disque n'est pas garanti persistant entre les redéploiements. Pour un
usage en production durable, il faudra migrer vers une base de
données hébergée (Postgres géré par Render/Railway, par exemple) —
une évolution à prévoir avant d'ouvrir l'outil à de vrais clients
payants.

## Ce qui n'est PAS encore fait (honnêteté avant tout)

Le cahier des charges "LegalFlow AI" que vous avez décrit prévoit
sept modules et une sécurité de niveau entreprise. Cette v1 couvre
les quatre premiers modules à forte valeur immédiate. Restent à
construire, par ordre de priorité suggéré :

**Fonctionnalités**
- Assistant email (nécessite de connecter une boîte mail via IMAP ou
  l'API Gmail/Outlook — techniquement plus lourd, à traiter à part).
- Agent autonome multi-étapes ("prépare le dossier X pour l'audience
  du...") — s'appuie sur les briques déjà en place (analyse,
  rédaction, échéances) mais demande une couche d'orchestration.
- Upload direct de fichiers PDF/Word (la v1 fonctionne par
  copier-coller de texte).

**Sécurité et conformité** — nécessaires avant tout usage avec de
vraies données clients ou une ouverture à d'autres cabinets :
- Chiffrement des données au repos (la base SQLite actuelle n'est pas
  chiffrée).
- Authentification renforcée (2FA).
- Gestion fine des droits si plusieurs utilisateurs par cabinet.
- Journalisation des actions de l'IA (audit log).
- Choix d'un hébergement avec garanties de localisation des données
  en Europe (Render/Railway proposent des régions UE — à sélectionner
  explicitement au déploiement).
- Confirmation contractuelle avec Anthropic sur la non-utilisation des
  données pour l'entraînement (couvert par les conditions standard de
  l'API Anthropic, à vérifier dans les CGU en vigueur au moment du
  lancement commercial).

Cette v1 est un socle solide et réellement fonctionnel pour valider
l'idée avec des confrères — pas encore un produit prêt pour des
données clients sensibles à grande échelle.
