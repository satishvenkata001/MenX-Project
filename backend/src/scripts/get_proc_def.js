import { pool } from '../config/db.js';

async function main() {
  const f1 = await pool.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'process_cod_checkout_atomic'");
  console.log('--- COD ---');
  console.log(f1.rows[0]?.pg_get_functiondef);
  const f2 = await pool.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'reserve_inventory_for_order'");
  console.log('--- RESERVE ---');
  console.log(f2.rows[0]?.pg_get_functiondef);
  await pool.end();
}

main().catch(console.error);
