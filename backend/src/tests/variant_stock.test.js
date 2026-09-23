import http from 'http';
import app from '../app.js';
import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING VARIANT INITIAL STOCK & INVENTORY TESTS (STORELESS)');
  console.log('================================================================');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  const ts = Date.now();

  let adminUser = null;
  let custUser = null;
  let testProduct = null;
  let dataA = null;
  let dataB = null;

  try {
    // Create super admin for test
    const { data: createdAdmin } = await supabaseAdmin.auth.admin.createUser({
      email: `admin-stock-test-${ts}@menx.com`,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', full_name: 'Admin Stock Test' }
    });
    adminUser = createdAdmin;

    await supabaseAdmin
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', adminUser.user.id);

    const authClient = createAuthClient();
    const { data: adminLogin } = await authClient.auth.signInWithPassword({
      email: adminUser.user.email,
      password: 'Password123!'
    });
    const adminToken = adminLogin.session.access_token;

    // 1. Get valid fixtures
    const { data: category } = await supabaseAdmin.from('categories').select('id').eq('slug', 'shirts').single();
    const { data: subcategory } = await supabaseAdmin.from('subcategories').select('id').eq('category_id', category.id).limit(1).single();
    const { data: brand } = await supabaseAdmin.from('brands').select('id').limit(1).single();
    const { data: apparelSize } = await supabaseAdmin.from('sizes').select('id').eq('category_type', 'APPAREL').eq('name', 'L').single();
    const { data: color } = await supabaseAdmin.from('colors').select('id').eq('name', 'Charcoal Black').single();

    // Create a test product
    const prodRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: `Test Stock Product ${ts}`,
        slug: `test-stock-product-${ts}`,
        description: 'Testing initial stock feature',
        categoryId: category.id,
        subcategoryId: subcategory.id,
        brandId: brand.id,
        baseMrp: 1999,
        basePrice: 1499,
        status: 'PUBLISHED'
      })
    });
    const prodData = await prodRes.json();
    testProduct = prodData.data;
    assert(prodRes.status === 201 && testProduct?.id, `J. Product created successfully: ${testProduct?.title}`);

    // Test A: Create variant with initialStock = 25
    const skuA = `TEST-STOCK-A-${ts}`;
    const resA = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: apparelSize.id,
        colorId: color.id,
        sku: skuA,
        barcode: `890${ts.toString().slice(-9)}`,
        mrp: 1999,
        sellingPrice: 1499,
        initialStock: 25
      })
    });
    dataA = await resA.json();
    assert(resA.status === 201, `A1. Variant created with HTTP 201: ${dataA.data?.sku}`);
    assert(dataA.data?.availableStock === 25, `A2. Variant response has availableStock = 25`);
    assert(dataA.data?.availability === 'IN_STOCK', `A3. Variant response has availability = IN_STOCK`);

    // Check database for inventory_items and stock_movements
    const { data: invRowA } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('variant_id', dataA.data.id)
      .single();
    assert(invRowA && invRowA.quantity_available === 25, `A4. inventory_items created with quantity_available = 25`);

    const { data: moveRowA } = await supabaseAdmin
      .from('stock_movements')
      .select('*')
      .eq('variant_id', dataA.data.id)
      .single();
    assert(moveRowA && moveRowA.quantity === 25 && (moveRowA.movement_type === 'INITIAL_STOCK' || moveRowA.movement_type === 'PURCHASE_RECEIPT'), `A5. stock_movements created with quantity = 25`);

    // Test B: Create variant with initialStock = 0
    const { data: sizeS } = await supabaseAdmin.from('sizes').select('id').eq('category_type', 'APPAREL').eq('name', 'S').single();
    const skuB = `TEST-STOCK-B-${ts}`;
    const resB = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: sizeS.id,
        colorId: color.id,
        sku: skuB,
        barcode: `891${ts.toString().slice(-9)}`,
        mrp: 1999,
        sellingPrice: 1499,
        initialStock: 0
      })
    });
    dataB = await resB.json();
    assert(resB.status === 201, `B1. Variant with initialStock=0 created with HTTP 201`);
    assert(dataB.data?.availableStock === 0, `B2. Variant availableStock = 0`);
    assert(dataB.data?.availability === 'OUT_OF_STOCK', `B3. Variant availability = OUT_OF_STOCK`);

    // Test C: Negative initialStock -> HTTP 400
    const skuC = `TEST-STOCK-C-${ts}`;
    const resC = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: apparelSize.id,
        colorId: color.id,
        sku: skuC,
        barcode: `892${ts.toString().slice(-9)}`,
        mrp: 1999,
        sellingPrice: 1499,
        initialStock: -10
      })
    });
    assert(resC.status === 400, `C. Negative initialStock rejected with HTTP 400`);

    // Test D: Decimal initialStock -> HTTP 400
    const skuD = `TEST-STOCK-D-${ts}`;
    const resD = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: apparelSize.id,
        colorId: color.id,
        sku: skuD,
        barcode: `893${ts.toString().slice(-9)}`,
        mrp: 1999,
        sellingPrice: 1499,
        initialStock: 12.5
      })
    });
    assert(resD.status === 400, `D. Decimal initialStock rejected with HTTP 400`);

    // Test G: Adjust existing variant stock via POST /api/v1/admin/inventory/adjust
    const adjustRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: dataB.data.id,
        quantity: 15,
        movementType: 'PURCHASE_RECEIPT',
        reason: 'Manual adjustment test'
      })
    });
    assert(adjustRes.status === 200, `G1. Stock adjustment API returned HTTP 200`);

    const { data: invRowB } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('variant_id', dataB.data.id)
      .single();
    assert(invRowB && invRowB.quantity_available === 15, `G2. Adjusted variant now has quantity_available = 15`);

    // Test H: Product detail returns correct stock
    const detailRes = await fetch(`${baseUrl}/products/${testProduct.slug}`);
    const detailData = await detailRes.json();
    const variantADetail = detailData.data?.variants?.find(v => v.id === dataA.data.id);
    const variantBDetail = detailData.data?.variants?.find(v => v.id === dataB.data.id);
    assert(variantADetail?.availableStock === 25 && variantADetail?.availability === 'IN_STOCK', `H1. Variant A on storefront has availableStock = 25 and IN_STOCK`);
    assert(variantBDetail?.availableStock === 15 && variantBDetail?.availability === 'IN_STOCK', `H2. Variant B on storefront has availableStock = 15 and IN_STOCK`);

    // Test I: Customer Cart operations
    const custEmail = `cust-stock-test-${ts}@menx.com`;
    const { data: createdCust } = await supabaseAdmin.auth.admin.createUser({
      email: custEmail,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { role: 'CUSTOMER', full_name: 'Customer Stock Test' }
    });
    custUser = createdCust;

    const { data: custLogin } = await authClient.auth.signInWithPassword({
      email: custEmail,
      password: 'Password123!'
    });
    const custToken = custLogin?.session?.access_token;

    if (custToken) {
      const cartRes = await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${custToken}`
        },
        body: JSON.stringify({
          variantId: dataA.data.id,
          quantity: 2
        })
      });
      const cartData = await cartRes.json();
      assert((cartRes.status === 200 || cartRes.status === 201) && cartData.data?.items?.length > 0, `I. In-stock variant added to cart successfully`);
    }

    // Test K: Category -> Subcategory dependency still works
    const subcatRes = await fetch(`${baseUrl}/subcategories?category_id=${category.id}`);
    const subcatData = await subcatRes.json();
    const allMatchCategory = (subcatData.data || []).every(s => s.category_id === category.id);
    assert(subcatRes.status === 200 && allMatchCategory, `K. Subcategories filtered correctly by category_id`);

    // Test L: Live inventory fetch for Edit Variant workflow
    const invFetchRes = await fetch(`${baseUrl}/admin/inventory?variantId=${dataA.data.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const invFetchData = await invFetchRes.json();
    const invItems = invFetchData.data?.items || invFetchData.data || [];
    assert(invFetchRes.status === 200 && invItems.length > 0, `L1. Admin inventory query for variant returns inventory row`);
    assert(invItems[0]?.stock?.available === 25, `L2. Inventory item stock available matches 25`);

    // Test M: Edit Variant specs update does NOT modify stock
    const updateSpecRes = await fetch(`${baseUrl}/admin/variants/${dataA.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sku: `UPDATED-${skuA}`,
        sellingPrice: 1399,
        lowStockThreshold: 8
      })
    });
    assert(updateSpecRes.status === 200, `M1. Variant specs updated successfully`);
    
    const { data: invRowAAfterSpecUpdate } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available')
      .eq('variant_id', dataA.data.id)
      .single();
    assert(invRowAAfterSpecUpdate?.quantity_available === 25, `M2. Variant stock remains 25 after specifications update`);

    // Test N: Excessive negative adjustment rejected
    const negExcessRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: dataA.data.id,
        quantity: -50,
        movementType: 'INVENTORY_ADJUSTMENT',
        reason: 'Excess deduction test'
      })
    });
    assert(negExcessRes.status === 400, `N1. Excessive negative adjustment rejected with HTTP 400`);

    // Test O: Valid negative adjustment succeeds
    const validNegRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: dataA.data.id,
        quantity: -5,
        movementType: 'INVENTORY_ADJUSTMENT',
        reason: 'Valid deduction test'
      })
    });
    assert(validNegRes.status === 200, `O1. Valid negative adjustment succeeded with HTTP 200`);

    const { data: invRowAAfterDeduct } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available')
      .eq('variant_id', dataA.data.id)
      .single();
    assert(invRowAAfterDeduct?.quantity_available === 20, `O2. Variant stock is now 20 after deduction`);

  } catch (err) {
    console.error('Test execution error in variant_stock.test.js:', err);
  } finally {
    console.log('\n>>> Cleaning up variant_stock test fixtures...');
    const vIds = [dataA?.data?.id, dataB?.data?.id].filter(Boolean);
    if (vIds.length > 0) {
      try { await supabaseAdmin.from('cart_items').delete().in('variant_id', vIds); } catch (e) {}
      try { await supabaseAdmin.from('stock_movements').delete().in('variant_id', vIds); } catch (e) {}
      try { await supabaseAdmin.from('inventory_items').delete().in('variant_id', vIds); } catch (e) {}
      try { await supabaseAdmin.from('product_variants').delete().in('id', vIds); } catch (e) {}
    }
    if (testProduct?.id) {
      try { await supabaseAdmin.from('products').delete().eq('id', testProduct.id); } catch (e) {}
    }
    if (custUser?.user?.id) {
      try { await supabaseAdmin.from('carts').delete().eq('user_id', custUser.user.id); } catch (e) {}
      try { await supabaseAdmin.from('profiles').delete().eq('id', custUser.user.id); } catch (e) {}
      try { await supabaseAdmin.auth.admin.deleteUser(custUser.user.id); } catch (e) {}
    }
    if (adminUser?.user?.id) {
      try { await supabaseAdmin.from('profiles').delete().eq('id', adminUser.user.id); } catch (e) {}
      try { await supabaseAdmin.auth.admin.deleteUser(adminUser.user.id); } catch (e) {}
    }
    server.close();

    console.log(`\nTests finished: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
      process.exit(1);
    }
  }
}

runTests().catch(err => {
  console.error('Fatal error in variant_stock.test.js:', err);
  process.exit(1);
});
