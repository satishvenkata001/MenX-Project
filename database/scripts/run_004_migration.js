import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../backend/src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '004_category_based_sizes.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running 004_category_based_sizes.sql migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully.');

    const res = await client.query('SELECT id, name, category_type, sort_order FROM sizes ORDER BY category_type, sort_order');
    console.log(`Total sizes in database: ${res.rows.length}`);
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
