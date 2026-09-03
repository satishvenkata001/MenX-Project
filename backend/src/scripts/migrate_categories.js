import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set in backend .env file.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const NEW_TAXONOMY = [
  {
    name: 'T-Shirts',
    slug: 't-shirts',
    display_order: 1,
    subcategories: [
      { name: 'Round Neck', slug: 't-shirts-round-neck', display_order: 1 },
      { name: 'Polo', slug: 't-shirts-polo', display_order: 2 },
      { name: 'Oversized', slug: 't-shirts-oversized', display_order: 3 },
      { name: 'Printed', slug: 't-shirts-printed', display_order: 4 },
      { name: 'Full Sleeve', slug: 't-shirts-full-sleeve', display_order: 5 }
    ]
  },
  {
    name: 'Shirts',
    slug: 'shirts',
    display_order: 2,
    subcategories: [
      { name: 'Casual', slug: 'shirts-casual', display_order: 1 },
      { name: 'Formal', slug: 'shirts-formal', display_order: 2 },
      { name: 'Checks', slug: 'shirts-checks', display_order: 3 },
      { name: 'Printed', slug: 'shirts-printed', display_order: 4 },
      { name: 'Linen', slug: 'shirts-linen', display_order: 5 },
      { name: 'Full Sleeve', slug: 'shirts-full-sleeve', display_order: 6 }
    ]
  },
  {
    name: 'Jeans',
    slug: 'jeans',
    display_order: 3,
    subcategories: [
      { name: 'Slim Fit', slug: 'jeans-slim-fit', display_order: 1 },
      { name: 'Regular Fit', slug: 'jeans-regular-fit', display_order: 2 },
      { name: 'Straight Fit', slug: 'jeans-straight-fit', display_order: 3 },
      { name: 'Relaxed Fit', slug: 'jeans-relaxed-fit', display_order: 4 }
    ]
  },
  {
    name: 'Trousers',
    slug: 'trousers',
    display_order: 4,
    subcategories: [
      { name: 'Formal', slug: 'trousers-formal', display_order: 1 },
      { name: 'Chinos', slug: 'trousers-chinos', display_order: 2 },
      { name: 'Cargo', slug: 'trousers-cargo', display_order: 3 },
      { name: 'Casual', slug: 'trousers-casual', display_order: 4 }
    ]
  },
  {
    name: 'Shorts',
    slug: 'shorts',
    display_order: 5,
    subcategories: [
      { name: 'Casual', slug: 'shorts-casual', display_order: 1 },
      { name: 'Cargo', slug: 'shorts-cargo', display_order: 2 },
      { name: 'Denim', slug: 'shorts-denim', display_order: 3 }
    ]
  },
  {
    name: 'Jackets',
    slug: 'jackets',
    display_order: 6,
    subcategories: [
      { name: 'Denim', slug: 'jackets-denim', display_order: 1 },
      { name: 'Casual', slug: 'jackets-casual', display_order: 2 },
      { name: 'Bomber', slug: 'jackets-bomber', display_order: 3 },
      { name: 'Winter', slug: 'jackets-winter', display_order: 4 }
    ]
  },
  {
    name: 'Ethnic Wear',
    slug: 'ethnic-wear',
    display_order: 7,
    subcategories: [
      { name: 'Kurta', slug: 'ethnic-wear-kurta', display_order: 1 },
      { name: 'Kurta Sets', slug: 'ethnic-wear-kurta-sets', display_order: 2 },
      { name: 'Nehru Jackets', slug: 'ethnic-wear-nehru-jackets', display_order: 3 }
    ]
  },
  {
    name: 'Activewear',
    slug: 'activewear',
    display_order: 8,
    subcategories: [
      { name: 'Track Pants', slug: 'activewear-track-pants', display_order: 1 },
      { name: 'Sports T-Shirts', slug: 'activewear-sports-t-shirts', display_order: 2 },
      { name: 'Shorts', slug: 'activewear-shorts', display_order: 3 }
    ]
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    display_order: 9,
    subcategories: [
      { name: 'Sneakers', slug: 'footwear-sneakers', display_order: 1 },
      { name: 'Formal Shoes', slug: 'footwear-formal-shoes', display_order: 2 },
      { name: 'Casual Shoes', slug: 'footwear-casual-shoes', display_order: 3 },
      { name: 'Sandals', slug: 'footwear-sandals', display_order: 4 }
    ]
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    display_order: 10,
    subcategories: [
      { name: 'Belts', slug: 'accessories-belts', display_order: 1 },
      { name: 'Wallets', slug: 'accessories-wallets', display_order: 2 },
      { name: 'Caps', slug: 'accessories-caps', display_order: 3 },
      { name: 'Sunglasses', slug: 'accessories-sunglasses', display_order: 4 },
      { name: 'Watches', slug: 'accessories-watches', display_order: 5 }
    ]
  }
];

async function runMigration() {
  const isDryRun = process.argv[2] !== '--execute';
  console.log(`Running migration in ${isDryRun ? 'DRY-RUN / PREVIEW' : 'EXECUTE'} mode...`);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const stats = {
      categoriesInserted: 0,
      subcategoriesInserted: 0,
      productsRemapped: [],
      testProductsDeleted: 0,
      testVariantsDeleted: 0,
      testImagesDeleted: 0,
      testInventoryDeleted: 0,
      testStockMovementsDeleted: 0,
      testCartItemsDeleted: 0,
      testOrdersDeleted: 0,
      testOrderItemsDeleted: 0,
      testOrderStatusDeleted: 0,
      testReturnsDeleted: 0,
      testReturnItemsDeleted: 0,
      testReturnStatusDeleted: 0,
      couponRedemptionsDeleted: 0,
      dirtyBrandsDeleted: 0,
      dirtySubcategoriesDeleted: 0,
      dirtyCategoriesDeleted: 0,
      testSizesDeleted: 0,
      testColorsDeleted: 0,
      retiredSubcategoriesDeleted: 0,
      retiredCategoriesDeleted: 0
    };

    // ---------------------------------------------------------
    // 1. INSERT THE NEW CATEGORY STRUCTURE
    // ---------------------------------------------------------
    const catSlugToId = {};
    const subcatSlugToId = {};

    for (const cat of NEW_TAXONOMY) {
      let catId;
      const existingCat = await client.query('SELECT id FROM categories WHERE slug = $1', [cat.slug]);
      if (existingCat.rows.length > 0) {
        catId = existingCat.rows[0].id;
      } else {
        const resCat = await client.query(`
          INSERT INTO categories (name, slug, display_order, is_active)
          VALUES ($1, $2, $3, true)
          RETURNING id
        `, [cat.name, cat.slug, cat.display_order]);
        catId = resCat.rows[0].id;
        stats.categoriesInserted++;
      }
      catSlugToId[cat.slug] = catId;

      for (const sub of cat.subcategories) {
        let subId;
        const existingSub = await client.query('SELECT id FROM subcategories WHERE slug = $1', [sub.slug]);
        if (existingSub.rows.length > 0) {
          subId = existingSub.rows[0].id;
        } else {
          const resSub = await client.query(`
            INSERT INTO subcategories (category_id, name, slug, display_order, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
          `, [catId, sub.name, sub.slug, sub.display_order]);
          subId = resSub.rows[0].id;
          stats.subcategoriesInserted++;
        }
        subcatSlugToId[sub.slug] = subId;
      }
    }

    // ---------------------------------------------------------
    // 2. MAP THE LEGITIMATE SEEDED PRODUCTS TO THE NEW TAXONOMY
    // ---------------------------------------------------------
    // Oxford Shirt
    const oxfordCatId = catSlugToId['shirts'];
    const oxfordSubcatId = subcatSlugToId['shirts-formal'];
    const resOxford = await client.query(`
      UPDATE products
      SET category_id = $1, subcategory_id = $2
      WHERE slug = 'signature-oxford-cotton-shirt'
      RETURNING id, title
    `, [oxfordCatId, oxfordSubcatId]);
    if (resOxford.rows.length > 0) {
      stats.productsRemapped.push({ title: resOxford.rows[0].title, category: 'Shirts', subcategory: 'Formal' });
    }

    // Chelsea Boots
    const bootsCatId = catSlugToId['footwear'];
    const bootsSubcatId = subcatSlugToId['footwear-formal-shoes'];
    const resBoots = await client.query(`
      UPDATE products
      SET category_id = $1, subcategory_id = $2
      WHERE slug = 'premium-leather-chelsea-boots'
      RETURNING id, title
    `, [bootsCatId, bootsSubcatId]);
    if (resBoots.rows.length > 0) {
      stats.productsRemapped.push({ title: resBoots.rows[0].title, category: 'Footwear', subcategory: 'Formal Shoes' });
    }

    // Tech T-Shirt
    const dryCatId = catSlugToId['activewear'];
    const drySubcatId = subcatSlugToId['activewear-sports-t-shirts'];
    const resDry = await client.query(`
      UPDATE products
      SET category_id = $1, subcategory_id = $2
      WHERE slug = 'aerofit-tech-dry-t-shirt'
      RETURNING id, title
    `, [dryCatId, drySubcatId]);
    if (resDry.rows.length > 0) {
      stats.productsRemapped.push({ title: resDry.rows[0].title, category: 'Activewear', subcategory: 'Sports T-Shirts' });
    }

    // ---------------------------------------------------------
    // 3. IDENTIFY DIRTY DATA
    // ---------------------------------------------------------
    const dirtyCategoriesRes = await client.query(`
      SELECT id FROM categories 
      WHERE name LIKE 'Apparel-17%' 
         OR slug LIKE 'apparel-17%'
         OR slug ~ '-\\d{13}$'
    `);
    const dirtyCategoryIds = dirtyCategoriesRes.rows.map(r => r.id);

    const dirtySubcategoriesRes = await client.query(`
      SELECT id FROM subcategories 
      WHERE name LIKE 'Shirts-17%' 
         OR slug LIKE 'shirts-17%'
         OR slug ~ '-\\d{13}$'
    `);
    const dirtySubcategoryIds = dirtySubcategoriesRes.rows.map(r => r.id);

    const dirtyBrandsRes = await client.query(`
      SELECT id FROM brands 
      WHERE name LIKE 'Brand-17%' 
         OR slug LIKE 'brand-17%'
         OR slug ~ '-\\d{13}$'
    `);
    const dirtyBrandIds = dirtyBrandsRes.rows.map(r => r.id);

    const dirtyProductsRes = await client.query(`
      SELECT id FROM products
      WHERE title LIKE 'F4F Test Product%'
         OR slug LIKE 'f4f-test-product%'
         OR slug ~ '-\\d{13}$'
         OR brand_id = ANY($1::uuid[])
         OR category_id = ANY($2::uuid[])
         OR subcategory_id = ANY($3::uuid[])
    `, [dirtyBrandIds, dirtyCategoryIds, dirtySubcategoryIds]);
    const dirtyProductIds = dirtyProductsRes.rows.map(r => r.id);

    let dirtyVariantIds = [];
    if (dirtyProductIds.length > 0) {
      const dirtyVariantsRes = await client.query(`
        SELECT id FROM product_variants
        WHERE product_id = ANY($1::uuid[])
      `, [dirtyProductIds]);
      dirtyVariantIds = dirtyVariantsRes.rows.map(r => r.id);
    }

    let testOrderIds = [];
    if (dirtyVariantIds.length > 0) {
      const testOrdersRes = await client.query(`
        SELECT DISTINCT order_id FROM order_items
        WHERE variant_id = ANY($1::uuid[])
      `, [dirtyVariantIds]);
      testOrderIds = testOrdersRes.rows.map(r => r.order_id);
    }

    let testReturnIds = [];
    if (testOrderIds.length > 0) {
      const testReturnsRes = await client.query(`
        SELECT DISTINCT id FROM return_requests
        WHERE order_id = ANY($1::uuid[])
      `, [testOrderIds]);
      testReturnIds = testReturnsRes.rows.map(r => r.id);
    }

    // ---------------------------------------------------------
    // 4. CASCADE DELETE TEST DATA
    // ---------------------------------------------------------
    if (testReturnIds.length > 0) {
      const r1 = await client.query('DELETE FROM return_status_history WHERE return_request_id = ANY($1::uuid[])', [testReturnIds]);
      stats.testReturnStatusDeleted = r1.rowCount;
      const r2 = await client.query('DELETE FROM return_items WHERE return_request_id = ANY($1::uuid[])', [testReturnIds]);
      stats.testReturnItemsDeleted = r2.rowCount;
      const r3 = await client.query('DELETE FROM return_requests WHERE id = ANY($1::uuid[])', [testReturnIds]);
      stats.testReturnsDeleted = r3.rowCount;
    }

    if (testOrderIds.length > 0) {
      const o1 = await client.query('DELETE FROM order_status_history WHERE order_id = ANY($1::uuid[])', [testOrderIds]);
      stats.testOrderStatusDeleted = o1.rowCount;
      const o2 = await client.query('DELETE FROM order_items WHERE order_id = ANY($1::uuid[])', [testOrderIds]);
      stats.testOrderItemsDeleted = o2.rowCount;
      const o3 = await client.query('DELETE FROM coupon_redemptions WHERE order_id = ANY($1::uuid[])', [testOrderIds]);
      stats.couponRedemptionsDeleted = o3.rowCount;
      const o4 = await client.query('DELETE FROM stock_movements WHERE reference_type = \'ORDER\' AND reference_id::uuid = ANY($1::uuid[])', [testOrderIds]);
      stats.testStockMovementsDeleted += o4.rowCount;
      const o5 = await client.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [testOrderIds]);
      stats.testOrdersDeleted = o5.rowCount;
    }

    if (dirtyVariantIds.length > 0) {
      const v1 = await client.query('DELETE FROM stock_movements WHERE variant_id = ANY($1::uuid[])', [dirtyVariantIds]);
      stats.testStockMovementsDeleted += v1.rowCount;
      const v2 = await client.query('DELETE FROM cart_items WHERE variant_id = ANY($1::uuid[])', [dirtyVariantIds]);
      stats.testCartItemsDeleted = v2.rowCount;
      const v3 = await client.query('DELETE FROM inventory_items WHERE variant_id = ANY($1::uuid[])', [dirtyVariantIds]);
      stats.testInventoryDeleted = v3.rowCount;
      const v4 = await client.query('DELETE FROM product_variants WHERE id = ANY($1::uuid[])', [dirtyVariantIds]);
      stats.testVariantsDeleted = v4.rowCount;
    }

    if (dirtyProductIds.length > 0) {
      const p1 = await client.query('DELETE FROM product_images WHERE product_id = ANY($1::uuid[])', [dirtyProductIds]);
      stats.testImagesDeleted = p1.rowCount;
      const p2 = await client.query('DELETE FROM products WHERE id = ANY($1::uuid[])', [dirtyProductIds]);
      stats.testProductsDeleted = p2.rowCount;
    }

    if (dirtyBrandIds.length > 0) {
      const b1 = await client.query('DELETE FROM brands WHERE id = ANY($1::uuid[])', [dirtyBrandIds]);
      stats.dirtyBrandsDeleted = b1.rowCount;
    }
    if (dirtySubcategoryIds.length > 0) {
      const s1 = await client.query('DELETE FROM subcategories WHERE id = ANY($1::uuid[])', [dirtySubcategoryIds]);
      stats.dirtySubcategoriesDeleted = s1.rowCount;
    }
    if (dirtyCategoryIds.length > 0) {
      const c1 = await client.query('DELETE FROM categories WHERE id = ANY($1::uuid[])', [dirtyCategoryIds]);
      stats.dirtyCategoriesDeleted = c1.rowCount;
    }

    // Delete test sizes/colors
    const s2 = await client.query('DELETE FROM sizes WHERE name LIKE \'Size-%\' OR name ~ \'-\\d{13}$\'');
    stats.testSizesDeleted = s2.rowCount;
    const c2 = await client.query('DELETE FROM colors WHERE name LIKE \'Crimson-%\' OR name ~ \'-\\d{13}$\'');
    stats.testColorsDeleted = c2.rowCount;

    // ---------------------------------------------------------
    // 5. RETIRE OLD SEEDED TAXONOMY
    // ---------------------------------------------------------
    const retiredSubcatRes = await client.query(`
      DELETE FROM subcategories
      WHERE slug IN ('apparel-shirts', 'apparel-activewear', 'apparel-trousers', 'footwear-formal')
    `);
    stats.retiredSubcategoriesDeleted = retiredSubcatRes.rowCount;

    const retiredCatRes = await client.query(`
      DELETE FROM categories
      WHERE slug = 'apparel'
    `);
    stats.retiredCategoriesDeleted = retiredCatRes.rowCount;

    // Report Summary
    console.log('\n==================================================');
    console.log('            MIGRATION PREVIEW RESULTS             ');
    console.log('==================================================');
    console.log(`New Categories Inserted    : ${stats.categoriesInserted}`);
    console.log(`New Subcategories Inserted : ${stats.subcategoriesInserted}`);
    console.log(`Test Products Deleted      : ${stats.testProductsDeleted}`);
    console.log(`Test Variants Deleted      : ${stats.testVariantsDeleted}`);
    console.log(`Test Images Deleted        : ${stats.testImagesDeleted}`);
    console.log(`Test Inventory Deleted     : ${stats.testInventoryDeleted}`);
    console.log(`Test Stock Movements Del   : ${stats.testStockMovementsDeleted}`);
    console.log(`Test Cart Items Deleted    : ${stats.testCartItemsDeleted}`);
    console.log(`Test Orders Deleted        : ${stats.testOrdersDeleted} (Items: ${stats.testOrderItemsDeleted}, Status: ${stats.testOrderStatusDeleted})`);
    console.log(`Test Returns Deleted       : ${stats.testReturnsDeleted} (Items: ${stats.testReturnItemsDeleted}, Status: ${stats.testReturnStatusDeleted})`);
    console.log(`Dirty Brands Deleted       : ${stats.dirtyBrandsDeleted}`);
    console.log(`Dirty Sizes Deleted        : ${stats.testSizesDeleted}`);
    console.log(`Dirty Colors Deleted       : ${stats.testColorsDeleted}`);
    console.log(`Retired Categories Deleted : ${stats.retiredCategoriesDeleted}`);
    console.log(`Retired Subcategories Del  : ${stats.retiredSubcategoriesDeleted}`);
    console.log('\n--- Products Remapped ---');
    stats.productsRemapped.forEach(p => {
      console.log(` * "${p.title}" -> "${p.category}" / "${p.subcategory}"`);
    });
    console.log('==================================================\n');

    if (isDryRun) {
      console.log('Performing ROLLBACK in dry-run mode...');
      await client.query('ROLLBACK');
      console.log('ROLLBACK completed successfully. Database is unchanged.');
    } else {
      console.log('Performing COMMIT in execute mode...');
      await client.query('COMMIT');
      console.log('COMMIT completed successfully. Changes are permanent.');
    }
  } catch (err) {
    console.error('An error occurred during transaction. Rolling back...', err);
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
