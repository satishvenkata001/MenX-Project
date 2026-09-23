import { pool } from '../../backend/src/config/db.js';

async function main() {
  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'delivery_zones'::regclass;
  `);
  console.log('Constraints:', JSON.stringify(constraints.rows, null, 2));

  const indexes = await pool.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'delivery_zones';
  `);
  console.log('Indexes:', JSON.stringify(indexes.rows, null, 2));
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
