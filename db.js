const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // necesario para Neon en Render
  },
  max: 5,                       // recomendado para PostgreSQL serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
