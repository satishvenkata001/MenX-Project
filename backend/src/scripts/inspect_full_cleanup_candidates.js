import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';

async function inspectAll() {
  const client = await pool.connect();
  try {
    console.log('=== 1. ALL CATEGORIES ===');
    const catsRes = await client.query(`
      SELECT c.id, c.name, c.slug, c.is_active, c.created_at,
             (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id) AS subcat_count,
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS direct_prod_count
      FROM categories c
      ORDER BY c.created_at ASC
    `);
    console.table(catsRes.rows);

    console.log('\n=== 2. ALL SUBCATEGORIES ===');
    const subcatsRes = await client.query(`
      SELECT s.id, s.name, s.slug, s.category_id, c.name AS category_name,
             (SELECT COUNT(*) FROM products p WHERE p.subcategory_id = s.id) AS prod_count
      FROM subcategories s
      LEFT JOIN categories c ON c.id = s.category_id
      ORDER BY s.created_at ASC
    `);
    console.table(subcatsRes.rows);

    console.log('\n=== 3. ALL BRANDS ===');
    const brandsRes = await client.query(`
      SELECT b.id, b.name, b.slug, b.created_at,
             (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS prod_count
      FROM brands b
      ORDER BY b.created_at ASC
    `);
    console.table(brandsRes.rows);

    console.log('\n=== 4. TEST PRODUCTS (slug or title matches test pattern) ===');
    const prodsRes = await client.query(`
      SELECT p.id, p.title, p.slug, p.category_id, c.name AS category_name, p.status, p.created_at,
             (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id) AS variant_count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug ~ '-\\d{10,}' OR p.slug LIKE 'f4g-%' OR p.slug LIKE 'test-%' OR p.slug LIKE 'oos-%'
      ORDER BY p.created_at ASC
    `);
    console.table(prodsRes.rows);

    console.log('\n=== 5. SIZES & COLORS WITH TIMESTAMP PATTERNS ===');
    const sizesRes = await client.query(`
      SELECT id, name, category_type FROM sizes WHERE name ~ '-\\d{10,}' OR name LIKE 'Size-%'
    `);
    console.table(sizesRes.rows);

    const colorsRes = await client.query(`
      SELECT id, name, hex_code FROM colors WHERE name ~ '\\d{10,}' OR name LIKE 'Crimson-%'
    `);
    console.table(colorsRes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

inspectAll().catch(console.error);
