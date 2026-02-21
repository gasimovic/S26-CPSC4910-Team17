require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'gdip_db',
    multipleStatements: true,
  });

  console.log('Connected to database for migrations.');

  // Ensure schema_migrations table exists (init file should create it but be safe)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const migrationsDir = path.join(__dirname, '../packages/db/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const [rows] = await connection.query('SELECT id FROM schema_migrations WHERE filename = ? LIMIT 1', [file]);
    if (rows && rows.length > 0) {
      console.log('Skipping already-applied migration:', file);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      console.log('Applying migration:', file);
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      console.log('Applied:', file);
    } catch (err) {
      console.error('Failed to apply migration', file, err);
      await connection.end();
      process.exit(1);
    }
  }

  await connection.end();
  console.log('Migrations complete.');
}

runMigrations().catch(err => {
  console.error('Migration runner error:', err);
  process.exit(1);
});