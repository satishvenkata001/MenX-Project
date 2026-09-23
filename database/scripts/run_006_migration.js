import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../backend/src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '006_support_and_suggestions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running 006_support_and_suggestions.sql migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully.');

    // Verify tables exist
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('support_tickets', 'support_ticket_messages', 'customer_suggestions')
      ORDER BY table_name
    `);
    console.log('Verified created tables:');
    console.table(res.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
