import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';
import { CatalogService } from '../services/catalog.service.js';

async function cleanupStrandedFixtures() {
  console.log('=== MENX TEST FIXTURE CLEANUP ===\n');

  const client = await pool.connect();
  try {
    // Resolve admin profile ID
    const adminRes = await client.query("SELECT id FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1");
    const adminId = adminRes.rows[0]?.id || null;

    // 1. Identify test categories
    const testCatsRes = await client.query(`
      SELECT c.id, c.name, c.slug, c.created_at,
             (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id) AS subcat_count,
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS prod_count
      FROM categories c
      WHERE c.slug ~ '^men-shirts-\\d{10,}' OR c.slug ~ '^test-cat-'
      ORDER BY c.created_at ASC
    `);

    console.log(`Found ${testCatsRes.rows.length} test categories to delete:`);
    console.table(testCatsRes.rows);

    for (const cat of testCatsRes.rows) {
      console.log(`Deleting test category: ${cat.name} (${cat.slug}, ID: ${cat.id})...`);
      const result = await CatalogService.deleteCategory(
        cat.id,
        { id: adminId, role: 'SUPER_ADMIN' },
        null,
        { ip: '127.0.0.1', userAgent: 'test-fixture-cleanup-script' }
      );
      console.log(`  -> Deleted successfully:`, result.message);
    }

    // 2. Identify test products not attached to test categories
    const testProdsRes = await client.query(`
      SELECT p.id, p.title, p.slug
      FROM products p
      WHERE p.slug ~ '-\\d{10,}' OR p.slug LIKE 'f4g-%' OR p.slug LIKE 'test-jacket-%'
    `);
    console.log(`\nFound ${testProdsRes.rows.length} remaining stranded test products to delete:`);
    console.table(testProdsRes.rows);

    for (const prod of testProdsRes.rows) {
      console.log(`Deleting test product: ${prod.title} (${prod.slug}, ID: ${prod.id})...`);
      const result = await CatalogService.deleteProduct(
        prod.id,
        { id: adminId, role: 'SUPER_ADMIN' },
        null,
        { ip: '127.0.0.1', userAgent: 'test-fixture-cleanup-script' }
      );
      console.log(`  -> Deleted successfully:`, result.message);
    }

    // 3. Clean up stranded test brands with timestamps
    const testBrandsRes = await client.query(`
      DELETE FROM brands
      WHERE (name ~ '\\d{10,}' OR slug ~ '\\d{10,}')
        AND id NOT IN (SELECT DISTINCT brand_id FROM products WHERE brand_id IS NOT NULL)
      RETURNING id, name, slug
    `);
    console.log(`\nDeleted ${testBrandsRes.rows.length} stranded test brands.`);

    // 4. Clean up stranded test sizes with timestamps
    const testSizesRes = await client.query(`
      DELETE FROM sizes
      WHERE (name ~ '-\\d{10,}' OR name LIKE 'Size-%')
        AND id NOT IN (SELECT DISTINCT size_id FROM product_variants WHERE size_id IS NOT NULL)
      RETURNING id, name
    `);
    console.log(`Deleted ${testSizesRes.rows.length} stranded test sizes.`);

    // 5. Clean up stranded test colors with timestamps
    const testColorsRes = await client.query(`
      DELETE FROM colors
      WHERE (name ~ '\\d{10,}' OR name LIKE 'Crimson-%')
        AND id NOT IN (SELECT DISTINCT color_id FROM product_variants WHERE color_id IS NOT NULL)
      RETURNING id, name
    `);
    console.log(`Deleted ${testColorsRes.rows.length} stranded test colors.`);

    // 6. Verify final category list in database
    console.log('\n=== FINAL PRODUCTION CATEGORIES ===');
    const finalCats = await client.query(`
      SELECT c.id, c.name, c.slug, c.display_order, c.is_active,
             (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id) AS subcat_count,
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS direct_prod_count
      FROM categories c
      ORDER BY c.display_order ASC, c.name ASC
    `);
    console.table(finalCats.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

cleanupStrandedFixtures().catch(console.error);
