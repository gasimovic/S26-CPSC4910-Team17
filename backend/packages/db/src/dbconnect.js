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

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('Connected to the MySQL database!');

    // Run a safe test query if a table name is provided via env
    if (process.env.TEST_QUERY) {
      const [rows] = await connection.execute(process.env.TEST_QUERY);
      console.log('Test query results:', rows);
    }
  } catch (err) {
    console.error('Error connecting to the database:', err?.message ?? err);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
