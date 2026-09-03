import { pool } from '../config/db.js';

async function inspectExactConstraints() {
  try {
    const res = await pool.query(`
      SELECT
        con.conname AS constraint_name,
        rel_src.relname AS table_name,
        att_src.attname AS column_name,
        rel_dst.relname AS foreign_table_name,
        att_dst.attname AS foreign_column_name,
        con.confdeltype AS delete_rule_code,
        CASE con.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS delete_rule,
        att_src.attnotnull AS is_not_null
      FROM pg_constraint con
      JOIN pg_class rel_src ON rel_src.oid = con.conrelid
      JOIN pg_namespace nsp_src ON nsp_src.oid = rel_src.relnamespace
      JOIN pg_class rel_dst ON rel_dst.oid = con.confrelid
      JOIN pg_attribute att_src ON att_src.attrelid = con.conrelid AND att_src.attnum = ANY(con.conkey)
      JOIN pg_attribute att_dst ON att_dst.attrelid = con.confrelid AND att_dst.attnum = ANY(con.confkey)
      WHERE nsp_src.nspname = 'public' AND con.contype = 'f'
        AND (
          rel_dst.relname IN ('categories', 'subcategories', 'products', 'product_variants')
          OR rel_src.relname IN ('categories', 'subcategories', 'products', 'product_variants', 'order_items', 'return_items', 'purchase_order_items', 'stock_movements', 'inventory_items', 'outfit_items', 'cart_items', 'wishlist_items', 'reviews', 'product_images')
        )
      ORDER BY rel_dst.relname, rel_src.relname;
    `);

    console.log('=== EXACT CATALOG & TRANSACTION FOREIGN KEY CONSTRAINTS ===');
    for (const r of res.rows) {
      console.log(`Constraint: ${r.constraint_name}`);
      console.log(`  ${r.table_name}.${r.column_name} (NOT NULL: ${r.is_not_null}) -> ${r.foreign_table_name}.${r.foreign_column_name} [ON DELETE ${r.delete_rule}]`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectExactConstraints();
