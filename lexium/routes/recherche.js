const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rechercher } = require('../recherche');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const q = req.query.q || '';
  const resultat = rechercher(q);
  if (!resultat) return res.json({ trouve: false, items: [] });
  res.json({ trouve: true, ...resultat });
});

module.exports = router;
