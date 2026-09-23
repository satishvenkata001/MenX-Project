import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function assert(desc, condition) {
  if (condition) {
    console.log(` [PASS] ${desc}`);
  } else {
    console.error(` [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runLowStockGroupingTests() {
  console.log('================================================================');
  console.log('       MENX — LOW STOCK GROUPING BY PRODUCT TEST SUITE');
  console.log('================================================================');

  const server = http.createServer(app);
  await new Promise(res => server.listen(0, res));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}`);

  const testTimestamp = Date.now();
  const testCleanup = {
    categoryIds: [],
    productIds: [],
    variantIds: [],
    inventoryIds: [],
    userIds: []
  };

  try {
    // 1. Setup Auth Admin User
    const adminEmail = `admin.lowstock.${testTimestamp}@menxfashion.com`;
    const password = 'Password123!Secure';

    const { data: adminAuth, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'LowStockAdmin', last_name: 'Tester' }
    });
    if (adminAuthErr) throw new Error(`Admin creation failed: ${adminAuthErr.message}`);
    const adminUserId = adminAuth.user.id;
    testCleanup.userIds.push(adminUserId);

    await new Promise(r => setTimeout(r, 300));
    await supabaseAdmin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', adminUserId);

    const adminClient = createAuthClient();
    const { data: adminLogin, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (adminLoginErr) throw new Error(`Admin login failed: ${adminLoginErr.message}`);
    const adminToken = adminLogin.session.access_token;

    // 2. Setup Category & Subcategory
    const { data: cat } = await supabaseAdmin.from('categories').insert({
      name: `LowStock Test Cat ${testTimestamp}`,
      slug: `lowstock-cat-${testTimestamp}`,
      is_active: true
    }).select().single();
    testCleanup.categoryIds.push(cat.id);

    const { data: sub } = await supabaseAdmin.from('subcategories').insert({
      category_id: cat.id,
      name: `LowStock Sub ${testTimestamp}`,
      slug: `lowstock-sub-${testTimestamp}`,
      is_active: true
    }).select().single();

    // 3. Fetch Distinct Sizes and Colors
    const { data: sizes } = await supabaseAdmin.from('sizes').select('id, name').limit(3);
    const { data: colors } = await supabaseAdmin.from('colors').select('id, name').limit(3);
    const sizeS = sizes[0];
    const sizeM = sizes[1];
    const sizeL = sizes[2];
    const colorNavy = colors[0];
    const colorBlack = colors[1];
    const colorWhite = colors[2];

    // -------------------------------------------------------------------------
    // TEST FIXTURES:
    // Product A: 2 low-stock variants, 1 healthy variant
    // Product B: 1 low-stock variant (available = 0), 1 healthy variant
    // Product C: 2 healthy variants ONLY (no low-stock)
    // -------------------------------------------------------------------------

    // Product A
    const { data: prodA } = await supabaseAdmin.from('products').insert({
      title: `Product A Grouping Test ${testTimestamp}`,
      slug: `product-a-${testTimestamp}`,
      description: 'Product A with multiple low-stock and healthy variants',
      category_id: cat.id,
      subcategory_id: sub.id,
      status: 'PUBLISHED',
      base_mrp: 1999,
      base_price: 1499
    }).select().single();
    testCleanup.productIds.push(prodA.id);

    // Prod A - Variant 1 (Low stock: avail 3 <= threshold 10)
    const { data: varA1 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prodA.id,
      size_id: sizeS.id,
      color_id: colorNavy.id,
      sku: `PROD-A-V1-${testTimestamp}`,
      barcode: `1001${testTimestamp.toString().slice(-8)}`,
      mrp: 1999,
      selling_price: 1499,
      low_stock_threshold: 10,
      is_active: true
    }).select().single();
    testCleanup.variantIds.push(varA1.id);

    const { data: invA1 } = await supabaseAdmin.from('inventory_items').insert({
      variant_id: varA1.id,
      quantity_available: 3,
      quantity_reserved: 0,
      quantity_damaged: 0
    }).select().single();
    testCleanup.inventoryIds.push(invA1.id);

    // Prod A - Variant 2 (Low stock: avail 5 <= threshold 10)
    const { data: varA2 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prodA.id,
      size_id: sizeM.id,
      color_id: colorNavy.id,
      sku: `PROD-A-V2-${testTimestamp}`,
      barcode: `1002${testTimestamp.toString().slice(-8)}`,
      mrp: 1999,
      selling_price: 1499,
      low_stock_threshold: 10,
      is_active: true
    }).select().single();
    testCleanup.variantIds.push(varA2.id);

    const { data: invA2 } = await supabaseAdmin.from('inventory_items').insert({
      variant_id: varA2.id,
      quantity_available: 5,
      quantity_reserved: 1,
      quantity_damaged: 0
    }).select().single();
    testCleanup.inventoryIds.push(invA2.id);

    // Prod A - Variant 3 (HEALTHY: avail 25 > threshold 10)
    const { data: varA3 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prodA.id,
      size_id: sizeL.id,
      color_id: colorNavy.id,
      sku: `PROD-A-V3-HEALTHY-${testTimestamp}`,
      barcode: `1003${testTimestamp.toString().slice(-8)}`,
      mrp: 1999,
      selling_price: 1499,
      low_stock_threshold: 10,
      is_active: true
    }).select().single();
    testCleanup.variantIds.push(varA3.id);

    const { data: invA3 } = await supabaseAdmin.from('inventory_items').insert({
      variant_id: varA3.id,
      quantity_available: 25,
      quantity_reserved: 0,
      quantity_damaged: 0
    }).select().single();
    testCleanup.inventoryIds.push(invA3.id);

    // Product B (1 zero-stock variant, 1 healthy variant)
    const { data: prodB } = await supabaseAdmin.from('products').insert({
      title: `Product B Grouping Test ${testTimestamp}`,
      slug: `product-b-${testTimestamp}`,
      description: 'Product B with zero stock variant',
      category_id: cat.id,
      subcategory_id: sub.id,
      status: 'PUBLISHED',
      base_mrp: 1299,
      base_price: 999
    }).select().single();
    testCleanup.productIds.push(prodB.id);

    // Prod B - Variant 1 (OUT OF STOCK: avail 0 <= threshold 5)
    const { data: varB1 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prodB.id,
      size_id: sizeS.id,
      color_id: colorBlack.id,
      sku: `PROD-B-V1-ZERO-${testTimestamp}`,
      barcode: `2001${testTimestamp.toString().slice(-8)}`,
      mrp: 1299,
      selling_price: 999,
      low_stock_threshold: 5,
      is_active: true
    }).select().single();
    testCleanup.variantIds.push(varB1.id);

    const { data: invB1 } = await supabaseAdmin.from('inventory_items').insert({
      variant_id: varB1.id,
      quantity_available: 0,
      quantity_reserved: 0,
      quantity_damaged: 0
    }).select().single();
    testCleanup.inventoryIds.push(invB1.id);

    // Prod B - Variant 2 (HEALTHY: avail 15 > threshold 5)
    const { data: varB2 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prodB.id,
      size_id: sizeM.id,
      color_id: colorBlack.id,
      sku: `PROD-B-V2-HEALTHY-${testTimestamp}`,
      barcode: `2002${testTimestamp.toString().slice(-8)}`,
      mrp: 1299,
      selling_price: 999,
      low_stock_threshold: 5,
      is_active: true
    }).select().single();
    testCleanup.variantIds.push(varB2.id);

    const { data: invB2 } = await supabaseAdmin.from('inventory_items').insert({
      variant_id: varB2.id,
      quantity_available: 15,
      quantity_reserved: 0,
      quantity_damaged: 0
    }).select().single();
    testCleanup.inventoryIds.push(invB2.id);

    // Product C (ALL HEALTHY)
    const { data: prodC } = await supabaseAdmin.from('products').insert({
      title: `Product C Healthy Test ${testTimestamp}`,
      slug: `product-c-${testTimestamp}`,
      description: 'Product C with all healthy variants',
      category_id: cat.id,
      subcategory_id: sub.id,
      status: 'PUBLISHED',
      base_mrp: 2499,
      base_price: 1999
    }).select().single();
    testCleanup.productIds.push(prodC.id);

    const { data: varC1 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prodC.id,
      size_id: sizeS.id,
      color_id: colorWhite.id,
      sku: `PROD-C-V1-HEALTHY-${testTimestamp}`,
      barcode: `3001${testTimestamp.toString().slice(-8)}`,
      mrp: 2499,
      selling_price: 1999,
      low_stock_threshold: 5,
      is_active: true
    }).select().single();
    testCleanup.variantIds.push(varC1.id);

    const { data: invC1 } = await supabaseAdmin.from('inventory_items').insert({
      variant_id: varC1.id,
      quantity_available: 50,
      quantity_reserved: 0,
      quantity_damaged: 0
    }).select().single();
    testCleanup.inventoryIds.push(invC1.id);

    // -------------------------------------------------------------------------
    // EXECUTE API TEST: GET /api/v1/admin/inventory/low-stock
    // -------------------------------------------------------------------------
    console.log('\n>>> 1. Fetching Low Stock Warnings via API...');
    const res = await fetch(`${baseUrl}/admin/inventory/low-stock?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const body = await res.json();

    await assert('HTTP Status 200 OK', res.status === 200);
    await assert('Response contains products array', Array.isArray(body.data?.products));

    const products = body.data.products;

    // 1. Check Product A Grouping
    const foundProdA = products.find(p => p.productId === prodA.id);
    await assert('Product A appears in low stock warnings', !!foundProdA);
    await assert('Product A appears only ONCE in products array', products.filter(p => p.productId === prodA.id).length === 1);
    await assert('Product A has lowStockVariantCount === 2', foundProdA?.lowStockVariantCount === 2);
    await assert('Product A variants array length === 2', foundProdA?.variants?.length === 2);

    // 2. Verify only low-stock variants are included in Product A
    const prodAVariantIds = foundProdA?.variants.map(v => v.variantId);
    await assert('Product A includes low-stock Variant 1 (3 units)', prodAVariantIds.includes(varA1.id));
    await assert('Product A includes low-stock Variant 2 (5 units)', prodAVariantIds.includes(varA2.id));
    await assert('Product A EXCLUDES healthy Variant 3 (25 units)', !prodAVariantIds.includes(varA3.id));

    // 3. Verify Product B Grouping & Zero Stock Handling
    const foundProdB = products.find(p => p.productId === prodB.id);
    await assert('Product B appears in low stock warnings', !!foundProdB);
    await assert('Product B has lowStockVariantCount === 1', foundProdB?.lowStockVariantCount === 1);
    const prodBZeroVariant = foundProdB?.variants.find(v => v.variantId === varB1.id);
    await assert('Product B includes zero stock variant with availableStock === 0', prodBZeroVariant?.availableStock === 0);
    await assert('Product B zero stock variant has status OUT_OF_STOCK', prodBZeroVariant?.status === 'OUT_OF_STOCK');
    await assert('Product B EXCLUDES healthy Variant 2 (15 units)', !foundProdB?.variants.some(v => v.variantId === varB2.id));

    // 4. Verify Product C is Completely Excluded
    const foundProdC = products.find(p => p.productId === prodC.id);
    await assert('Product C (all healthy variants) is completely EXCLUDED from low stock warnings', !foundProdC);

    // 5. Verify Severity Sorting (Zero stock Product B comes before Product A)
    const indexProdB = products.findIndex(p => p.productId === prodB.id);
    const indexProdA = products.findIndex(p => p.productId === prodA.id);
    await assert('Product with most critical shortage (0 stock) is sorted before less critical shortages', indexProdB < indexProdA);

    // 6. Verify Variant Sorting within Product A (Variant 1: 3/10 before Variant 2: 5/10)
    await assert('Within Product A, Variant 1 (3 units) is sorted before Variant 2 (5 units)', foundProdA.variants[0].variantId === varA1.id);

    // 7. Verify Summary Counts
    await assert('totalProducts is a positive number', typeof body.data.totalProducts === 'number' && body.data.totalProducts >= 2);
    await assert('totalVariants is a positive number', typeof body.data.totalVariants === 'number' && body.data.totalVariants >= 3);

    // 8. Verify Search Filtering
    const searchRes = await fetch(`${baseUrl}/admin/inventory/low-stock?search=Product+A`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const searchBody = await searchRes.json();
    await assert('Search returns filtered product matching term', searchBody.data?.products?.some(p => p.productId === prodA.id));
    await assert('Search excludes non-matching products', !searchBody.data?.products?.some(p => p.productId === prodB.id));

    console.log('\n================================================================');
    console.log('ALL LOW STOCK GROUPING TESTS PASSED (14 / 14 ASSERTIONS)!');
    console.log('================================================================');
  } finally {
    console.log('\n>>> Cleaning up temporary test fixtures...');
    try {
      if (testCleanup.inventoryIds.length > 0) {
        await supabaseAdmin.from('inventory_items').delete().in('id', testCleanup.inventoryIds);
      }
      if (testCleanup.variantIds.length > 0) {
        await supabaseAdmin.from('product_variants').delete().in('id', testCleanup.variantIds);
      }
      if (testCleanup.productIds.length > 0) {
        await supabaseAdmin.from('products').delete().in('id', testCleanup.productIds);
      }
      if (testCleanup.categoryIds.length > 0) {
        await supabaseAdmin.from('subcategories').delete().in('category_id', testCleanup.categoryIds);
        await supabaseAdmin.from('categories').delete().in('id', testCleanup.categoryIds);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup error (non-fatal):', cleanupErr.message);
    }
    server.close();
  }
}

runLowStockGroupingTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
