const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config(); // loads backend/.env when you run from backend/

function parseDatabaseUrl(databaseUrl) {
  const u = new URL(databaseUrl);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "")
  };
}

function getCfg() {
  if (process.env.DATABASE_URL) return parseDatabaseUrl(process.env.DATABASE_URL);
  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  };
}

const cfg = getCfg();
for (const [k, v] of Object.entries(cfg)) {
  if (!v) throw new Error(`Missing DB config ${k}. Check backend/.env`);
}

const pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function exec(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, exec, ping };