import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.resolve(__dirname, '../../../database/migrations/003_catalog_hard_delete_fks.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running migration 003_catalog_hard_delete_fks.sql...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(' Migration 003 applied successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 003 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
