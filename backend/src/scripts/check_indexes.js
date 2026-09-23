import { pool } from '../config/db.js';

async function checkIndexes() {
  if (!pool) {
    console.log('No pool');
    return;
  }

  const res = await pool.query(`
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);

  console.log('--- PUBLIC TABLE INDEXES ---');
  for (const row of res.rows) {
    console.log(`${row.tablename.padEnd(20)} | ${row.indexname.padEnd(35)} | ${row.indexdef}`);
  }

  await pool.end();
}

checkIndexes().catch(console.error);
