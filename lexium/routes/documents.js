const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { analyzeDocument } = require('../ai');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT d.id, d.nom, d.type, d.statut, d.created_at, dos.nom AS dossier_nom, dos.id AS dossier_id
     FROM documents d LEFT JOIN dossiers dos ON dos.id = d.dossier_id
     WHERE d.owner_id = $1 ORDER BY d.created_at DESC`,
    [req.session.userId]
  );
  res.json({ documents: result.rows });
});

router.get('/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM documents WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Document introuvable.' });
  res.json({ document: result.rows[0] });
});

router.post('/:id/analyze', async (req, res) => {
  const doc = await db.query('SELECT * FROM documents WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId]);
  if (!doc.rows[0]) return res.status(404).json({ error: 'Document introuvable.' });

  if (doc.rows[0].analyse_ia) {
    return res.json({ document: doc.rows[0] });
  }

  try {
    const analyse = await analyzeDocument(doc.rows[0].contenu, { nomDocument: doc.rows[0].nom });
    const updated = await db.query(
      "UPDATE documents SET analyse_ia = $1, statut = 'analyse' WHERE id = $2 RETURNING *",
      [JSON.stringify(analyse), req.params.id]
    );
    res.json({ document: updated.rows[0] });
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      return res.status(503).json({
        error: "L'analyse par IA n'est pas encore configurée sur ce serveur (clé Anthropic manquante).",
        code: 'NO_API_KEY',
      });
    }
    console.error('Erreur analyse document:', err);
    res.status(502).json({ error: "L'analyse a échoué. Réessayez dans un instant." });
  }
});

module.exports = router;
