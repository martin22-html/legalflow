const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { chatAnswer } = require('../ai');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const params = [req.session.userId];
  let sql = 'SELECT * FROM messages WHERE owner_id = $1';
  if (req.query.dossier_id) {
    sql += ' AND dossier_id = $2';
    params.push(req.query.dossier_id);
  }
  sql += ' ORDER BY created_at ASC LIMIT 100';
  const result = await db.query(sql, params);
  res.json({ messages: result.rows });
});

router.post('/', async (req, res) => {
  const { message, dossier_id } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message vide.' });

  const params = [req.session.userId];
  let sql = `SELECT d.nom, d.contenu, dos.nom AS dossier
             FROM documents d LEFT JOIN dossiers dos ON dos.id = d.dossier_id
             WHERE d.owner_id = $1 AND d.contenu IS NOT NULL AND d.contenu <> ''`;
  if (dossier_id) {
    sql += ' AND d.dossier_id = $2';
    params.push(dossier_id);
  }
  sql += ' ORDER BY d.created_at DESC LIMIT 8';
  const docs = await db.query(sql, params);

  await db.query(
    'INSERT INTO messages (owner_id, dossier_id, role, contenu) VALUES ($1,$2,$3,$4)',
    [req.session.userId, dossier_id || null, 'user', message]
  );

  try {
    const reponse = await chatAnswer(message, docs.rows.map((r) => ({ nom: r.nom, contenu: r.contenu, dossier: r.dossier })));
    await db.query(
      'INSERT INTO messages (owner_id, dossier_id, role, contenu) VALUES ($1,$2,$3,$4)',
      [req.session.userId, dossier_id || null, 'assistant', reponse]
    );
    res.json({ reponse, documents_consultes: docs.rows.map((r) => r.nom) });
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      return res.status(503).json({
        error: "L'assistant n'est pas encore configuré sur ce serveur (clé Anthropic manquante).",
        code: 'NO_API_KEY',
      });
    }
    console.error('Erreur chat:', err);
    res.status(502).json({ error: "La réponse a échoué. Réessayez dans un instant." });
  }
});

module.exports = router;
