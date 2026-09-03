import { pool } from '../config/db.js';

async function checkReturnEnums() {
  const res = await pool.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('return_reason', 'return_status', 'return_request_type')
    ORDER BY t.typname, e.enumsortorder;
  `);

  console.log('--- RETURN ENUM VALUES ---');
  for (const r of res.rows) {
    console.log(`${r.typname}: ${r.enumlabel}`);
  }
  await pool.end();
}

checkReturnEnums();
