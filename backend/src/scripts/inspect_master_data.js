import { pool } from '../config/db.js';

async function main() {
  console.log('=== 1. ALL ACTIVE CATEGORIES ===');
  const { rows: categories } = await pool.query(`
    SELECT id, name, slug, display_order, is_active
    FROM categories
    WHERE is_active = true
    ORDER BY display_order ASC, name ASC;
  `);
  console.table(categories);

  console.log('\n=== 2. ALL ACTIVE SUBCATEGORIES ===');
  const { rows: subcategories } = await pool.query(`
    SELECT s.id, s.category_id, c.name as category_name, c.slug as category_slug, s.name, s.slug, s.display_order, s.is_active
    FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    WHERE s.is_active = true
    ORDER BY c.name ASC, s.display_order ASC;
  `);
  console.table(subcategories);

  console.log('\n=== 3. ALL ACTIVE BRANDS ===');
  const { rows: brands } = await pool.query(`
    SELECT id, name, slug, is_active
    FROM brands
    WHERE is_active = true
    ORDER BY name ASC;
  `);
  console.table(brands);

  console.log('\n=== 4. ALL ACTIVE SIZES ===');
  const { rows: sizes } = await pool.query(`
    SELECT id, name, category_type, sort_order
    FROM sizes
    WHERE name NOT LIKE '%-%' AND name NOT LIKE 'Size-%'
    ORDER BY category_type ASC, sort_order ASC;
  `);
  console.table(sizes);

  console.log('\n=== 5. ALL ACTIVE COLORS ===');
  const { rows: colors } = await pool.query(`
    SELECT id, name, hex_code
    FROM colors
    ORDER BY name ASC;
  `);
  console.table(colors);

  console.log('\n=== 6. EXISTING PRODUCT SLUGS ===');
  const { rows: existingSlugs } = await pool.query(`
    SELECT id, title, slug, status FROM products;
  `);
  console.table(existingSlugs);

  console.log('\n=== 7. EXISTING SKUS AND BARCODES ===');
  const { rows: existingVariants } = await pool.query(`
    SELECT sku, barcode FROM product_variants;
  `);
  console.log(`Found ${existingVariants.length} existing SKUs & barcodes.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
