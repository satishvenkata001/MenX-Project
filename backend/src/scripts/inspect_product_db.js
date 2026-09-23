import { pool } from '../config/db.js';
import { supabaseAdmin, createUserClient } from '../config/supabase.js';

async function inspect() {
  console.log('--- Inspecting Database Schema & Products ---');
  
  // 1. Columns of products table
  const colsRes = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'products'
    ORDER BY ordinal_position;
  `);
  console.log('Products columns:');
  console.table(colsRes.rows);

  // 2. Constraints on products table
  const constrRes = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'products'::regclass;
  `);
  console.log('Products constraints:');
  console.table(constrRes.rows);

  // 3. RLS on products table
  const rlsRes = await pool.query(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname = 'products';
  `);
  console.log('Products RLS status:');
  console.table(rlsRes.rows);

  const polRes = await pool.query(`
    SELECT * FROM pg_policies WHERE tablename = 'products';
  `);
  console.log('Products policies:');
  console.table(polRes.rows);

  // 4. Triggers on products table
  const trigRes = await pool.query(`
    SELECT trigger_name, event_manipulation, action_statement, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'products';
  `);
  console.log('Products triggers:');
  console.table(trigRes.rows);

  // 5. Existing categories, subcategories, brands
  const catRes = await pool.query(`SELECT id, name, slug, is_active FROM categories LIMIT 5;`);
  console.log('Categories sample:');
  console.table(catRes.rows);

  const subRes = await pool.query(`SELECT id, category_id, name, slug, is_active FROM subcategories LIMIT 5;`);
  console.log('Subcategories sample:');
  console.table(subRes.rows);

  const brandRes = await pool.query(`SELECT id, name, slug, is_active FROM brands LIMIT 5;`);
  console.log('Brands sample:');
  console.table(brandRes.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
