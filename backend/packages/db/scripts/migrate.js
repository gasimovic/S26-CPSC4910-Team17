#!/usr/bin/env node
/**
 * Database migration runner.
 * Usage:  npm run db:migrate   (from backend/)
 *
 * Reads *.sql files from packages/db/migrations/ in alphabetical order,
 * skips any already recorded in the schema_migrations table,
 * executes new ones statement-by-statement, and records them.
 */

const path = require("path");
const fs = require("fs");

// Load .env from the backend root (same convention as the services)
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const { pool, query, exec } = require("../src/index");

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

async function ensureMigrationsTable() {
  await exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

async function getApplied() {
  const rows = await query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((r) => r.filename));
}

async function runFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, "utf8");

  // Split on semicolons that are followed by a newline (or end-of-file).
  // This avoids splitting inside strings that happen to contain semicolons.
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (err) {
        const isAddColumn = /^ALTER\s+TABLE[\s\S]*?ADD\s+COLUMN/i.test(stmt);
        const isDuplicateColumn = err && err.code === "ER_DUP_FIELDNAME";
        if (isAddColumn && isDuplicateColumn) {
          // Keep migrations idempotent across MySQL variants that do not support
          // ADD COLUMN IF NOT EXISTS.
          continue;
        }
        throw err;
      }
    }
    await conn.query(
      "INSERT INTO schema_migrations (filename) VALUES (?)",
      [filename]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function main() {
  await ensureMigrationsTable();
  const applied = await getApplied();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }
    process.stdout.write(`  apply ${file} ... `);
    await runFile(file);
    console.log("OK");
    count++;
  }

  if (count === 0) {
    console.log("All migrations already applied.");
  } else {
    console.log(`\nApplied ${count} migration(s).`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message || err);
  process.exit(1);
});
