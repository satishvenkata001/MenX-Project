import { pool } from '../config/db.js';

async function inspectForeignKeys() {
  try {
    const res = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      ORDER BY ccu.table_name, tc.table_name;
    `);

    console.log('--- ALL FOREIGN KEYS IN DATABASE ---');
    for (const row of res.rows) {
      console.log(`${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name} (ON DELETE ${row.delete_rule})`);
    }

    // Also list all tables
    const tablesRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\n--- ALL PUBLIC TABLES ---');
    console.log(tablesRes.rows.map(r => r.table_name).join(', '));

  } catch (err) {
    console.error('Error inspecting FKs:', err);
  } finally {
    await pool.end();
  }
}

inspectForeignKeys();
