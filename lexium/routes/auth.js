const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, nom, cabinet } = req.body || {};
  if (!email || !password || !nom) {
    return res.status(400).json({ error: 'Email, mot de passe et nom sont requis.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (email, password_hash, nom, cabinet) VALUES ($1,$2,$3,$4) RETURNING id, email, nom, cabinet',
      [email.toLowerCase(), hash, nom, cabinet || null]
    );
    const user = result.rows[0];
    req.session.userId = user.id;
    res.status(201).json({ user });
  } catch (err) {
    console.error('Erreur register:', err);
    res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
    req.session.userId = user.id;
    res.json({ user: { id: user.id, email: user.email, nom: user.nom, cabinet: user.cabinet } });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const result = await db.query('SELECT id, email, nom, cabinet FROM users WHERE id = $1', [req.session.userId]);
  if (!result.rows[0]) return res.status(401).json({ error: 'Session invalide.' });
  res.json({ user: result.rows[0] });
});

module.exports = router;
