const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT d.*,
       (SELECT count(*) FROM documents doc WHERE doc.dossier_id = d.id) AS nb_documents,
       (SELECT count(*) FROM echeances e WHERE e.dossier_id = d.id AND e.date_echeance >= CURRENT_DATE) AS nb_echeances
     FROM dossiers d WHERE d.owner_id = $1 ORDER BY d.updated_at DESC`,
    [req.session.userId]
  );
  res.json({ dossiers: result.rows });
});

router.post('/', async (req, res) => {
  const { nom, nature } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'Le nom du dossier est requis.' });
  const result = await db.query(
    'INSERT INTO dossiers (owner_id, nom, nature) VALUES ($1,$2,$3) RETURNING *',
    [req.session.userId, nom, nature || null]
  );
  res.status(201).json({ dossier: result.rows[0] });
});

router.get('/:id', async (req, res) => {
  const dossier = await db.query('SELECT * FROM dossiers WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId]);
  if (!dossier.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });
  const documents = await db.query(
    'SELECT id, nom, type, statut, created_at FROM documents WHERE dossier_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  const echeances = await db.query(
    'SELECT * FROM echeances WHERE dossier_id = $1 ORDER BY date_echeance ASC',
    [req.params.id]
  );
  res.json({ dossier: dossier.rows[0], documents: documents.rows, echeances: echeances.rows });
});

router.patch('/:id', async (req, res) => {
  const { nom, nature, statut } = req.body || {};
  const result = await db.query(
    `UPDATE dossiers SET nom = COALESCE($1,nom), nature = COALESCE($2,nature),
       statut = COALESCE($3,statut), updated_at = now()
     WHERE id = $4 AND owner_id = $5 RETURNING *`,
    [nom || null, nature || null, statut || null, req.params.id, req.session.userId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });
  res.json({ dossier: result.rows[0] });
});

router.delete('/:id', async (req, res) => {
  const result = await db.query('DELETE FROM dossiers WHERE id = $1 AND owner_id = $2 RETURNING id', [req.params.id, req.session.userId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });
  res.json({ ok: true });
});

module.exports = router;

router.post('/:id/documents', upload.single('file'), async (req, res) => {
  const dossier = await db.query('SELECT id FROM dossiers WHERE id = $1 AND owner_id = $2', [req.params.id, req.session.userId]);
  if (!dossier.rows[0]) return res.status(404).json({ error: 'Dossier introuvable.' });

  let contenu = '';
  let nom = req.body && req.body.nom;
  let type = req.body && req.body.type;

  if (req.file) {
    nom = nom || req.file.originalname;
    if (req.file.mimetype === 'application/pdf' || /\.pdf$/i.test(req.file.originalname)) {
      try {
        const parsed = await pdfParse(req.file.buffer);
        contenu = parsed.text;
        type = type || 'PDF';
      } catch (e) {
        return res.status(422).json({ error: "Impossible de lire ce PDF (fichier scanné en image sans OCR, ou fichier corrompu)." });
      }
    } else {
      contenu = req.file.buffer.toString('utf8');
      type = type || 'Texte';
    }
  } else if (req.body && req.body.contenu) {
    contenu = req.body.contenu;
    nom = nom || 'Document collé';
    type = type || 'Texte';
  } else {
    return res.status(400).json({ error: 'Aucun fichier ni contenu texte fourni.' });
  }

  if (!contenu.trim()) {
    return res.status(422).json({ error: "Le document semble vide une fois le texte extrait." });
  }

  const result = await db.query(
    `INSERT INTO documents (owner_id, dossier_id, nom, type, contenu, statut)
     VALUES ($1,$2,$3,$4,$5,'a_analyser') RETURNING id, nom, type, statut, created_at`,
    [req.session.userId, req.params.id, nom, type, contenu]
  );
  await db.query('UPDATE dossiers SET updated_at = now() WHERE id = $1', [req.params.id]);
  res.status(201).json({ document: result.rows[0] });
});
