import { pool } from '../config/db.js';

async function main() {
  const fnRes = await pool.query(`
    SELECT pg_get_functiondef(oid) as def
    FROM pg_proc
    WHERE proname = 'process_cod_checkout_atomic'
  `);
  const lines = fnRes.rows[0]?.def.split('\n');
  console.log(lines.slice(0, 80).join('\n'));
  process.exit(0);
}

main().catch(console.error);
