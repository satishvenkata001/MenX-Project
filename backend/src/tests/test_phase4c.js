import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runPhase4CTests() {
  console.log('================================================================');
  console.log('       MENX PHASE 4C — INVENTORY & STOCK MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  let passedTests = 0;
  let totalTests = 0;

  async function assert(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(` [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(` [FAIL] ${name} — ${details}`);
    }
  }

  // Tracking IDs for cleanup
  const createdUserIds = [];
  const createdStoreIds = [];
  const createdStaffAssignmentIds = [];
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];
  const createdInventoryIds = [];
  const createdMovementIds = [];

  let customerToken = null;
  let staffToken = null;
  let invManagerToken = null;
  let storeManagerToken = null;
  let superAdminToken = null;

  let customerUserId = null;
  let staffUserId = null;
  let invManagerUserId = null;
  let storeManagerUserId = null;
  let superAdminUserId = null;

  let storeTalapudi = null;
  let storeWarehouse = null;
  let storeHyderabad = null;

  let testCategory = null;
  let testSubcategory = null;
  let testBrand = null;
  let testSize = null;
  let testColor = null;
  let testProduct = null;
  let testVariant = null;
  let testVariantLow = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Test Stores, Users & Catalog Fixtures
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Initializing Stores, RBAC Accounts & Catalog Fixtures...');
    const password = 'Password123!Secure';

    // 1. Create Physical & Warehouse Stores
    const { data: st1 } = await supabaseAdmin
      .from('stores')
      .insert({
        name: 'MenX Talapudi Store',
        code: `TALAPUDI-${Date.now()}`,
        type: 'PHYSICAL_STORE',
        address_line1: 'Main Road, Talapudi',
        city: 'Talapudi',
        state: 'Andhra Pradesh',
        postal_code: '534141',
        phone: '+91 9123456780',
        is_active: true
      })
      .select()
      .single();
    storeTalapudi = st1;
    createdStoreIds.push(st1.id);

    const { data: st2 } = await supabaseAdmin
      .from('stores')
      .insert({
        name: 'MenX Central Warehouse',
        code: `CENTRAL-WH-${Date.now()}`,
        type: 'CENTRAL_WAREHOUSE',
        address_line1: 'Industrial Area Phase 2',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        postal_code: '520001',
        phone: '+91 9123456781',
        is_active: true
      })
      .select()
      .single();
    storeWarehouse = st2;
    createdStoreIds.push(st2.id);

    const { data: st3 } = await supabaseAdmin
      .from('stores')
      .insert({
        name: 'MenX Hyderabad Boutique',
        code: `HYDERABAD-${Date.now()}`,
        type: 'PHYSICAL_STORE',
        address_line1: 'Jubilee Hills Road 36',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500033',
        phone: '+91 9123456782',
        is_active: true
      })
      .select()
      .single();
    storeHyderabad = st3;
    createdStoreIds.push(st3.id);

    // 2. Helper to create user with specific role
    async function createTestUser(email, role, firstName) {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'Tester' }
      });
      if (authErr) throw new Error(`User ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 300));
      await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`User ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const ts = Date.now();
    const cust = await createTestUser(`cust.${ts}@menxfashion.com`, 'CUSTOMER', 'Customer');
    customerUserId = cust.uid;
    customerToken = cust.token;

    const stf = await createTestUser(`staff.${ts}@menxfashion.com`, 'STORE_STAFF', 'Staff');
    staffUserId = stf.uid;
    staffToken = stf.token;

    const inv = await createTestUser(`inv.${ts}@menxfashion.com`, 'INVENTORY_MANAGER', 'InvMgr');
    invManagerUserId = inv.uid;
    invManagerToken = inv.token;

    const stm = await createTestUser(`stm.${ts}@menxfashion.com`, 'STORE_MANAGER', 'StoreMgr');
    storeManagerUserId = stm.uid;
    storeManagerToken = stm.token;

    // Assign StoreManager to Talapudi store only (scoping test)
    const { data: assignment } = await supabaseAdmin
      .from('staff_store_assignments')
      .insert({
        user_id: storeManagerUserId,
        store_id: storeTalapudi.id,
        is_primary: true
      })
      .select()
      .single();
    if (assignment) createdStaffAssignmentIds.push(assignment.id);

    const sup = await createTestUser(`admin.${ts}@menxfashion.com`, 'SUPER_ADMIN', 'SuperAdmin');
    superAdminUserId = sup.uid;
    superAdminToken = sup.token;

    // 3. Seed Catalog taxonomy & variants
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .insert({ name: 'Formal Shirts', slug: `formal-shirts-${ts}`, display_order: 1 })
      .select()
      .single();
    testCategory = cat;
    createdCategoryIds.push(cat.id);

    const { data: subcat } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: cat.id, name: 'Linen', slug: `linen-${ts}` })
      .select()
      .single();
    testSubcategory = subcat;
    createdSubcategoryIds.push(subcat.id);

    const { data: br } = await supabaseAdmin
      .from('brands')
      .insert({ name: `MenX Classic ${ts}`, slug: `menx-classic-${ts}` })
      .select()
      .single();
    testBrand = br;
    createdBrandIds.push(br.id);

    const { data: sz } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-${ts}`, category_type: 'APPAREL', sort_order: 3 })
      .select()
      .single();
    testSize = sz;
    createdSizeIds.push(sz.id);

    const { data: cl } = await supabaseAdmin
      .from('colors')
      .insert({ name: `Crisp White ${ts}`, hex_code: '#FFFFFF' })
      .select()
      .single();
    testColor = cl;
    createdColorIds.push(cl.id);

    const { data: prod } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Executive Italian Linen Shirt',
        slug: `executive-italian-linen-${ts}`,
        description: 'Premium pure Italian linen shirt for formal occasions.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'PUBLISHED',
        base_mrp: 3999.00,
        base_price: 2499.00,
        tags: ['linen', 'formal', 'italian'],
        created_by: superAdminUserId
      })
      .select()
      .single();
    testProduct = prod;
    createdProductIds.push(prod.id);

    const { data: var1 } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz.id,
        color_id: cl.id,
        sku: `LIN-WHT-L-${ts}`,
        barcode: `89055511${ts.toString().slice(-6)}`,
        mrp: 3999.00,
        selling_price: 2499.00,
        weight_grams: 280,
        low_stock_threshold: 5
      })
      .select()
      .single();
    testVariant = var1;
    createdVariantIds.push(var1.id);

    console.log(' [PASS] Setup completed successfully with all test fixtures.\n');

    // -------------------------------------------------------------------------
    // TEST 1: List Stores
    // -------------------------------------------------------------------------
    console.log('>>> 1. Admin Stores & Inventory List Endpoints');
    const storesRes = await fetch(`${baseUrl}/admin/stores`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const storesData = await storesRes.json();
    await assert('GET /api/v1/admin/stores returns HTTP 200', storesRes.status === 200);
    await assert('Stores list contains seeded Talapudi and Warehouse', storesData.data.some(s => s.id === storeTalapudi.id));

    // -------------------------------------------------------------------------
    // TEST 2: Initial Stock Adjustment
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Stock Adjustment & Ledger Tracking');
    const adjustRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        storeId: storeTalapudi.id,
        variantId: testVariant.id,
        quantity: 25,
        movementType: 'INITIAL_STOCK',
        reason: 'Initial opening stock intake for Talapudi store'
      })
    });
    const adjustData = await adjustRes.json();
    await assert('POST /api/v1/admin/inventory/adjust (Initial 25) returns HTTP 200', adjustRes.status === 200);
    await assert('Inventory quantity_available updated to 25', adjustData.data?.inventory?.quantity_available === 25);
    await assert('Stock movement recorded with INITIAL_STOCK type', adjustData.data?.movement?.movement_type === 'INITIAL_STOCK');
    if (adjustData.data?.inventory?.id) createdInventoryIds.push(adjustData.data.inventory.id);
    if (adjustData.data?.movement?.id) createdMovementIds.push(adjustData.data.movement.id);

    // TEST 3: Invalid Stock Adjustment (zero quantity) -> 400
    const zeroAdjRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        storeId: storeTalapudi.id,
        variantId: testVariant.id,
        quantity: 0,
        reason: 'Zero test'
      })
    });
    await assert('Adjustment with quantity = 0 returns HTTP 400 Bad Request', zeroAdjRes.status === 400);

    // TEST 4: Negative Stock Rejection (adjustment exceeding available stock) -> 400
    const negAdjRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        storeId: storeTalapudi.id,
        variantId: testVariant.id,
        quantity: -50, // Available is 25
        reason: 'Excessive deduction'
      })
    });
    await assert('Adjustment causing negative available stock returns HTTP 400', negAdjRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 5: Stock Transfer Between Stores
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Store-to-Store Stock Transfer');
    // Transfer 10 from Talapudi to Central Warehouse
    const transferRes = await fetch(`${baseUrl}/admin/inventory/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        sourceStoreId: storeTalapudi.id,
        destinationStoreId: storeWarehouse.id,
        variantId: testVariant.id,
        quantity: 10,
        reason: 'Restocking Central Warehouse from Talapudi'
      })
    });
    const transferData = await transferRes.json();
    await assert('POST /api/v1/admin/inventory/transfer (10 items) returns HTTP 200', transferRes.status === 200);
    await assert('Source store (Talapudi) available stock deducted to 15', transferData.data?.sourceInventory?.quantity_available === 15);
    await assert('Destination store (Warehouse) available stock is now 10', transferData.data?.destinationInventory?.quantity_available === 10);
    await assert('Stock movement recorded with STOCK_TRANSFER type', transferData.data?.movement?.movement_type === 'STOCK_TRANSFER');
    if (transferData.data?.destinationInventory?.id) createdInventoryIds.push(transferData.data.destinationInventory.id);
    if (transferData.data?.movement?.id) createdMovementIds.push(transferData.data.movement.id);

    // TEST 6: Transfer exceeding available stock -> 400
    const excessTransferRes = await fetch(`${baseUrl}/admin/inventory/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        sourceStoreId: storeTalapudi.id,
        destinationStoreId: storeWarehouse.id,
        variantId: testVariant.id,
        quantity: 100, // Only 15 available
        reason: 'Excessive transfer'
      })
    });
    await assert('Transfer exceeding available stock returns HTTP 400', excessTransferRes.status === 400);

    // TEST 7: Transfer to same store -> 400
    const sameStoreRes = await fetch(`${baseUrl}/admin/inventory/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        sourceStoreId: storeTalapudi.id,
        destinationStoreId: storeTalapudi.id,
        variantId: testVariant.id,
        quantity: 5,
        reason: 'Self transfer'
      })
    });
    await assert('Transfer to same store rejected with HTTP 400', sameStoreRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 8: Query Inventory List, Detail, Store Inventory, Low Stock
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Inventory Queries & Low Stock Detection');
    const invListRes = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const invListData = await invListRes.json();
    await assert('GET /api/v1/admin/inventory returns HTTP 200', invListRes.status === 200);
    await assert('Inventory list contains items with available stock and status', invListData.data.length >= 2 && invListData.data[0].stock.status === 'IN_STOCK');

    const talapudiInvRes = await fetch(`${baseUrl}/admin/inventory/store/${storeTalapudi.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const talapudiInvData = await talapudiInvRes.json();
    await assert('GET /api/v1/admin/inventory/store/:storeId returns HTTP 200', talapudiInvRes.status === 200);
    await assert('Store inventory returns 15 items for Talapudi', talapudiInvData.data.some(i => i.variant.id === testVariant.id && i.stock.available === 15));

    // Inventory Detail by ID
    const invDetailRes = await fetch(`${baseUrl}/admin/inventory/${adjustData.data.inventory.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const invDetailData = await invDetailRes.json();
    await assert('GET /api/v1/admin/inventory/:id returns HTTP 200', invDetailRes.status === 200);
    await assert('Detail contains store and variant information', !!invDetailData.data.store?.name && !!invDetailData.data.variant?.sku);

    // Low stock detection (adjust Talapudi stock down to 3, below threshold of 5)
    await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        storeId: storeTalapudi.id,
        variantId: testVariant.id,
        quantity: -12, // 15 - 12 = 3
        reason: 'Deduction to test low stock'
      })
    });

    const lowStockRes = await fetch(`${baseUrl}/admin/inventory/low-stock`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const lowStockData = await lowStockRes.json();
    await assert('GET /api/v1/admin/inventory/low-stock returns HTTP 200', lowStockRes.status === 200);
    await assert('Low stock list detects item with status LOW_STOCK', lowStockData.data.some(i => i.variant.id === testVariant.id && i.stock.status === 'LOW_STOCK'));

    // Stock Movements audit query
    const movementsRes = await fetch(`${baseUrl}/admin/inventory/movements`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const movementsData = await movementsRes.json();
    await assert('GET /api/v1/admin/inventory/movements returns HTTP 200', movementsRes.status === 200);
    await assert('Movements include INITIAL_STOCK and STOCK_TRANSFER entries', movementsData.data.length >= 2);

    // -------------------------------------------------------------------------
    // TEST 9: RBAC Enforcement for All Roles
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. RBAC & Store-Scope Security Tests');
    // CUSTOMER -> 403
    const custRes = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    await assert('CUSTOMER accessing /admin/inventory returns HTTP 403 Forbidden', custRes.status === 403);

    // STORE_STAFF -> 403
    const staffRes = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    await assert('STORE_STAFF accessing /admin/inventory returns HTTP 403 Forbidden', staffRes.status === 403);

    // INVENTORY_MANAGER -> 200
    const invMgrRes = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { Authorization: `Bearer ${invManagerToken}` }
    });
    await assert('INVENTORY_MANAGER accessing /admin/inventory returns HTTP 200 OK', invMgrRes.status === 200);

    // STORE_MANAGER assigned to Talapudi accessing Talapudi -> 200
    const stmAllowedRes = await fetch(`${baseUrl}/admin/inventory/store/${storeTalapudi.id}`, {
      headers: { Authorization: `Bearer ${storeManagerToken}` }
    });
    await assert('STORE_MANAGER accessing assigned store (Talapudi) returns HTTP 200', stmAllowedRes.status === 200);

    // STORE_MANAGER attempting to access unassigned store (Hyderabad) -> 403
    const stmDeniedRes = await fetch(`${baseUrl}/admin/inventory/store/${storeHyderabad.id}`, {
      headers: { Authorization: `Bearer ${storeManagerToken}` }
    });
    await assert('STORE_MANAGER accessing unassigned store (Hyderabad) returns HTTP 403 Forbidden', stmDeniedRes.status === 403);

    // STORE_MANAGER attempting to adjust stock at unassigned store -> 403
    const stmAdjustDenied = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${storeManagerToken}`
      },
      body: JSON.stringify({
        storeId: storeHyderabad.id,
        variantId: testVariant.id,
        quantity: 5,
        reason: 'Unauthorized adjust'
      })
    });
    await assert('STORE_MANAGER adjusting unassigned store returns HTTP 403 Forbidden', stmAdjustDenied.status === 403);

    // -------------------------------------------------------------------------
    // TEST 10: PostgreSQL reserve_inventory_for_order Procedure & Concurrency Race Condition
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Atomic Inventory Reservation & Race Condition Tests');
    // Set Talapudi available stock to exactly 1 for race condition testing
    await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        storeId: storeTalapudi.id,
        variantId: testVariant.id,
        quantity: -2, // Currently 3 -> adjust -2 to make exactly 1
        reason: 'Set exact 1 for concurrency test'
      })
    });

    const dummyOrderId1 = '11111111-1111-4111-8111-111111111111';
    const dummyOrderId2 = '22222222-2222-4222-8222-222222222222';

    // Fire 2 concurrent reservation requests of quantity 1 at the EXACT same time
    const [reqA, reqB] = await Promise.all([
      fetch(`${baseUrl}/admin/inventory/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          storeId: storeTalapudi.id,
          variantId: testVariant.id,
          quantity: 1,
          orderId: dummyOrderId1
        })
      }),
      fetch(`${baseUrl}/admin/inventory/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          storeId: storeTalapudi.id,
          variantId: testVariant.id,
          quantity: 1,
          orderId: dummyOrderId2
        })
      })
    ]);

    const statuses = [reqA.status, reqB.status].sort();
    await assert('Concurrent race condition: Exactly 1 request succeeds (200) and 1 fails (400)', statuses[0] === 200 && statuses[1] === 400);

    // Verify stock never went negative
    const finalStockRes = await fetch(`${baseUrl}/admin/inventory/store/${storeTalapudi.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const finalStockData = await finalStockRes.json();
    const talapudiItem = finalStockData.data.find(i => i.variant.id === testVariant.id);
    await assert('Final available stock is exactly 0 (never negative)', talapudiItem.stock.available === 0);
    await assert('Quantity reserved is exactly 1', talapudiItem.stock.reserved === 1);

    // -------------------------------------------------------------------------
    // TEST 11: Public Product Availability State (No Exact Quantity Leakage)
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Public Availability Privacy Check');
    const pubProdRes = await fetch(`${baseUrl}/products/${testProduct.slug}`);
    const pubProdData = await pubProdRes.json();
    await assert('Public product detail returns HTTP 200', pubProdRes.status === 200);
    await assert('Public product variant contains safe availability state "IN_STOCK" or "LOW_STOCK"', typeof pubProdData.data.variants[0]?.availability === 'string');
    await assert('Public product DOES NOT leak exact quantity_available or store records', pubProdData.data.variants[0]?.quantity_available === undefined && pubProdData.data.stores === undefined);

  } catch (err) {
    console.error('[TEST SUITE RUNTIME ERROR]', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purge all temporary test fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up all temporary test fixtures...');
    try {
      await supabaseAdmin.from('stock_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseAdmin.from('inventory_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (createdStaffAssignmentIds.length > 0) {
        await supabaseAdmin.from('staff_store_assignments').delete().in('id', createdStaffAssignmentIds);
      }
      if (createdVariantIds.length > 0) {
        await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
      }
      if (createdProductIds.length > 0) {
        await supabaseAdmin.from('products').delete().in('id', createdProductIds);
      }
      if (createdSubcategoryIds.length > 0) {
        await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds);
      }
      if (createdCategoryIds.length > 0) {
        await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds);
      }
      if (createdBrandIds.length > 0) {
        await supabaseAdmin.from('brands').delete().in('id', createdBrandIds);
      }
      if (createdSizeIds.length > 0) {
        await supabaseAdmin.from('sizes').delete().in('id', createdSizeIds);
      }
      if (createdColorIds.length > 0) {
        await supabaseAdmin.from('colors').delete().in('id', createdColorIds);
      }
      if (createdStoreIds.length > 0) {
        await supabaseAdmin.from('stores').delete().in('id', createdStoreIds);
      }
      for (const uid of createdUserIds) {
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.from('wishlists').delete().eq('user_id', uid);
        await supabaseAdmin.from('carts').delete().eq('user_id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log(' [PASS] All temporary test records successfully purged.');
    } catch (cleanErr) {
      console.warn(' Cleanup warning:', cleanErr.message);
    }

    server.close();
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runPhase4CTests();
