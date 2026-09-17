const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "legalflow.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cabinet TEXT NOT NULL,
  avocat TEXT NOT NULL,
  barreau TEXT,
  toque TEXT,
  adresse TEXT,
  specialites TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dossiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  nom TEXT NOT NULL,
  client TEXT,
  domaine TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  texte_source TEXT,
  resultat_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
);

CREATE TABLE IF NOT EXISTS redactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  type_acte TEXT,
  instructions TEXT,
  texte_genere TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
);

CREATE TABLE IF NOT EXISTS echeances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  libelle TEXT NOT NULL,
  date_echeance TEXT NOT NULL,
  faite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id)
);

CREATE TABLE IF NOT EXISTS recherches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question TEXT,
  reponse TEXT,
  sources_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

module.exports = db;
