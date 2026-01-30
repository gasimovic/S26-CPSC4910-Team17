const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required (see backend/.env.example)");
}

const pool = new Pool({ connectionString: DATABASE_URL });

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
