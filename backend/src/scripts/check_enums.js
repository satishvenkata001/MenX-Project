import { pool } from '../config/db.js';

async function checkEnums() {
  const res = await pool.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('order_status', 'payment_status', 'payment_method', 'order_channel', 'stock_movement_type')
    ORDER BY t.typname, e.enumsortorder;
  `);

  console.log('--- ENUM VALUES ---');
  for (const r of res.rows) {
    console.log(`${r.typname}: ${r.enumlabel}`);
  }
  await pool.end();
}

checkEnums();
