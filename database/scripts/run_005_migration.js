import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../backend/src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '005_brand_description.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running 005_brand_description.sql migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully.');

    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'brands' 
      ORDER BY ordinal_position
    `);
    console.log('Brands columns after migration:');
    console.table(res.rows);

    const brandsRes = await client.query('SELECT id, name, slug, description, is_active FROM brands ORDER BY name');
    console.log(`Existing brands preserved (${brandsRes.rows.length}):`);
    console.table(brandsRes.rows);
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
