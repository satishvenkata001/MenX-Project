import { pool } from '../config/db.js';

async function auditDatabase() {
  console.log('================================================================');
  console.log('          MENX: DATABASE SIZE & CATEGORY AUDIT');
  console.log('================================================================\n');

  const client = await pool.connect();
  try {
    // 1. Categories
    const catRes = await client.query('SELECT id, name, slug, is_active FROM categories ORDER BY name');
    console.log('1. CATEGORIES:');
    console.table(catRes.rows);

    // 2. Subcategories
    const subRes = await client.query(`
      SELECT s.id, s.name, s.slug, s.category_id, c.name as category_name, c.slug as category_slug, s.is_active 
      FROM subcategories s 
      JOIN categories c ON s.category_id = c.id 
      ORDER BY c.name, s.name
    `);
    console.log('\n2. SUBCATEGORIES:');
    console.table(subRes.rows);

    // 3. Sizes
    const sizeRes = await client.query('SELECT * FROM sizes ORDER BY category_type, name');
    console.log('\n3. SIZES:');
    console.table(sizeRes.rows);

    // 4. Products matching "Jogger" or "Pants" or all products
    const prodRes = await client.query(`
      SELECT p.id, p.title, p.slug, p.status, 
             c.id as cat_id, c.name as cat_name, c.slug as cat_slug,
             sc.id as sub_id, sc.name as sub_name, sc.slug as sub_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
      ORDER BY p.title
    `);
    console.log('\n4. ALL PRODUCTS & THEIR CATEGORIES:');
    console.table(prodRes.rows);

    // 5. Existing variants with sizes and category
    const varRes = await client.query(`
      SELECT pv.id as variant_id, p.title as product_title, p.slug as product_slug,
             c.name as cat_name, c.slug as cat_slug,
             sc.name as sub_name, sc.slug as sub_slug,
             s.name as size_name, s.category_type as size_category_type,
             col.name as color_name, pv.sku, pv.is_active
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
      JOIN sizes s ON pv.size_id = s.id
      JOIN colors col ON pv.color_id = col.id
      ORDER BY p.title, s.name
    `);
    console.log('\n5. ALL VARIANTS & SIZES:');
    console.table(varRes.rows);

  } catch (err) {
    console.error('Audit query error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

auditDatabase();
