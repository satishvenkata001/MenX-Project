import { pool } from '../config/db.js';

async function inspect() {
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'brands'
    ORDER BY ordinal_position;
  `);
  console.log('BRANDS COLUMNS:', cols.rows);

  const constraints = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def 
    FROM pg_constraint 
    WHERE conrelid = 'brands'::regclass;
  `);
  console.log('BRANDS CONSTRAINTS:', constraints.rows);

  const cur = await pool.query(`
    SELECT b.*, COUNT(p.id)::int as product_count
    FROM brands b
    LEFT JOIN products p ON p.brand_id = b.id
    GROUP BY b.id
    ORDER BY b.is_active DESC, b.name ASC;
  `);
  console.log('EXISTING BRANDS WITH PRODUCT COUNT:', cur.rows);

  const productFk = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'products'::regclass AND conname LIKE '%brand%';
  `);
  console.log('PRODUCT BRAND FK:', productFk.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
