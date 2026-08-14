// ============================================================================
// DATABASE CONNECTION — Aiven PostgreSQL via pg.
// ============================================================================
const { Pool } = require('pg');

// Supports DATABASE_URL or DATABASE_URI from Railway / .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI,
  ssl: {
    rejectUnauthorized: false // Required for Aiven SSL connections
  }
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('[db] Error connecting to Aiven PostgreSQL:', err.stack);
  }
  console.log('[db] Successfully connected to Aiven PostgreSQL!');
  release();
});

module.exports = pool;