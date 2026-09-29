require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const cors = require('cors');

const db = require('./db');

const app = express();
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(
  cookieSession({
    name: 'lexium_session',
    keys: [process.env.SESSION_SECRET || 'dev-secret-change-me'],
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/dossiers', require('./routes/dossiers'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/echeances', require('./routes/echeances'));
app.use('/api/carpa', require('./routes/carpa'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/recherche', require('./routes/recherche'));

app.get('/api/health', (req, res) => res.json({ ok: true, ia_configuree: !!process.env.ANTHROPIC_API_KEY }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route inconnue.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware d'erreurs générique (ex: fichier trop volumineux via multer)
app.use((err, req, res, next) => {
  console.error(err);
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux (15 Mo maximum).' });
  }
  res.status(500).json({ error: 'Erreur serveur.' });
});

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`Lexium backend démarré sur le port ${PORT}`));
  })
  .catch((err) => {
    console.error('Échec d\'initialisation de la base de données :', err);
    process.exit(1);
  });
