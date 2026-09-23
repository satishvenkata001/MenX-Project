import { pool } from '../config/db.js';

async function checkMoreIndexes() {
  if (!pool) return;
  const res = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items', 'profiles', 'inventory_items', 'addresses', 'audit_logs')
    ORDER BY tablename, indexname;
  `);

  for (const row of res.rows) {
    console.log(`${row.tablename.padEnd(16)} | ${row.indexname.padEnd(32)} | ${row.indexdef}`);
  }
  await pool.end();
}
checkMoreIndexes().catch(console.error);
