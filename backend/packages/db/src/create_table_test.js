import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  host: process.env.DB_HOST ?? 'localhost',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? undefined,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
};

const TABLE_NAME = process.env.TABLE_NAME ?? 'test_table';

const SAMPLE_ROWS = [
  { name: process.env.SAMPLE_NAME_1 ?? 'Alice' },
  { name: process.env.SAMPLE_NAME_2 ?? 'Bob' },
];

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    const createSQL = `CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;`;

    await conn.execute(createSQL);
    console.log(`Table "${TABLE_NAME}" created or already exists.`);

    // Check if table has rows
    const [countRows] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM \`${TABLE_NAME}\``
    );
    const rowCount = countRows[0]?.cnt ?? 0;

    if (rowCount === 0) {
      // Insert sample rows
      const insertSQL = `INSERT INTO \`${TABLE_NAME}\` (name) VALUES (?)`;
      for (const r of SAMPLE_ROWS) {
        await conn.execute(insertSQL, [r.name]);
      }
      console.log(`Inserted ${SAMPLE_ROWS.length} sample rows into "${TABLE_NAME}".`);
    } else {
      console.log(`Table "${TABLE_NAME}" already has ${rowCount} row(s); skipping insert.`);
    }

    // Fetch and print all rows
    const [rows] = await conn.execute(`SELECT * FROM \`${TABLE_NAME}\` ORDER BY id`);
    console.log('Rows in table:');
    console.table(rows);
  } catch (err) {
    console.error('Error creating/populating/fetching table:', err?.message ?? err);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

main();
