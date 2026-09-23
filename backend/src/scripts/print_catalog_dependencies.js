import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';

async function printTables() {
  const client = await pool.connect();
  try {
    console.log('--- ALL CATEGORIES ---');
    const cats = await client.query(`
      SELECT c.id, c.name, c.slug, c.display_order, c.is_active,
             (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id) AS subcat_count,
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS direct_prod_count
      FROM categories c
      ORDER BY c.created_at ASC
    `);
    console.table(cats.rows);

    console.log('--- ALL SUBCATEGORIES ---');
    const subcats = await client.query(`
      SELECT s.id, s.name, s.slug, s.category_id, c.name as cat_name,
             (SELECT COUNT(*) FROM products p WHERE p.subcategory_id = s.id) AS prod_count
      FROM subcategories s
      LEFT JOIN categories c ON c.id = s.category_id
      ORDER BY s.created_at ASC
    `);
    console.table(subcats.rows);

    console.log('--- ALL BRANDS ---');
    const brands = await client.query(`
      SELECT b.id, b.name, b.slug,
             (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS prod_count
      FROM brands b
      ORDER BY b.created_at ASC
    `);
    console.table(brands.rows);

    console.log('--- ALL PRODUCTS ---');
    const prods = await client.query(`
      SELECT p.id, p.title, p.slug, p.category_id, c.name as cat_name, p.status,
             (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) AS variant_count,
             (SELECT COUNT(*) FROM order_items oi JOIN product_variants pv ON pv.id = oi.variant_id WHERE pv.product_id = p.id) AS order_item_count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at ASC
    `);
    console.table(prods.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

printTables().catch(console.error);
