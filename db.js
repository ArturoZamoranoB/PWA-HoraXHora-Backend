const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

// FORZAR IPv4
const forceIPv4 = connectionString.replace("supabase.co", "supabase.co?host=ipv4");

const pool = new Pool({
  connectionString: forceIPv4,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
