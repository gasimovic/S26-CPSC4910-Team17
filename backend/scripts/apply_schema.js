
require('dotenv').config({ path: '../.env' }); // Adjust path as needed
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function applySchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'gdip_db',
        multipleStatements: true,
    });

    console.log('Connected to database.');

    const schemaPath = path.join(__dirname, '../packages/db/init_gdip_tables.sql');
    if (!fs.existsSync(schemaPath)) {
        console.error('Schema file not found at:', schemaPath);
        process.exit(1);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    try {
        await connection.query(schemaSql);
        console.log('Schema applied successfully.');
    } catch (err) {
        console.error('Error applying schema:', err);
    } finally {
        await connection.end();
    }
}

applySchema();
