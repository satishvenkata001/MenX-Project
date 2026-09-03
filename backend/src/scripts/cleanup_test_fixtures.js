import { supabaseAdmin } from '../config/supabase.js';
import { CatalogService } from '../services/catalog.service.js';

/**
 * MENX Controlled Safe Test Fixture Cleanup Script
 *
 * Usage:
 *   node src/scripts/cleanup_test_fixtures.js --dry-run
 *   node src/scripts/cleanup_test_fixtures.js --execute
 */

const PROTECTED_CATEGORIES = new Set([
  'footwear',
  'accessories',
  't-shirts',
  'shirts',
  'jeans',
  'trousers',
  'shorts',
  'jackets',
  'ethnic-wear',
  'activewear'
]);

async function main() {
  const isExecute = process.argv.includes('--execute');
  const isDryRun = process.argv.includes('--dry-run') || !isExecute;

  console.log('================================================================');
  console.log(`MENX SAFE TEST FIXTURE CLEANUP ${isExecute ? '[EXECUTION MODE]' : '[DRY RUN MODE]'}`);
  console.log('================================================================\n');

  if (isDryRun) {
    console.log('NOTE: Running in DRY RUN mode. No records will be deleted.');
    console.log('To execute the deletion, pass the "--execute" flag.\n');
  }

  // 1. Fetch all products and identify test fixtures
  const { data: allProducts, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, title, slug, category_id, created_at')
    .order('created_at', { ascending: true });

  if (prodErr) {
    console.error('Failed to fetch products:', prodErr.message);
    process.exit(1);
  }

  const testProducts = (allProducts || []).filter(p => {
    // Explicit timestamp test patterns
    const isTimestampSlug = /-\d{10,}/.test(p.slug);
    const isTestPrefix = p.slug.startsWith('f4f-test-product-') ||
                         p.slug.startsWith('f4g-test-product-') ||
                         p.slug.startsWith('oos-test-shirt-') ||
                         p.slug.startsWith('draft-unreleased-polo-') ||
                         p.slug.startsWith('classic-pique-polo-1788') ||
                         p.slug.startsWith('crimson-premium-shirt-1788') ||
                         p.slug.startsWith('draft-shirt-1788');
    return isTimestampSlug || isTestPrefix;
  });

  // 2. Fetch all categories and identify test fixtures
  const { data: allCategories, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true });

  if (catErr) {
    console.error('Failed to fetch categories:', catErr.message);
    process.exit(1);
  }

  const testCategories = (allCategories || []).filter(c => {
    // Protect core categories
    if (PROTECTED_CATEGORIES.has(c.slug.toLowerCase())) {
      return false;
    }
    const isTimestamp = /-\d{10,}/.test(c.slug) || /-\d{10,}/.test(c.name);
    const isApparelTest = c.name.startsWith('Apparel-') || c.slug.startsWith('apparel-1788');
    return isTimestamp || isApparelTest;
  });

  console.log(`[SCAN RESULTS]`);
  console.log(`• Test Products Found: ${testProducts.length}`);
  testProducts.forEach(p => {
    console.log(`   - [Product] "${p.title}" (slug: ${p.slug}, ID: ${p.id})`);
  });

  console.log(`\n• Test Categories Found: ${testCategories.length}`);
  testCategories.forEach(c => {
    console.log(`   - [Category] "${c.name}" (slug: ${c.slug}, ID: ${c.id})`);
  });

  if (testProducts.length === 0 && testCategories.length === 0) {
    console.log('\n✅ No orphaned test fixtures found. Database is clean!');
    process.exit(0);
  }

  if (isDryRun) {
    console.log('\n[DRY RUN SUMMARY]');
    console.log(`Will delete ${testProducts.length} test products and ${testCategories.length} test categories.`);
    console.log('To perform deletion safely, run:');
    console.log('node src/scripts/cleanup_test_fixtures.js --execute\n');
    process.exit(0);
  }

  console.log('\n[EXECUTING SAFE DELETION]');

  // Step A: Purge test orders and references for test products
  for (const prod of testProducts) {
    try {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('id')
        .eq('product_id', prod.id);

      if (variants && variants.length > 0) {
        const varIds = variants.map(v => v.id);
        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('id, order_id')
          .in('variant_id', varIds);

        if (orderItems && orderItems.length > 0) {
          const ordIds = [...new Set(orderItems.map(o => o.order_id))];
          console.log(`  Cleaning up ${ordIds.length} test orders referencing test product "${prod.title}"...`);
          try { await supabaseAdmin.from('return_status_history').delete().in('order_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('return_items').delete().in('order_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('return_requests').delete().in('order_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('order_status_history').delete().in('order_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('order_items').delete().in('order_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('coupon_redemptions').delete().in('order_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('stock_movements').delete().in('reference_id', ordIds); } catch (e) {}
          try { await supabaseAdmin.from('orders').delete().in('id', ordIds); } catch (e) {}
        }
      }
    } catch (ordErr) {
      console.warn(`  ⚠ Order cleanup warning for ${prod.title}:`, ordErr.message);
    }
  }

  // Step B: Delete test products first using CatalogService
  let deletedProductsCount = 0;
  for (const prod of testProducts) {
    try {
      console.log(`Deleting test product: "${prod.title}" (${prod.id})...`);
      await CatalogService.deleteProduct(prod.id, { id: '00000000-0000-0000-0000-000000000000', role: 'SUPER_ADMIN' }, null, { ip: '127.0.0.1', userAgent: 'cleanup-script' });
      deletedProductsCount++;
      console.log(`  ✓ Successfully deleted product "${prod.title}"`);
    } catch (err) {
      console.warn(`  ⚠ Could not delete product "${prod.title}" (${prod.id}): ${err.message}`);
    }
  }

  // Step C: Delete test categories using CatalogService
  let deletedCategoriesCount = 0;
  for (const cat of testCategories) {
    try {
      console.log(`Deleting test category: "${cat.name}" (${cat.id})...`);
      await CatalogService.deleteCategory(cat.id, { id: '00000000-0000-0000-0000-000000000000', role: 'SUPER_ADMIN' }, null, { ip: '127.0.0.1', userAgent: 'cleanup-script' });
      deletedCategoriesCount++;
      console.log(`  ✓ Successfully deleted category "${cat.name}"`);
    } catch (err) {
      console.warn(`  ⚠ Could not delete category "${cat.name}" (${cat.id}): ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log(`CLEANUP COMPLETE: ${deletedProductsCount} products, ${deletedCategoriesCount} categories deleted.`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('[FATAL CLEANUP ERROR]', err);
  process.exit(1);
});
