require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");
const { analyserDocument, redigerTexte, rechercheJuridique } = require("./claude");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "changez-moi-en-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Non authentifié." });
  next();
}

function currentUser(req) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    cabinet: u.cabinet,
    avocat: u.avocat,
    barreau: u.barreau,
    toque: u.toque,
    adresse: u.adresse,
    specialites: u.specialites ? JSON.parse(u.specialites) : [],
  };
}

// ---------- AUTH ----------
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, cabinet, avocat, barreau, toque, adresse, specialites } = req.body;
    if (!email || !password || !cabinet || !avocat) {
      return res.status(400).json({ error: "Email, mot de passe, cabinet et avocat référent sont requis." });
    }
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Un compte existe déjà avec cet email." });

    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare(
        "INSERT INTO users (email, password_hash, cabinet, avocat, barreau, toque, adresse, specialites) VALUES (?,?,?,?,?,?,?,?)"
      )
      .run(email, hash, cabinet, avocat, barreau || "", toque || "", adresse || "", JSON.stringify(specialites || []));

    req.session.userId = info.lastInsertRowid;
    res.json({ user: publicUser(currentUser(req)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Identifiants incorrects." });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Identifiants incorrects." });
    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const u = currentUser(req);
  res.json({ user: u ? publicUser(u) : null });
});

app.put("/api/me", requireAuth, (req, res) => {
  const { cabinet, avocat, barreau, toque, adresse, specialites } = req.body;
  db.prepare(
    "UPDATE users SET cabinet=?, avocat=?, barreau=?, toque=?, adresse=?, specialites=? WHERE id=?"
  ).run(cabinet, avocat, barreau || "", toque || "", adresse || "", JSON.stringify(specialites || []), req.session.userId);
  res.json({ user: publicUser(currentUser(req)) });
});

// ---------- DOSSIERS ----------
app.get("/api/dossiers", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM dossiers WHERE user_id = ? ORDER BY created_at DESC").all(req.session.userId);
  res.json({ dossiers: rows });
});

app.post("/api/dossiers", requireAuth, (req, res) => {
  const { nom, client, domaine, notes } = req.body;
  if (!nom) return res.status(400).json({ error: "Le nom du dossier est requis." });
  const info = db
    .prepare("INSERT INTO dossiers (user_id, nom, client, domaine, notes) VALUES (?,?,?,?,?)")
    .run(req.session.userId, nom, client || "", domaine || "", notes || "");
  const dossier = db.prepare("SELECT * FROM dossiers WHERE id = ?").get(info.lastInsertRowid);
  res.json({ dossier });
});

function ownDossier(req, res, next) {
  const dossier = db.prepare("SELECT * FROM dossiers WHERE id = ? AND user_id = ?").get(req.params.id, req.session.userId);
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  req.dossier = dossier;
  next();
}

app.get("/api/dossiers/:id", requireAuth, ownDossier, (req, res) => {
  const analyses = db.prepare("SELECT * FROM analyses WHERE dossier_id = ? ORDER BY created_at DESC").all(req.params.id);
  const redactions = db.prepare("SELECT * FROM redactions WHERE dossier_id = ? ORDER BY created_at DESC").all(req.params.id);
  const echeances = db.prepare("SELECT * FROM echeances WHERE dossier_id = ? ORDER BY date_echeance ASC").all(req.params.id);
  res.json({
    dossier: req.dossier,
    analyses: analyses.map((a) => ({ ...a, resultat: JSON.parse(a.resultat_json) })),
    redactions,
    echeances,
  });
});

// ---------- ANALYSE ----------
app.post("/api/dossiers/:id/analyse", requireAuth, ownDossier, async (req, res) => {
  try {
    const { texte } = req.body;
    if (!texte || !texte.trim()) return res.status(400).json({ error: "Le texte à analyser est vide." });
    const user = currentUser(req);
    const resultat = await analyserDocument(texte, user);
    const info = db
      .prepare("INSERT INTO analyses (dossier_id, texte_source, resultat_json) VALUES (?,?,?)")
      .run(req.params.id, texte, JSON.stringify(resultat));
    res.json({ id: info.lastInsertRowid, resultat });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- REDACTION ----------
app.post("/api/dossiers/:id/redaction", requireAuth, ownDossier, async (req, res) => {
  try {
    const { typeActe, instructions } = req.body;
    if (!typeActe) return res.status(400).json({ error: "Le type d'acte est requis." });
    const user = currentUser(req);
    const contexte = req.dossier.notes || req.dossier.nom;
    const texte = await redigerTexte({ typeActe, instructions, contexte }, user);
    const info = db
      .prepare("INSERT INTO redactions (dossier_id, type_acte, instructions, texte_genere) VALUES (?,?,?,?)")
      .run(req.params.id, typeActe, instructions || "", texte);
    res.json({ id: info.lastInsertRowid, texte });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- ECHEANCES ----------
app.post("/api/dossiers/:id/echeances", requireAuth, ownDossier, (req, res) => {
  const { libelle, date_echeance } = req.body;
  if (!libelle || !date_echeance) return res.status(400).json({ error: "Libellé et date requis." });
  const info = db
    .prepare("INSERT INTO echeances (dossier_id, libelle, date_echeance) VALUES (?,?,?)")
    .run(req.params.id, libelle, date_echeance);
  res.json({ id: info.lastInsertRowid });
});

app.put("/api/echeances/:id/toggle", requireAuth, (req, res) => {
  const echeance = db
    .prepare(
      "SELECT e.* FROM echeances e JOIN dossiers d ON d.id = e.dossier_id WHERE e.id = ? AND d.user_id = ?"
    )
    .get(req.params.id, req.session.userId);
  if (!echeance) return res.status(404).json({ error: "Échéance introuvable." });
  db.prepare("UPDATE echeances SET faite = ? WHERE id = ?").run(echeance.faite ? 0 : 1, req.params.id);
  res.json({ ok: true });
});

// ---------- RECHERCHE JURIDIQUE ----------
app.post("/api/recherche", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: "La question est vide." });
    const { reponse, sources } = await rechercheJuridique(question);
    db.prepare("INSERT INTO recherches (user_id, question, reponse, sources_json) VALUES (?,?,?,?)").run(
      req.session.userId,
      question,
      reponse,
      JSON.stringify(sources)
    );
    res.json({ reponse, sources });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("LegalFlow AI démarré sur le port " + PORT);
});
