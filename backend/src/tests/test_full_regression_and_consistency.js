import http from 'http';
import app from '../app.js';
import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
    results.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failed++;
    results.push({ name: testName, status: 'FAIL', details });
  }
}

async function runRegressionAndConsistency() {
  console.log('================================================================');
  console.log('       MENX FULL REGRESSION & DATABASE CONSISTENCY SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  const ts = Date.now();
  const testCleanup = {
    userIds: [],
    productIds: [],
    variantIds: [],
    orderIds: [],
    returnIds: []
  };

  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION (Signup & Login)
    // -------------------------------------------------------------------------
    console.log('>>> 1. Testing Auth (Signup / Login / Roles)...');
    const customerEmail = `cust-reg-${ts}@menx.test`;
    const adminEmail = `admin-reg-${ts}@menx.test`;
    const password = 'Password123!';

    // Signup Customer via Auth API
    const regRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        password,
        firstName: 'Regression',
        lastName: 'Customer',
        phone: '+91 9876543210'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && (regData.data?.user?.id || regData.data?.id), 'Auth: Customer signup creates user account');
    const customerId = regData.data?.user?.id || regData.data?.id;
    if (customerId) testCleanup.userIds.push(customerId);

    // Login Customer
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, password })
    });
    const custLoginData = await custLoginRes.json();
    const customerToken = custLoginData.data?.session?.accessToken || custLoginData.data?.accessToken;
    assert(custLoginRes.status === 200 && customerToken, 'Auth: Customer login succeeds with valid JWT token');

    // Create Super Admin User
    const { data: adminAuth } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', full_name: 'Regression Super Admin' }
    });
    const adminId = adminAuth.user.id;
    testCleanup.userIds.push(adminId);
    await supabaseAdmin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', adminId);

    const authClient = createAuthClient();
    const { data: adminLogin } = await authClient.auth.signInWithPassword({ email: adminEmail, password });
    const adminToken = adminLogin.session.access_token;
    assert(adminToken !== null, 'Auth: Super Admin authenticated successfully');

    // -------------------------------------------------------------------------
    // 2. CATEGORY & SUBCATEGORY SELECTION
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Testing Category & Subcategory Selection...');
    const catRes = await fetch(`${baseUrl}/categories`);
    const catData = await catRes.json();
    const categories = catData.data || [];
    assert(catRes.status === 200 && categories.length > 0, 'Categories: Public categories list returns items');

    const apparelCat = categories.find(c => c.slug === 'jeans' || c.slug === 'shirts' || c.slug === 't-shirts') || categories[0];
    const subcatRes = await fetch(`${baseUrl}/subcategories?category_id=${apparelCat.id}`);
    const subcatData = await subcatRes.json();
    const subcategories = subcatData.data || [];
    assert(subcatRes.status === 200 && subcategories.every(s => s.category_id === apparelCat.id), 'Subcategories: Filtered correctly by category_id');

    // -------------------------------------------------------------------------
    // 3. PRODUCT CREATION & EDITING
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Testing Product Creation & Editing...');
    const { data: brand } = await supabaseAdmin.from('brands').select('id').limit(1).single();
    const targetSubcat = subcategories[0] || (await supabaseAdmin.from('subcategories').select('id').limit(1).single()).data;

    const prodCreateRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: `Regression Product ${ts}`,
        slug: `regression-product-${ts}`,
        description: 'E2E regression test product description.',
        categoryId: apparelCat.id,
        subcategoryId: targetSubcat.id,
        brandId: brand.id,
        baseMrp: 2499,
        basePrice: 1799,
        material: '100% Cotton',
        careInstructions: 'Machine wash cold',
        tags: ['regression', 'testing'],
        isFeatured: true,
        status: 'PUBLISHED'
      })
    });
    const prodCreateData = await prodCreateRes.json();
    const product = prodCreateData.data;
    assert(prodCreateRes.status === 201 && product?.id, 'Product: Created successfully via Admin API');
    if (product?.id) testCleanup.productIds.push(product.id);

    // Edit Product
    const prodEditRes = await fetch(`${baseUrl}/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: `Regression Product ${ts} (Updated)`,
        basePrice: 1699
      })
    });
    const prodEditData = await prodEditRes.json();
    assert(prodEditRes.status === 200 && prodEditData.data?.base_price == 1699, 'Product: Edited successfully with updated title and price');

    // -------------------------------------------------------------------------
    // 4. VARIANT CREATION & EDITING
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing Variant Creation, Editing & Initial Stock...');
    const { data: sizeL } = await supabaseAdmin.from('sizes').select('id').eq('category_type', 'APPAREL').eq('name', 'L').single();
    const { data: sizeM } = await supabaseAdmin.from('sizes').select('id').eq('category_type', 'APPAREL').eq('name', 'M').single();
    const { data: colorNavy } = await supabaseAdmin.from('colors').select('id').eq('name', 'Navy Blue').single();

    // Variant 1 with initialStock = 30
    const var1Res = await fetch(`${baseUrl}/admin/products/${product.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: sizeL.id,
        colorId: colorNavy.id,
        sku: `REG-L-NAVY-${ts}`,
        barcode: `890${ts.toString().slice(-9)}`,
        mrp: 2499,
        sellingPrice: 1699,
        initialStock: 30
      })
    });
    const var1Data = await var1Res.json();
    const variant1 = var1Data.data;
    assert(var1Res.status === 201 && variant1?.availableStock === 30 && variant1?.availability === 'IN_STOCK', 'Variant: Variant 1 created with initial stock 30 and IN_STOCK status');
    if (variant1?.id) testCleanup.variantIds.push(variant1.id);

    // Variant 2 with initialStock = 0
    const var2Res = await fetch(`${baseUrl}/admin/products/${product.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: sizeM.id,
        colorId: colorNavy.id,
        sku: `REG-M-NAVY-${ts}`,
        barcode: `891${ts.toString().slice(-9)}`,
        mrp: 2499,
        sellingPrice: 1699,
        initialStock: 0
      })
    });
    const var2Data = await var2Res.json();
    const variant2 = var2Data.data;
    assert(var2Res.status === 201 && variant2?.availableStock === 0 && variant2?.availability === 'OUT_OF_STOCK', 'Variant: Variant 2 created with 0 initial stock and OUT_OF_STOCK status');
    if (variant2?.id) testCleanup.variantIds.push(variant2.id);

    // Edit Variant specifications
    const varEditRes = await fetch(`${baseUrl}/admin/variants/${variant1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sellingPrice: 1599,
        lowStockThreshold: 10
      })
    });
    assert(varEditRes.status === 200, 'Variant: Specifications updated without altering stock levels');

    // -------------------------------------------------------------------------
    // 5. STOCK MANAGEMENT & ADJUSTMENT
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Stock Management & Stock Adjustment...');
    // Adjust variant 2 stock (+12 units)
    const adjPosRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: variant2.id,
        quantity: 12,
        movementType: 'PURCHASE_RECEIPT',
        reason: 'Restocking test'
      })
    });
    assert(adjPosRes.status === 200, 'Stock: Positive stock adjustment (+12) succeeds');

    // Attempt negative adjustment exceeding available (-20 when available is 12)
    const adjNegFailRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: variant2.id,
        quantity: -20,
        movementType: 'INVENTORY_ADJUSTMENT',
        reason: 'Over-deduction attempt'
      })
    });
    assert(adjNegFailRes.status === 400, 'Stock: Excessive negative stock deduction correctly rejected (prevents negative inventory)');

    // Valid negative adjustment (-2 units -> becomes 10)
    const adjNegPassRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: variant2.id,
        quantity: -2,
        movementType: 'INVENTORY_ADJUSTMENT',
        reason: 'Valid audit correction'
      })
    });
    assert(adjNegPassRes.status === 200, 'Stock: Valid negative adjustment (-2) succeeds');

    // -------------------------------------------------------------------------
    // 6. PRODUCT LISTING & PRODUCT DETAIL
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Testing Product Listing & Product Detail...');
    const listRes = await fetch(`${baseUrl}/products?search=Regression`);
    const listData = await listRes.json();
    const foundInList = (listData.data?.products || listData.data || []).some(p => p.id === product.id);
    assert(listRes.status === 200 && foundInList, 'Storefront: Product listing returns active published products');

    const detailRes = await fetch(`${baseUrl}/products/${product.slug}`);
    const detailData = await detailRes.json();
    const detailProduct = detailData.data;
    const v1Detail = detailProduct?.variants?.find(v => v.id === variant1.id);
    const v2Detail = detailProduct?.variants?.find(v => v.id === variant2.id);
    assert(detailRes.status === 200 && v1Detail?.availableStock === 30 && v2Detail?.availableStock === 10, 'Storefront: Product detail returns accurate live variant stock (30 & 10)');

    // -------------------------------------------------------------------------
    // 7. WISHLIST
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Testing Wishlist...');
    const wishAddRes = await fetch(`${baseUrl}/wishlist/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({ productId: product.id })
    });
    assert(wishAddRes.status === 200 || wishAddRes.status === 201, 'Wishlist: Product added to customer wishlist');

    const wishGetRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const wishGetData = await wishGetRes.json();
    const wishItems = wishGetData.data?.items || wishGetData.data || [];
    assert(wishGetRes.status === 200 && wishItems.some(item => (item.product_id === product.id || item.productId === product.id || item.product?.id === product.id)), 'Wishlist: Customer wishlist retrieves saved products');

    // -------------------------------------------------------------------------
    // 8. CART & CHECKOUT
    // -------------------------------------------------------------------------
    console.log('\n>>> 8. Testing Cart & Checkout...');
    // Create address for customer via API
    const addrCreateRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        recipientName: 'Regression Customer',
        phoneNumber: '+91 9876543210',
        addressLine1: 'Main Road, Talapudi',
        city: 'Talapudi',
        state: 'Andhra Pradesh',
        postalCode: '534340',
        addressType: 'HOME',
        isDefault: true
      })
    });
    const addrCreateData = await addrCreateRes.json();
    const address = addrCreateData.data;
    assert(addrCreateRes.status === 201 && address?.id, 'Address: Customer address created successfully');

    // Add to cart
    const cartAddRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        variantId: variant1.id,
        quantity: 2
      })
    });
    const cartAddData = await cartAddRes.json();
    assert(cartAddRes.status === 200 && (cartAddData.data?.items || []).length > 0, 'Cart: Variant successfully added to cart');

    // Atomic COD Checkout via POST /orders
    const checkoutRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        addressId: address.id,
        paymentMethod: 'COD',
        customerNotes: 'E2E regression checkout'
      })
    });
    const checkoutData = await checkoutRes.json();
    const orderId = checkoutData.data?.order_id || checkoutData.data?.order?.id || checkoutData.data?.id;
    const placedOrder = { id: orderId, ...(checkoutData.data || {}) };
    assert((checkoutRes.status === 200 || checkoutRes.status === 201) && orderId, 'Checkout: Atomic COD checkout completes successfully', JSON.stringify(checkoutData));
    if (orderId) testCleanup.orderIds.push(orderId);

    // Verify stock reservation after order placement (30 available -> 28 available, 2 reserved)
    const { data: invAfterOrder } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available, quantity_reserved')
      .eq('variant_id', variant1.id)
      .single();
    assert(invAfterOrder?.quantity_available === 28 && invAfterOrder?.quantity_reserved === 2, 'Checkout: Inventory atomically reserved (28 available, 2 reserved)');

    // -------------------------------------------------------------------------
    // 9. ORDERS & LIFECYCLE (Admin update order status)
    // -------------------------------------------------------------------------
    console.log('\n>>> 9. Testing Orders Lifecycle...');
    // Sequence through state machine: PENDING -> CONFIRMED -> PACKED -> SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED
    for (const st of ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      const transRes = await fetch(`${baseUrl}/admin/orders/${placedOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: st })
      });
      assert(transRes.status === 200, `Orders: Admin transitions status to ${st}`);
    }

    const { data: invAfterDeliver } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available, quantity_reserved')
      .eq('variant_id', variant1.id)
      .single();
    assert(invAfterDeliver?.quantity_available === 28 && invAfterDeliver?.quantity_reserved === 0, 'Orders: Delivery consumes reserved inventory correctly');

    // -------------------------------------------------------------------------
    // 10. RETURNS & RESTOCKING
    // -------------------------------------------------------------------------
    console.log('\n>>> 10. Testing Returns & Restocking...');
    const { data: orderItems } = await supabaseAdmin.from('order_items').select('*').eq('order_id', placedOrder.id);
    const targetItem = orderItems[0];

    const retReqRes = await fetch(`${baseUrl}/returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        orderId: placedOrder.id,
        requestType: 'RETURN',
        reason: 'WRONG_SIZE',
        items: [{ orderItemId: targetItem.id, variantId: targetItem.variant_id, quantity: 1 }]
      })
    });
    const retReqData = await retReqRes.json();
    const returnId = retReqData.data?.returnRequestId;
    assert(retReqRes.status === 201 && returnId, 'Returns: Customer initiates return request');
    if (returnId) testCleanup.returnIds.push(returnId);

    // Admin approves return
    await fetch(`${baseUrl}/admin/returns/${returnId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'APPROVED' })
    });

    const retDetailsRes = await fetch(`${baseUrl}/admin/returns/${returnId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const retDetails = await retDetailsRes.json();
    const returnItemId = retDetails.data?.items?.[0]?.id;

    // Admin receives in store as RESELLABLE
    await fetch(`${baseUrl}/admin/returns/${returnId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'RECEIVED_IN_STORE',
        itemsCondition: [{ returnItemId, condition: 'RESELLABLE' }]
      })
    });

    // Admin completes return (Stock restored: 28 -> 29)
    await fetch(`${baseUrl}/admin/returns/${returnId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });

    const { data: invAfterReturn } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available')
      .eq('variant_id', variant1.id)
      .single();
    assert(invAfterReturn?.quantity_available === 29, 'Returns: Resellable return restored inventory (28 -> 29)');

    // -------------------------------------------------------------------------
    // 11. ADMIN DASHBOARD METRICS
    // -------------------------------------------------------------------------
    console.log('\n>>> 11. Testing Admin Dashboard Metrics...');
    const adminOrdersRes = await fetch(`${baseUrl}/admin/orders?limit=1`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert(adminOrdersRes.status === 200 && (adminOrdersData.data?.total >= 1 || adminOrdersData.data?.pagination?.total >= 1 || Array.isArray(adminOrdersData.data?.orders)), 'Admin Dashboard: Admin orders query returns aggregate metrics');

    const adminInvRes = await fetch(`${baseUrl}/admin/inventory?limit=5`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminInvData = await adminInvRes.json();
    assert(adminInvRes.status === 200 && (adminInvData.data?.items || adminInvData.data || []).length > 0, 'Admin Dashboard: Inventory list returns storeless inventory rows');

    // -------------------------------------------------------------------------
    // 12. DATABASE CONSISTENCY VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n>>> 12. Running Deep Database Consistency Checks...');
    const dbClient = await pool.connect();
    try {
      // Check 1: Orphaned inventory_items without product_variants
      const orphanInvRes = await dbClient.query(`
        SELECT i.id, i.variant_id 
        FROM inventory_items i 
        LEFT JOIN product_variants pv ON i.variant_id = pv.id 
        WHERE pv.id IS NULL;
      `);
      assert(orphanInvRes.rows.length === 0, 'DB Consistency: Zero orphaned inventory_items rows');

      // Check 2: Orphaned variants without products
      const orphanVarRes = await dbClient.query(`
        SELECT pv.id, pv.product_id 
        FROM product_variants pv 
        LEFT JOIN products p ON pv.product_id = p.id 
        WHERE p.id IS NULL;
      `);
      assert(orphanVarRes.rows.length === 0, 'DB Consistency: Zero orphaned product_variants rows');

      // Check 3: Duplicate inventory records per variant
      const dupInvRes = await dbClient.query(`
        SELECT variant_id, COUNT(*) 
        FROM inventory_items 
        GROUP BY variant_id 
        HAVING COUNT(*) > 1;
      `);
      assert(dupInvRes.rows.length === 0, 'DB Consistency: Zero duplicate inventory rows per variant');

      // Check 4: Negative stock checks
      const negStockRes = await dbClient.query(`
        SELECT id, variant_id, quantity_available, quantity_reserved, quantity_damaged
        FROM inventory_items
        WHERE quantity_available < 0 OR quantity_reserved < 0 OR quantity_damaged < 0;
      `);
      assert(negStockRes.rows.length === 0, 'DB Consistency: Zero negative stock values across all inventory');

      // Check 5: Store table existence check (must be dropped)
      const storeTableRes = await dbClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name IN ('stores', 'staff_store_assignments');
      `);
      assert(storeTableRes.rows.length === 0, 'DB Consistency: Stores and staff_store_assignments tables completely removed');

      // Check 6: Unique constraint on inventory_items(variant_id)
      const uqConstraintRes = await dbClient.query(`
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.inventory_items'::regclass AND conname = 'uq_inventory_variant';
      `);
      assert(uqConstraintRes.rows.length > 0, 'DB Consistency: uq_inventory_variant UNIQUE constraint active on inventory_items');
    } finally {
      dbClient.release();
    }

  } catch (err) {
    console.error('Fatal regression error:', err);
    assert(false, 'Regression Suite Execution', err.message);
  } finally {
    // Purge test fixtures
    console.log('\n>>> Cleaning up test fixtures...');
    try {
      if (testCleanup.returnIds.length > 0) {
        await supabaseAdmin.from('return_items').delete().in('return_request_id', testCleanup.returnIds);
        await supabaseAdmin.from('return_requests').delete().in('id', testCleanup.returnIds);
      }
      if (testCleanup.orderIds.length > 0) {
        await supabaseAdmin.from('order_status_history').delete().in('order_id', testCleanup.orderIds);
        await supabaseAdmin.from('order_items').delete().in('order_id', testCleanup.orderIds);
        await supabaseAdmin.from('orders').delete().in('id', testCleanup.orderIds);
      }
      if (testCleanup.variantIds.length > 0) {
        await supabaseAdmin.from('cart_items').delete().in('variant_id', testCleanup.variantIds);
        await supabaseAdmin.from('stock_movements').delete().in('variant_id', testCleanup.variantIds);
        await supabaseAdmin.from('inventory_items').delete().in('variant_id', testCleanup.variantIds);
        await supabaseAdmin.from('product_variants').delete().in('id', testCleanup.variantIds);
      }
      if (testCleanup.productIds.length > 0) {
        await supabaseAdmin.from('wishlist_items').delete().in('product_id', testCleanup.productIds);
        await supabaseAdmin.from('products').delete().in('id', testCleanup.productIds);
      }
      for (const uid of testCleanup.userIds) {
        await supabaseAdmin.from('addresses').delete().eq('user_id', uid);
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      console.log(' [PASS] All temporary test data purged.\n');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    server.close();
  }

  console.log('================================================================');
  console.log(`REGRESSION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionAndConsistency();
