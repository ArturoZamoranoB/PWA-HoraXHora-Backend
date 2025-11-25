const { Pool } = require("pg");

let url = process.env.DATABASE_URL;

// FORZAR IPv4 EN SUPABASE
url = url.replace(".supabase.co", ".supabase.co.ipv4");

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
