const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT e.*, d.nom AS dossier_nom FROM echeances e
     JOIN dossiers d ON d.id = e.dossier_id
     WHERE e.owner_id = $1 ORDER BY e.date_echeance ASC`,
    [req.session.userId]
  );
  res.json({ echeances: result.rows });
});

router.post('/', async (req, res) => {
  const { dossier_id, titre, date_echeance, source } = req.body || {};
  if (!dossier_id || !titre || !date_echeance) {
    return res.status(400).json({ error: 'dossier_id, titre et date_echeance sont requis.' });
  }
  const dossier = await db.query('SELECT id FROM dossiers WHERE id = $1 AND owner_id = $2', [dossier_id, req.session.userId]);
  if (!dossier.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });

  const result = await db.query(
    'INSERT INTO echeances (owner_id, dossier_id, titre, date_echeance, source) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.session.userId, dossier_id, titre, date_echeance, source || null]
  );
  res.status(201).json({ echeance: result.rows[0] });
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM echeances WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

module.exports = router;
