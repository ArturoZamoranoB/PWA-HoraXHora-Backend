const { Pool } = require("pg");

/*
  Este db.js funciona tanto en:
  - Render + Neon (requiere SSL)
  - Docker Compose local (NO usa SSL)
  - Desarrollo local
*/

const useSSL =
  process.env.NODE_ENV === "production" || process.env.FORCE_SSL === "true";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
