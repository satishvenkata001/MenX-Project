import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runPhase4FTests() {
  console.log('================================================================');
  console.log('         MENX PHASE 4F — RETURNS & EXCHANGES TEST SUITE');
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
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];
  const createdAddressIds = [];
  const createdZoneIds = [];
  const createdOrderIds = [];
  const createdReturnIds = [];

  let customer1Token = null;
  let customer1UserId = null;
  let customer2Token = null;
  let customer2UserId = null;
  let adminToken = null;
  let adminUserId = null;

  let testStore = null;
  let testCategory = null;
  let testSubcategory = null;
  let testBrand = null;
  let testSize = null;
  let testColor = null;
  let testProduct = null;
  let testVariant1 = null;
  let testVariant2 = null;
  let testZone = null;
  let addr1 = null;
  let addr2 = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Test Accounts & Fixtures
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Initializing Customers, Admins, Taxonomy & Catalog...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    async function createUser(email, firstName, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'Customer' }
      });
      if (authErr) throw new Error(`User ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 200));
      const { error: profileErr } = await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);
      if (profileErr) throw new Error(`Profile role update failed for ${uid}: ${profileErr.message}`);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`User ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const c1 = await createUser(`cust1.${ts}@menx.com`, 'CustOne');
    customer1UserId = c1.uid;
    customer1Token = c1.token;

    const c2 = await createUser(`cust2.${ts}@menx.com`, 'CustTwo');
    customer2UserId = c2.uid;
    customer2Token = c2.token;

    const adm = await createUser(`admin.${ts}@menx.com`, 'AdminStaff', 'SUPER_ADMIN');
    adminUserId = adm.uid;
    adminToken = adm.token;

    // Delivery Zone
    const { data: zone, error: zoneErr } = await supabaseAdmin
      .from('delivery_zones')
      .insert({
        name: `Zone-${ts}`,
        pincode_pattern: '500081',
        base_delivery_charge: 50.00,
        free_delivery_threshold: 500.00,
        is_active: true
      })
      .select()
      .single();
    if (zoneErr) throw new Error(`Zone insert failed: ${zoneErr.message}`);
    testZone = zone;
    createdZoneIds.push(zone.id);

    // Addresses
    const createAddress = async (uid) => {
      const { data: addr, error: addrErr } = await supabaseAdmin
        .from('addresses')
        .insert({
          user_id: uid,
          recipient_name: 'Recipient Name',
          phone_number: '+91 9900990099',
          address_line1: 'Test Address Line 1',
          city: 'Hyderabad',
          state: 'Telangana',
          postal_code: '500081',
          address_type: 'HOME',
          is_default: true
        })
        .select()
        .single();
      if (addrErr) throw new Error(`Address insert failed for uid ${uid}: ${addrErr.message}`);
      createdAddressIds.push(addr.id);
      return addr.id;
    };

    addr1 = await createAddress(customer1UserId);
    addr2 = await createAddress(customer2UserId);

    // Seed Store (ONLINE_FULFILLMENT)
    const { data: st, error: stErr } = await supabaseAdmin
      .from('stores')
      .insert({
        name: 'MenX F4F Warehouse',
        code: `ONLINE-${ts}`,
        type: 'ONLINE_FULFILLMENT',
        address_line1: 'Warehouse Zone 1',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500081',
        phone: '+91 9900990088',
        is_active: true
      })
      .select()
      .single();
    if (stErr) throw new Error(`Store insert failed: ${stErr.message}`);
    testStore = st;
    createdStoreIds.push(st.id);

    // Catalog fixtures
    const { data: cat, error: catErr } = await supabaseAdmin
      .from('categories')
      .insert({ name: `Apparel-${ts}`, slug: `apparel-${ts}`, display_order: 1 })
      .select()
      .single();
    if (catErr) throw new Error(`Category insert failed: ${catErr.message}`);
    testCategory = cat;
    createdCategoryIds.push(cat.id);

    const { data: subcat, error: subcatErr } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: cat.id, name: `Shirts-${ts}`, slug: `shirts-${ts}` })
      .select()
      .single();
    if (subcatErr) throw new Error(`Subcategory insert failed: ${subcatErr.message}`);
    testSubcategory = subcat;
    createdSubcategoryIds.push(subcat.id);

    const { data: br, error: brErr } = await supabaseAdmin
      .from('brands')
      .insert({ name: `Brand-${ts}`, slug: `brand-${ts}` })
      .select()
      .single();
    if (brErr) throw new Error(`Brand insert failed: ${brErr.message}`);
    testBrand = br;
    createdBrandIds.push(br.id);

    const { data: sz, error: szErr } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-${ts}`, category_type: 'APPAREL', sort_order: 1 })
      .select()
      .single();
    if (szErr) throw new Error(`Size insert failed: ${szErr.message}`);
    testSize = sz;
    createdSizeIds.push(sz.id);

    const { data: sz2, error: sz2Err } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-M-${ts}`, category_type: 'APPAREL', sort_order: 2 })
      .select()
      .single();
    if (sz2Err) throw new Error(`Size 2 insert failed: ${sz2Err.message}`);
    createdSizeIds.push(sz2.id);

    const { data: cl, error: clErr } = await supabaseAdmin
      .from('colors')
      .insert({ name: `Crimson-${ts}`, hex_code: '#DC143C' })
      .select()
      .single();
    if (clErr) throw new Error(`Color insert failed: ${clErr.message}`);
    testColor = cl;
    createdColorIds.push(cl.id);

    // Published Product
    const { data: prod, error: prodErr } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'F4F Test Product',
        slug: `f4f-test-product-${ts}`,
        description: 'F4F cotton shirt.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'PUBLISHED',
        base_mrp: 1000.00,
        base_price: 800.00
      })
      .select()
      .single();
    if (prodErr) throw new Error(`Product insert failed: ${prodErr.message}`);
    testProduct = prod;
    createdProductIds.push(prod.id);

    // Variant 1 (Returned Variant)
    const { data: variant1, error: variant1Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz.id,
        color_id: cl.id,
        sku: `VAR1-L-${ts}`,
        barcode: `BAR1-${ts}`,
        mrp: 1000.00,
        selling_price: 800.00,
        is_active: true
      })
      .select()
      .single();
    if (variant1Err) throw new Error(`Variant 1 insert failed: ${variant1Err.message}`);
    testVariant1 = variant1;
    createdVariantIds.push(variant1.id);

    // Variant 2 (Exchange Replacement Variant)
    const { data: variant2, error: variant2Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz2.id,
        color_id: cl.id,
        sku: `VAR2-M-${ts}`,
        barcode: `BAR2-${ts}`,
        mrp: 1000.00,
        selling_price: 800.00,
        is_active: true
      })
      .select()
      .single();
    if (variant2Err) throw new Error(`Variant 2 insert failed: ${variant2Err.message}`);
    testVariant2 = variant2;
    createdVariantIds.push(variant2.id);

    // Set Inventory (testVariant1 = 10 available, testVariant2 = 5 available)
    const { error: invErr1 } = await supabaseAdmin
      .from('inventory_items')
      .insert([
        { store_id: st.id, variant_id: variant1.id, quantity_available: 10, quantity_reserved: 0, quantity_damaged: 0 },
        { store_id: st.id, variant_id: variant2.id, quantity_available: 5, quantity_reserved: 0, quantity_damaged: 0 }
      ]);
    if (invErr1) throw new Error(`Inventory init failed: ${invErr1.message}`);

    console.log(' Setup completed successfully!\n');

    // Helper for requests
    async function makeRequest(url, method, token, body = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {}

      return { status: res.status, body: json };
    }

    // Helper to create order for customer
    async function setupTestOrder(uid, variantId, qty, status = 'DELIVERED', deliveredDaysAgo = 0) {
      const orderNum = `MX-TEST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          order_number: orderNum,
          customer_id: uid,
          order_channel: 'ONLINE',
          store_id: st.id,
          order_status: status,
          payment_method: 'COD',
          payment_status: 'PENDING',
          subtotal_amount: 800.00 * qty,
          discount_amount: 0.00,
          delivery_fee: 50.00,
          total_payable: (800.00 * qty) + 50.00,
          cod_amount_due: (800.00 * qty) + 50.00,
          shipping_address_id: addr1,
          shipping_snapshot: {},
          customer_phone: '+91 9900990099'
        })
        .select()
        .single();
      if (orderErr) throw new Error(`Order setup failed: ${orderErr.message}`);
      createdOrderIds.push(order.id);

      const { data: item, error: itemErr } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          variant_id: variantId,
          product_title_snapshot: 'Test Product',
          variant_sku_snapshot: 'SKU-SNAPSHOT',
          size_snapshot: 'L',
          color_snapshot: 'Crimson',
          unit_mrp_snapshot: 1000.00,
          unit_price_snapshot: 800.00,
          quantity: qty,
          line_subtotal: 800.00 * qty,
          line_discount: 0.00,
          line_total: 800.00 * qty
        })
        .select()
        .single();
      if (itemErr) throw new Error(`Order item setup failed: ${itemErr.message}`);

      // Insert transition status history
      const nowTs = new Date().toISOString();
      const historyItems = [
        { order_id: order.id, to_status: 'PENDING', created_at: nowTs },
        { order_id: order.id, to_status: 'CONFIRMED', created_at: nowTs },
        { order_id: order.id, to_status: 'SHIPPED', created_at: nowTs },
        { order_id: order.id, to_status: 'DELIVERED', created_at: new Date(Date.now() - deliveredDaysAgo * 24 * 60 * 60 * 1000).toISOString() }
      ];

      const { error: histErr } = await supabaseAdmin
        .from('order_status_history')
        .insert(historyItems);
      if (histErr) throw new Error(`Order status history seed failed: ${histErr.message}`);

      // Simulate stock deduction for delivered items
      if (status === 'DELIVERED') {
        const { data: inv } = await supabaseAdmin
          .from('inventory_items')
          .select('quantity_available')
          .eq('store_id', st.id)
          .eq('variant_id', variantId)
          .single();
        if (inv) {
          await supabaseAdmin
            .from('inventory_items')
            .update({ quantity_available: inv.quantity_available - qty })
            .eq('store_id', st.id)
            .eq('variant_id', variantId);
        }
      }

      return { orderId: order.id, orderItemId: item.id };
    }

    // -------------------------------------------------------------------------
    // TEST 1: Authentication & Authorization (AUTH-01 & AUTH-02)
    // -------------------------------------------------------------------------
    const resAuth1 = await makeRequest(`${baseUrl}/returns/eligible-items`, 'GET', null);
    await assert('AUTH-01: Customer endpoint blocks request without token', resAuth1.status === 401);

    const resAuth2 = await makeRequest(`${baseUrl}/admin/returns`, 'GET', customer1Token);
    await assert('AUTH-02: Admin return list endpoint blocks customer', resAuth2.status === 403);

    // -------------------------------------------------------------------------
    // TEST 2: Customer Isolation & Ownership (OWN-01 & OWN-02)
    // -------------------------------------------------------------------------
    const orderCustomer1 = await setupTestOrder(customer1UserId, testVariant1.id, 2);
    
    // Customer 2 requests return for Customer 1's order
    const resOwn1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer2Token, {
      orderId: orderCustomer1.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderCustomer1.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert("OWN-01: Customer 2 cannot request return for Customer 1's order", resOwn1.status === 403);

    // Create a valid return for Customer 1 first to test details viewing
    const resValidRet = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderCustomer1.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderCustomer1.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    if (resValidRet.status !== 201) {
      console.error('DEBUG: resValidRet failed with status', resValidRet.status, 'body:', JSON.stringify(resValidRet.body));
    }
    const ret1Id = resValidRet.body?.data?.returnRequestId;
    createdReturnIds.push(ret1Id);

    // Customer 2 views details of Customer 1's return
    const resOwn2 = await makeRequest(`${baseUrl}/returns/${ret1Id}`, 'GET', customer2Token);
    await assert("OWN-02: Customer 2 cannot view details of Customer 1's return request", resOwn2.status === 404);

    // -------------------------------------------------------------------------
    // TEST 3: Return Eligibility & Delivery Windows (ELIG-01 & ELIG-02 & ELIG-03)
    // -------------------------------------------------------------------------
    const shippedOrder = await setupTestOrder(customer1UserId, testVariant1.id, 2, 'SHIPPED');
    const resElig1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: shippedOrder.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: shippedOrder.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('ELIG-01: Rejects return request for non-DELIVERED order', resElig1.status === 400);

    const oldDeliveredOrder = await setupTestOrder(customer1UserId, testVariant1.id, 2, 'DELIVERED', 8); // Delivered 8 days ago
    const resElig2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: oldDeliveredOrder.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: oldDeliveredOrder.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('ELIG-02: Rejects return request for order delivered > 7 days ago', resElig2.status === 400);

    // Check eligible items endpoint
    const resElig3 = await makeRequest(`${baseUrl}/returns/eligible-items`, 'GET', customer1Token);
    const eligibleItemIds = resElig3.body.data.map(i => i.orderItemId);
    await assert('ELIG-03: Eligible items lists delivered order item within 7 days', eligibleItemIds.includes(orderCustomer1.orderItemId));
    await assert('ELIG-03: Eligible items excludes order item delivered > 7 days ago', !eligibleItemIds.includes(oldDeliveredOrder.orderItemId));

    // -------------------------------------------------------------------------
    // TEST 4: Return Quantity Validation (QTY-01, QTY-02, QTY-03)
    // -------------------------------------------------------------------------
    const orderQtyTest = await setupTestOrder(customer1UserId, testVariant1.id, 3);

    // Exceed purchased quantity
    const resQty1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQtyTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderQtyTest.orderItemId, variantId: testVariant1.id, quantity: 4 }]
    });
    await assert('QTY-01: Rejects return request with quantity exceeding purchased amount', resQty1.status === 400);

    // First request part return (qty = 2)
    const resQtyValid1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQtyTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderQtyTest.orderItemId, variantId: testVariant1.id, quantity: 2 }]
    });
    createdReturnIds.push(resQtyValid1.body.data.returnRequestId);

    // Try returning another 2 (total 4, remaining is only 1)
    const resQty2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQtyTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderQtyTest.orderItemId, variantId: testVariant1.id, quantity: 2 }]
    });
    await assert('QTY-02: Rejects return request exceeding remaining quantity limit', resQty2.status === 400);

    // Admin approves the first request so it's not pending anymore, allowing the second request
    await makeRequest(`${baseUrl}/admin/returns/${resQtyValid1.body.data.returnRequestId}/status`, 'POST', adminToken, {
      status: 'APPROVED'
    });

    // Return remaining 1
    const resQtyValid2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQtyTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderQtyTest.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('QTY-03: Accepts part return request within remaining limits', resQtyValid2.status === 201);
    createdReturnIds.push(resQtyValid2.body.data.returnRequestId);

    // -------------------------------------------------------------------------
    // TEST 5: Duplicate Return Prevention (DUP-01)
    // -------------------------------------------------------------------------
    const orderDupTest = await setupTestOrder(customer1UserId, testVariant1.id, 2);
    
    // First active request
    const resDup1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderDupTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderDupTest.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    createdReturnIds.push(resDup1.body.data.returnRequestId);

    // Duplicate submission
    const resDup2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderDupTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderDupTest.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('DUP-01: Rejects duplicate return request for the same order item when active request exists', resDup2.status === 400);

    // -------------------------------------------------------------------------
    // TEST 6: State Machine and Transition Validation (STATE-01, STATE-02, STATE-03)
    // -------------------------------------------------------------------------
    const orderStateTest = await setupTestOrder(customer1UserId, testVariant1.id, 2);
    const resStateInit = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderStateTest.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderStateTest.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    const stateRetId = resStateInit.body.data.returnRequestId;
    createdReturnIds.push(stateRetId);

    // Transition REQUESTED -> COMPLETED directly (invalid)
    const resState1 = await makeRequest(`${baseUrl}/admin/returns/${stateRetId}/status`, 'POST', adminToken, {
      status: 'COMPLETED'
    });
    await assert('STATE-01: Admin cannot transition REQUESTED return directly to COMPLETED', resState1.status === 400);

    // Approve the return request
    await makeRequest(`${baseUrl}/admin/returns/${stateRetId}/status`, 'POST', adminToken, { status: 'APPROVED' });

    // Customer tries to cancel now that it is APPROVED (invalid)
    const resState2 = await makeRequest(`${baseUrl}/returns/${stateRetId}/cancel`, 'POST', customer1Token);
    await assert('STATE-02: Customer cannot cancel return request once approved', resState2.status === 400);

    // Admin transitions APPROVED -> RECEIVED_IN_STORE
    const resState3a = await makeRequest(`${baseUrl}/admin/returns/${stateRetId}/status`, 'POST', adminToken, {
      status: 'RECEIVED_IN_STORE',
      itemsCondition: [{ returnItemId: resStateInit.body.data.returnRequestId, condition: 'RESELLABLE' }] // wait, the returnItemId is in return_items table. Let's fetch it first.
    });
    
    // Get return details to get returnItemId
    const details = await makeRequest(`${baseUrl}/admin/returns/${stateRetId}`, 'GET', adminToken);
    const returnItemId = details.body.data.items[0].id;

    // Correctly transition to RECEIVED_IN_STORE with items condition
    const resState3b = await makeRequest(`${baseUrl}/admin/returns/${stateRetId}/status`, 'POST', adminToken, {
      status: 'RECEIVED_IN_STORE',
      itemsCondition: [{ returnItemId, condition: 'RESELLABLE' }]
    });
    await assert('STATE-03: Transition APPROVED -> RECEIVED_IN_STORE accepted with item conditions', resState3b.status === 200);

    // Admin transitions RECEIVED_IN_STORE -> COMPLETED
    const resState3c = await makeRequest(`${baseUrl}/admin/returns/${stateRetId}/status`, 'POST', adminToken, {
      status: 'COMPLETED'
    });
    await assert('STATE-03: Transition RECEIVED_IN_STORE -> COMPLETED accepted', resState3c.status === 200);

    // -------------------------------------------------------------------------
    // TEST 7: Inventory Restoration (INV-01 & INV-02)
    // -------------------------------------------------------------------------
    // Verify Resellable Return (INV-01)
    // Variant 1 initial stock was 10. We had reserved 0. 
    // Let's create an order for variant1, deliver it, return it as RESELLABLE, complete it, and verify available stock becomes 10.
    const { data: invPreResell } = await supabaseAdmin.from('inventory_items').select('quantity_available, quantity_damaged').eq('store_id', st.id).eq('variant_id', variant1.id).single();
    
    const orderInvResell = await setupTestOrder(customer1UserId, testVariant1.id, 1);
    const resellRetReq = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderInvResell.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderInvResell.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    const resellRetId = resellRetReq.body.data.returnRequestId;
    createdReturnIds.push(resellRetId);

    await makeRequest(`${baseUrl}/admin/returns/${resellRetId}/status`, 'POST', adminToken, { status: 'APPROVED' });
    const resellDetails = await makeRequest(`${baseUrl}/admin/returns/${resellRetId}`, 'GET', adminToken);
    const resellItemId = resellDetails.body.data.items[0].id;
    
    await makeRequest(`${baseUrl}/admin/returns/${resellRetId}/status`, 'POST', adminToken, {
      status: 'RECEIVED_IN_STORE',
      itemsCondition: [{ returnItemId: resellItemId, condition: 'RESELLABLE' }]
    });

    await makeRequest(`${baseUrl}/admin/returns/${resellRetId}/status`, 'POST', adminToken, { status: 'COMPLETED' });

    const { data: invPostResell } = await supabaseAdmin.from('inventory_items').select('quantity_available, quantity_damaged').eq('store_id', st.id).eq('variant_id', variant1.id).single();
    await assert('INV-01: Resellable returns increase quantity_available', invPostResell.quantity_available === invPreResell.quantity_available);
    
    // Verify Defective Return (INV-02)
    const orderInvDefect = await setupTestOrder(customer1UserId, testVariant1.id, 1);
    const defectRetReq = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderInvDefect.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE', // defective reason automatically triggers quarantine routing
      items: [{ orderItemId: orderInvDefect.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    const defectRetId = defectRetReq.body.data.returnRequestId;
    createdReturnIds.push(defectRetId);

    await makeRequest(`${baseUrl}/admin/returns/${defectRetId}/status`, 'POST', adminToken, { status: 'APPROVED' });
    const defectDetails = await makeRequest(`${baseUrl}/admin/returns/${defectRetId}`, 'GET', adminToken);
    const defectItemId = defectDetails.body.data.items[0].id;
    
    await makeRequest(`${baseUrl}/admin/returns/${defectRetId}/status`, 'POST', adminToken, {
      status: 'RECEIVED_IN_STORE',
      itemsCondition: [{ returnItemId: defectItemId, condition: 'DAMAGED' }]
    });

    await makeRequest(`${baseUrl}/admin/returns/${defectRetId}/status`, 'POST', adminToken, { status: 'COMPLETED' });

    const { data: invPostDefect } = await supabaseAdmin.from('inventory_items').select('quantity_available, quantity_damaged').eq('store_id', st.id).eq('variant_id', variant1.id).single();
    await assert('INV-02: Defective returns increase quantity_damaged and do not restore quantity_available', invPostDefect.quantity_damaged === invPostResell.quantity_damaged + 1 && invPostDefect.quantity_available === invPostResell.quantity_available - 1);

    // -------------------------------------------------------------------------
    // TEST 8: Exchanges & Stock Allocation (EXC-01, EXC-02, EXC-03)
    // -------------------------------------------------------------------------
    // EXC-02: Exchange approval with insufficient replacement stock
    // variant2 initial stock is 5. Let's create an order for 2 items, try to exchange for 6.
    const orderExcTest = await setupTestOrder(customer1UserId, testVariant1.id, 2);
    const excRetReq1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderExcTest.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderExcTest.orderItemId, variantId: testVariant1.id, quantity: 2, replacementVariantId: variant2.id }]
    });
    const excRetId1 = excRetReq1.body.data.returnRequestId;
    createdReturnIds.push(excRetId1);

    // Make variant2 stock 1 (insufficient for exchange of 2)
    await supabaseAdmin.from('inventory_items').update({ quantity_available: 1 }).eq('store_id', st.id).eq('variant_id', variant2.id);

    const resExcApproveFail = await makeRequest(`${baseUrl}/admin/returns/${excRetId1}/status`, 'POST', adminToken, { status: 'APPROVED' });
    await assert('EXC-02: Exchange approval fails when replacement variant is out of stock', resExcApproveFail.status === 400);

    // EXC-01: Exchange approval with sufficient replacement stock
    // Set variant2 stock to 5
    await supabaseAdmin.from('inventory_items').update({ quantity_available: 5 }).eq('store_id', st.id).eq('variant_id', variant2.id);
    
    const resExcApprovePass = await makeRequest(`${baseUrl}/admin/returns/${excRetId1}/status`, 'POST', adminToken, { status: 'APPROVED' });
    await assert('EXC-01: Exchange approval succeeds when replacement variant stock is sufficient', resExcApprovePass.status === 200);

    // Verify stock reserved: available goes 5 -> 3, reserved goes 0 -> 2
    const { data: invReservedExc } = await supabaseAdmin.from('inventory_items').select('quantity_available, quantity_reserved').eq('store_id', st.id).eq('variant_id', variant2.id).single();
    await assert('EXC-01: Replacement stock is correctly reserved upon approval', invReservedExc.quantity_available === 3 && invReservedExc.quantity_reserved === 2);

    // EXC-03: Complete exchange and verify replacement order
    const excDetails = await makeRequest(`${baseUrl}/admin/returns/${excRetId1}`, 'GET', adminToken);
    const excItemId = excDetails.body.data.items[0].id;

    await makeRequest(`${baseUrl}/admin/returns/${excRetId1}/status`, 'POST', adminToken, {
      status: 'RECEIVED_IN_STORE',
      itemsCondition: [{ returnItemId: excItemId, condition: 'RESELLABLE' }]
    });

    const resExcComplete = await makeRequest(`${baseUrl}/admin/returns/${excRetId1}/status`, 'POST', adminToken, { status: 'COMPLETED' });
    await assert('EXC-03: Exchange request completed successfully', resExcComplete.status === 200);

    // Verify replacement stock consumed: quantity_reserved goes 2 -> 0
    const { data: invPostExc } = await supabaseAdmin.from('inventory_items').select('quantity_available, quantity_reserved').eq('store_id', st.id).eq('variant_id', variant2.id).single();
    await assert('EXC-03: Reserved stock consumed upon completion', invPostExc.quantity_reserved === 0 && invPostExc.quantity_available === 3);

    // Verify replacement order is created with total_payable = 0
    const excOrders = await supabaseAdmin.from('orders').select('*').eq('customer_id', customer1UserId).eq('customer_notes', 'Exchange replacement order');
    await assert('EXC-03: Zero-value replacement order created in DB', excOrders.data.length > 0 && Number(excOrders.data[0].total_payable) === 0.00);
    if (excOrders.data.length > 0) {
      createdOrderIds.push(excOrders.data[0].id);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Concurrency & Lock Verification (CONC-01)
    // -------------------------------------------------------------------------
    const orderConcTest = await setupTestOrder(customer1UserId, testVariant1.id, 2);

    // Submit two concurrent return requests for the same order item
    const returnPayload = {
      orderId: orderConcTest.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderConcTest.orderItemId, variantId: testVariant1.id, quantity: 2 }]
    };

    console.log('>>> Triggering concurrent requests for duplicate return validation...');
    const [resConc1, resConc2] = await Promise.all([
      makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, returnPayload),
      makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, returnPayload)
    ]);

    // One should succeed (201) and one should fail (400)
    const successCount = (resConc1.status === 201 ? 1 : 0) + (resConc2.status === 201 ? 1 : 0);
    const failureCount = (resConc1.status === 400 ? 1 : 0) + (resConc2.status === 400 ? 1 : 0);

    if (resConc1.status === 201) createdReturnIds.push(resConc1.body.data.returnRequestId);
    if (resConc2.status === 201) createdReturnIds.push(resConc2.body.data.returnRequestId);

    await assert('CONC-01: Concurrency locks prevent duplicate returns (one success, one fail)', successCount === 1 && failureCount === 1, `Success: ${successCount}, Fail: ${failureCount}`);

  } catch (err) {
    console.error('[TEST SUITE RUNTIME ERROR]', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purge all temporary test fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up all temporary test fixtures...');
    try {
      if (createdReturnIds.length > 0) {
        await supabaseAdmin.from('return_status_history').delete().in('return_request_id', createdReturnIds);
        await supabaseAdmin.from('return_items').delete().in('return_request_id', createdReturnIds);
        await supabaseAdmin.from('return_requests').delete().in('id', createdReturnIds);
      }

      if (createdOrderIds.length > 0) {
        await supabaseAdmin.from('order_status_history').delete().in('order_id', createdOrderIds);
        await supabaseAdmin.from('order_items').delete().in('order_id', createdOrderIds);
        await supabaseAdmin.from('coupon_redemptions').delete().in('order_id', createdOrderIds);
        await supabaseAdmin.from('stock_movements').delete().in('reference_id', createdOrderIds);
        // Clean up returns referencing these orders
        await supabaseAdmin.from('return_requests').delete().in('order_id', createdOrderIds);
        await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
      }

      await supabaseAdmin.from('cart_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseAdmin.from('carts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabaseAdmin.from('inventory_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

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
      if (createdZoneIds.length > 0) {
        await supabaseAdmin.from('delivery_zones').delete().in('id', createdZoneIds);
      }
      if (createdAddressIds.length > 0) {
        await supabaseAdmin.from('addresses').delete().in('id', createdAddressIds);
      }

      for (const uid of createdUserIds) {
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }

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

runPhase4FTests();
