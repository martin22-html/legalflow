const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL manquant. Sur Render, reliez une base Postgres au service : " +
    "elle définit automatiquement cette variable."
  );
}

// Render fournit des certificats internes non signés par une autorité publique ;
// on garde la connexion chiffrée (SSL) sans valider la chaîne, comme recommandé
// par Render pour les connexions internes au même compte.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
});

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = {
  pool,
  init,
  query: (text, params) => pool.query(text, params),
};
