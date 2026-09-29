-- Schéma Lexium — un cabinet = un ou plusieurs utilisateurs, chaque ligne métier
-- rattachée à owner_id pour un cloisonnement strict des données entre cabinets.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom TEXT NOT NULL,
  cabinet TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dossiers (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  nature TEXT,
  statut TEXT NOT NULL DEFAULT 'En cours',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT,
  contenu TEXT,
  analyse_ia JSONB,
  statut TEXT NOT NULL DEFAULT 'a_analyser',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS echeances (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dossier_id INTEGER REFERENCES dossiers(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  date_echeance DATE NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dossier_id INTEGER REFERENCES dossiers(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  contenu TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mouvements_carpa (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dossier_id INTEGER NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- reception | honoraires | reversement | autre
  montant NUMERIC(12,2) NOT NULL,
  date_mouvement DATE NOT NULL,
  provenance_destinataire TEXT,
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossiers_owner ON dossiers(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_dossier ON documents(dossier_id);
CREATE INDEX IF NOT EXISTS idx_echeances_owner ON echeances(owner_id);
CREATE INDEX IF NOT EXISTS idx_echeances_dossier ON echeances(dossier_id);
CREATE INDEX IF NOT EXISTS idx_messages_owner ON messages(owner_id);
CREATE INDEX IF NOT EXISTS idx_carpa_dossier ON mouvements_carpa(dossier_id);
CREATE INDEX IF NOT EXISTS idx_carpa_owner ON mouvements_carpa(owner_id);
