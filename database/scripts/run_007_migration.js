import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../backend/src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const sqlPath = path.join(__dirname, '..', 'migrations', '007_fix_inventory_manager_rls.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Running 007_fix_inventory_manager_rls.sql migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 007 completed successfully.');

    // 1. Verify live function definition
    const funcRes = await client.query(`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'is_manager_or_superadmin';
    `);
    console.log('Verified is_manager_or_superadmin() function:');
    console.table(funcRes.rows);

    // 2. Verify products policies
    const polRes = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'products'
      ORDER BY policyname;
    `);
    console.log('Verified products table RLS policies:');
    console.table(polRes.rows);
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
