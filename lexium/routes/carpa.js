const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const TYPES = ['reception', 'honoraires', 'reversement', 'autre'];

// Signe conventionnel pour le calcul du solde : ce qui reste dû au client.
// reception (+) augmente ce qui est détenu pour le client ; honoraires et
// reversement (-) le diminuent.
function signe(type) {
  return type === 'reception' ? 1 : -1;
}

router.get('/recap', async (req, res) => {
  const dossiers = await db.query('SELECT id, nom, statut FROM dossiers WHERE owner_id = $1', [req.session.userId]);
  const mouvements = await db.query('SELECT * FROM mouvements_carpa WHERE owner_id = $1', [req.session.userId]);
  const byDossier = {};
  mouvements.rows.forEach((m) => {
    if (!byDossier[m.dossier_id]) byDossier[m.dossier_id] = { solde: 0, nb: 0, dernier: null };
    byDossier[m.dossier_id].solde += signe(m.type) * Number(m.montant);
    byDossier[m.dossier_id].nb += 1;
    const d = m.date_mouvement;
    if (!byDossier[m.dossier_id].dernier || d > byDossier[m.dossier_id].dernier) byDossier[m.dossier_id].dernier = d;
  });
  const recap = dossiers.rows
    .filter((d) => byDossier[d.id])
    .map((d) => ({
      dossier_id: d.id,
      dossier_nom: d.nom,
      statut: d.statut,
      solde: Math.round(byDossier[d.id].solde * 100) / 100,
      nb_mouvements: byDossier[d.id].nb,
      dernier_mouvement: byDossier[d.id].dernier,
    }))
    .sort((a, b) => Math.abs(b.solde) - Math.abs(a.solde));
  const total = Math.round(recap.reduce((acc, r) => acc + r.solde, 0) * 100) / 100;
  res.json({ dossiers: recap, total });
});

router.get('/', async (req, res) => {
  if (!req.query.dossier_id) return res.status(400).json({ error: 'dossier_id requis.' });
  const dossier = await db.query('SELECT id FROM dossiers WHERE id = $1 AND owner_id = $2', [req.query.dossier_id, req.session.userId]);
  if (!dossier.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });

  const result = await db.query(
    'SELECT * FROM mouvements_carpa WHERE dossier_id = $1 AND owner_id = $2 ORDER BY date_mouvement ASC, id ASC',
    [req.query.dossier_id, req.session.userId]
  );
  const solde = result.rows.reduce((acc, m) => acc + signe(m.type) * Number(m.montant), 0);
  res.json({ mouvements: result.rows, solde: Math.round(solde * 100) / 100 });
});

router.post('/', async (req, res) => {
  const { dossier_id, type, montant, date_mouvement, provenance_destinataire, reference, note } = req.body || {};
  if (!dossier_id || !type || !montant || !date_mouvement) {
    return res.status(400).json({ error: 'dossier_id, type, montant et date_mouvement sont requis.' });
  }
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'Type de mouvement invalide.' });
  if (isNaN(Number(montant)) || Number(montant) <= 0) return res.status(400).json({ error: 'Montant invalide.' });

  const dossier = await db.query('SELECT id FROM dossiers WHERE id = $1 AND owner_id = $2', [dossier_id, req.session.userId]);
  if (!dossier.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });

  const result = await db.query(
    `INSERT INTO mouvements_carpa (owner_id, dossier_id, type, montant, date_mouvement, provenance_destinataire, reference, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.session.userId, dossier_id, type, montant, date_mouvement, provenance_destinataire || null, reference || null, note || null]
  );
  res.status(201).json({ mouvement: result.rows[0] });
});

router.delete('/:id', async (req, res) => {
  const result = await db.query('DELETE FROM mouvements_carpa WHERE id = $1 AND owner_id = $2 RETURNING id', [req.params.id, req.session.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Mouvement introuvable.' });
  res.json({ ok: true });
});

module.exports = router;
