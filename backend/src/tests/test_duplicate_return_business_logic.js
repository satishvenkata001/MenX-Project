import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runDuplicateReturnBusinessLogicTests() {
  console.log('================================================================');
  console.log('  MENX — DUPLICATE RETURN BUSINESS LOGIC & CONCURRENCY TEST SUITE');
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
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
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
  let adminToken = null;
  let adminUserId = null;

  let testCategory = null;
  let testSubcategory = null;
  let testBrand = null;
  let testSizeL = null;
  let testSizeM = null;
  let testColor = null;
  let testProductA = null;
  let testProductB = null;
  let testVariantA1 = null;
  let testVariantA2 = null;
  let testVariantB1 = null;
  let addr1 = null;

  try {
    console.log('>>> Setup: Initializing Test Accounts & Fixtures...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    async function createUser(email, firstName, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'Tester' }
      });
      if (authErr) throw new Error(`User ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 200));
      await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`User ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const c1 = await createUser(`dup.cust.${ts}@menx.com`, 'DupCustomer');
    customer1UserId = c1.uid;
    customer1Token = c1.token;

    const adm = await createUser(`dup.admin.${ts}@menx.com`, 'DupAdmin', 'SUPER_ADMIN');
    adminUserId = adm.uid;
    adminToken = adm.token;

    // Delivery Zone
    const { data: zone, error: zoneErr } = await supabaseAdmin
      .from('delivery_zones')
      .insert({
        name: `Zone-Dup-${ts}`,
        pincode_pattern: '500082',
        base_delivery_charge: 50.00,
        free_delivery_threshold: 500.00,
        is_active: true
      })
      .select()
      .single();
    if (zoneErr) throw new Error(`Zone insert failed: ${zoneErr.message}`);
    createdZoneIds.push(zone.id);

    // Address
    const { data: addr, error: addrErr } = await supabaseAdmin
      .from('addresses')
      .insert({
        user_id: customer1UserId,
        recipient_name: 'Dup Tester',
        phone_number: '+91 9900990099',
        address_line1: '123 Test Street',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500082',
        address_type: 'HOME',
        is_default: true
      })
      .select()
      .single();
    if (addrErr) throw new Error(`Address insert failed: ${addrErr.message}`);
    addr1 = addr.id;
    createdAddressIds.push(addr.id);

    // Taxonomy
    const { data: cat, error: catErr } = await supabaseAdmin
      .from('categories')
      .insert({ name: `DupCat-${ts}`, slug: `dup-cat-${ts}`, display_order: 1 })
      .select()
      .single();
    if (catErr) throw new Error(`Category insert failed: ${catErr.message}`);
    testCategory = cat;
    createdCategoryIds.push(cat.id);

    const { data: subcat, error: subcatErr } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: cat.id, name: `DupSub-${ts}`, slug: `dup-sub-${ts}` })
      .select()
      .single();
    if (subcatErr) throw new Error(`Subcategory insert failed: ${subcatErr.message}`);
    testSubcategory = subcat;
    createdSubcategoryIds.push(subcat.id);

    const { data: br, error: brErr } = await supabaseAdmin
      .from('brands')
      .select('*')
      .limit(1)
      .single();
    if (brErr) throw new Error(`Brand query failed: ${brErr.message}`);
    testBrand = br;

    const { data: szL } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-${ts}`, category_type: 'APPAREL', sort_order: 1 })
      .select()
      .single();
    testSizeL = szL;
    createdSizeIds.push(szL.id);

    const { data: szM } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-M-${ts}`, category_type: 'APPAREL', sort_order: 2 })
      .select()
      .single();
    testSizeM = szM;
    createdSizeIds.push(szM.id);

    const { data: cl } = await supabaseAdmin
      .from('colors')
      .insert({ name: `DupColor-${ts}`, hex_code: '#123456' })
      .select()
      .single();
    testColor = cl;
    createdColorIds.push(cl.id);

    // Products & Variants
    const { data: prodA } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Product A',
        slug: `prod-a-${ts}`,
        description: 'Test Product A',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'PUBLISHED',
        base_mrp: 1200.00,
        base_price: 1000.00
      })
      .select()
      .single();
    testProductA = prodA;
    createdProductIds.push(prodA.id);

    const { data: varA1 } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodA.id,
        size_id: szL.id,
        color_id: cl.id,
        sku: `SKU-A1-${ts}`,
        barcode: `BAR-A1-${ts}`,
        mrp: 1200.00,
        selling_price: 1000.00,
        is_active: true
      })
      .select()
      .single();
    testVariantA1 = varA1;
    createdVariantIds.push(varA1.id);

    const { data: varA2 } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodA.id,
        size_id: szM.id,
        color_id: cl.id,
        sku: `SKU-A2-${ts}`,
        barcode: `BAR-A2-${ts}`,
        mrp: 1200.00,
        selling_price: 1000.00,
        is_active: true
      })
      .select()
      .single();
    testVariantA2 = varA2;
    createdVariantIds.push(varA2.id);

    const { data: prodB } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Product B',
        slug: `prod-b-${ts}`,
        description: 'Test Product B',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'PUBLISHED',
        base_mrp: 1500.00,
        base_price: 1300.00
      })
      .select()
      .single();
    testProductB = prodB;
    createdProductIds.push(prodB.id);

    const { data: varB1 } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodB.id,
        size_id: szL.id,
        color_id: cl.id,
        sku: `SKU-B1-${ts}`,
        barcode: `BAR-B1-${ts}`,
        mrp: 1500.00,
        selling_price: 1300.00,
        is_active: true
      })
      .select()
      .single();
    testVariantB1 = varB1;
    createdVariantIds.push(varB1.id);

    // Initial Inventory
    await supabaseAdmin.from('inventory_items').insert([
      { variant_id: varA1.id, quantity_available: 20, quantity_reserved: 0, quantity_damaged: 0 },
      { variant_id: varA2.id, quantity_available: 20, quantity_reserved: 0, quantity_damaged: 0 },
      { variant_id: varB1.id, quantity_available: 20, quantity_reserved: 0, quantity_damaged: 0 }
    ]);

    // Request helper
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

    // Setup helper for multi-item orders
    async function createDeliveredOrder(items) {
      const orderNum = `MX-DUP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let subtotal = 0;
      items.forEach(i => { subtotal += i.price * i.qty; });

      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          order_number: orderNum,
          customer_id: customer1UserId,
          order_channel: 'ONLINE',
          order_status: 'DELIVERED',
          payment_method: 'COD',
          payment_status: 'PENDING',
          subtotal_amount: subtotal,
          discount_amount: 0.00,
          delivery_fee: 50.00,
          total_payable: subtotal + 50.00,
          cod_amount_due: subtotal + 50.00,
          shipping_address_id: addr1,
          shipping_snapshot: {},
          customer_phone: '+91 9900990099'
        })
        .select()
        .single();
      if (orderErr) throw new Error(`Order setup failed: ${orderErr.message}`);
      createdOrderIds.push(order.id);

      const orderItems = [];
      for (const item of items) {
        const { data: oi, error: oiErr } = await supabaseAdmin
          .from('order_items')
          .insert({
            order_id: order.id,
            variant_id: item.variantId,
            product_title_snapshot: item.title,
            variant_sku_snapshot: item.sku,
            size_snapshot: 'L',
            color_snapshot: 'DupColor',
            unit_mrp_snapshot: item.price,
            unit_price_snapshot: item.price,
            quantity: item.qty,
            line_subtotal: item.price * item.qty,
            line_discount: 0.00,
            line_total: item.price * item.qty
          })
          .select()
          .single();
        if (oiErr) throw new Error(`Order item setup failed: ${oiErr.message}`);
        orderItems.push(oi);
      }

      const nowTs = new Date().toISOString();
      await supabaseAdmin.from('order_status_history').insert([
        { order_id: order.id, to_status: 'PENDING', created_at: nowTs },
        { order_id: order.id, to_status: 'CONFIRMED', created_at: nowTs },
        { order_id: order.id, to_status: 'SHIPPED', created_at: nowTs },
        { order_id: order.id, to_status: 'DELIVERED', created_at: nowTs }
      ]);

      return { orderId: order.id, orderItems };
    }

    console.log('>>> Setup complete!\n');

    // =========================================================================
    // TEST 1: Order item has no return -> create return -> SUCCESS
    // =========================================================================
    console.log('>>> Running TEST 1: First Return Request for Clean Order Item');
    const order1 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A', sku: testVariantA1.sku, price: 1000.00, qty: 1 }
    ]);
    const oi1 = order1.orderItems[0];

    const resT1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order1.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi1.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 1: Clean order item creates return successfully (HTTP 201)', resT1.status === 201);
    const ret1Id = resT1.body?.data?.returnRequestId;
    if (ret1Id) createdReturnIds.push(ret1Id);

    // =========================================================================
    // TEST 2: Same order item already has REQUESTED return -> create another return -> BLOCKED
    // =========================================================================
    console.log('\n>>> Running TEST 2: Duplicate Return for Item in REQUESTED Status');
    const resT2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order1.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      items: [{ orderItemId: oi1.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 2: Duplicate return for item with active REQUESTED return is BLOCKED (HTTP 400)', resT2.status === 400);

    // =========================================================================
    // TEST 3: Same order item has CANCELLED return -> create another return -> BLOCKED
    // =========================================================================
    console.log('\n>>> Running TEST 3: Return Request for Item with CANCELLED Return');
    const order3 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A', sku: testVariantA1.sku, price: 1000.00, qty: 1 }
    ]);
    const oi3 = order3.orderItems[0];

    // Create first return
    const resT3_init = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order3.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi3.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    const ret3Id = resT3_init.body?.data?.returnRequestId;
    createdReturnIds.push(ret3Id);

    // Admin cancels the return
    await makeRequest(`${baseUrl}/admin/returns/${ret3Id}/status`, 'POST', adminToken, {
      status: 'CANCELLED',
      adminNotes: 'Admin cancelled due to used item'
    });

    // Customer attempts to create another return for the same item
    const resT3_dup = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order3.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      items: [{ orderItemId: oi3.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 3: Duplicate return for item with CANCELLED return is BLOCKED (HTTP 400)', resT3_dup.status === 400);

    // Also verify eligible items excludes this cancelled item
    const resT3_elig = await makeRequest(`${baseUrl}/returns/eligible-items`, 'GET', customer1Token);
    const eligIds3 = resT3_elig.body?.data?.map(i => i.orderItemId) || [];
    await assert('TEST 3b: Eligible items endpoint excludes item with CANCELLED return', !eligIds3.includes(oi3.id));

    // =========================================================================
    // TEST 4: Same order item has COMPLETED return -> create another return -> BLOCKED
    // =========================================================================
    console.log('\n>>> Running TEST 4: Return Request for Item with COMPLETED Return');
    const order4 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A', sku: testVariantA1.sku, price: 1000.00, qty: 1 }
    ]);
    const oi4 = order4.orderItems[0];

    const resT4_init = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order4.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi4.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    const ret4Id = resT4_init.body?.data?.returnRequestId;
    createdReturnIds.push(ret4Id);

    // Advance to APPROVED -> RECEIVED_IN_STORE -> COMPLETED
    await makeRequest(`${baseUrl}/admin/returns/${ret4Id}/status`, 'POST', adminToken, { status: 'APPROVED' });
    const ret4Details = await makeRequest(`${baseUrl}/admin/returns/${ret4Id}`, 'GET', adminToken);
    const ret4ItemId = ret4Details.body?.data?.items[0]?.id;

    await makeRequest(`${baseUrl}/admin/returns/${ret4Id}/status`, 'POST', adminToken, {
      status: 'RECEIVED_IN_STORE',
      itemsCondition: [{ returnItemId: ret4ItemId, condition: 'RESELLABLE' }]
    });
    await makeRequest(`${baseUrl}/admin/returns/${ret4Id}/status`, 'POST', adminToken, { status: 'COMPLETED' });

    // Customer attempts second return
    const resT4_dup = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order4.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      items: [{ orderItemId: oi4.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 4: Duplicate return for item with COMPLETED return is BLOCKED (HTTP 400)', resT4_dup.status === 400);

    // =========================================================================
    // TEST 5: Multi-item Order (Product A & Product B) -> Both returns must work
    // =========================================================================
    console.log('\n>>> Running TEST 5: Multi-Item Order (Product A & Product B Independent Returns)');
    const order5 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A', sku: testVariantA1.sku, price: 1000.00, qty: 1 },
      { variantId: testVariantB1.id, title: 'Product B', sku: testVariantB1.sku, price: 1300.00, qty: 1 }
    ]);
    const oi5_A = order5.orderItems[0];
    const oi5_B = order5.orderItems[1];

    // Return Product A
    const resT5_A = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order5.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi5_A.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 5a: Return for Product A succeeds (HTTP 201)', resT5_A.status === 201);
    createdReturnIds.push(resT5_A.body?.data?.returnRequestId);

    // Approve Product A return so order stays in valid state
    await makeRequest(`${baseUrl}/admin/returns/${resT5_A.body?.data?.returnRequestId}/status`, 'POST', adminToken, { status: 'APPROVED' });

    // Return Product B
    const resT5_B = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order5.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      items: [{ orderItemId: oi5_B.id, variantId: testVariantB1.id, quantity: 1 }]
    });
    await assert('TEST 5b: Return for Product B succeeds independently (HTTP 201)', resT5_B.status === 201);
    createdReturnIds.push(resT5_B.body?.data?.returnRequestId);

    // =========================================================================
    // TEST 6: Same Product Exists as Two Different Order Items -> Tracked per order_item_id
    // =========================================================================
    console.log('\n>>> Running TEST 6: Same Product as Two Separate Order Items');
    const order6 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A (Line 1)', sku: testVariantA1.sku, price: 1000.00, qty: 1 },
      { variantId: testVariantA1.id, title: 'Product A (Line 2)', sku: testVariantA1.sku, price: 1000.00, qty: 1 }
    ]);
    const oi6_Line1 = order6.orderItems[0];
    const oi6_Line2 = order6.orderItems[1];

    // Return Line 1
    const resT6_1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order6.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi6_Line1.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 6a: Return for Line 1 succeeds (HTTP 201)', resT6_1.status === 201);
    createdReturnIds.push(resT6_1.body?.data?.returnRequestId);

    // Cancel Line 1 return
    await makeRequest(`${baseUrl}/admin/returns/${resT6_1.body?.data?.returnRequestId}/status`, 'POST', adminToken, {
      status: 'CANCELLED',
      adminNotes: 'Cancelled'
    });

    // Return Line 2 (should succeed because Line 2 is a distinct order_item_id)
    const resT6_2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order6.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      items: [{ orderItemId: oi6_Line2.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 6b: Return for Line 2 succeeds independently by order_item_id (HTTP 201)', resT6_2.status === 201);
    createdReturnIds.push(resT6_2.body?.data?.returnRequestId);

    // Duplicate attempt for Line 1 must still be blocked
    const resT6_1_dup = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order6.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      items: [{ orderItemId: oi6_Line1.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 6c: Duplicate attempt for Line 1 is BLOCKED (HTTP 400)', resT6_1_dup.status === 400);

    // =========================================================================
    // TEST 7: Concurrent Duplicate Return Requests -> Only ONE May Succeed
    // =========================================================================
    console.log('\n>>> Running TEST 7: Concurrency & Lock Verification');
    const order7 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A', sku: testVariantA1.sku, price: 1000.00, qty: 1 }
    ]);
    const oi7 = order7.orderItems[0];

    const concurrentPayload = {
      orderId: order7.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: oi7.id, variantId: testVariantA1.id, quantity: 1 }]
    };

    const [resConc1, resConc2] = await Promise.all([
      makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, concurrentPayload),
      makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, concurrentPayload)
    ]);

    const concSuccess = (resConc1.status === 201 ? 1 : 0) + (resConc2.status === 201 ? 1 : 0);
    const concFailure = (resConc1.status === 400 ? 1 : 0) + (resConc2.status === 400 ? 1 : 0);

    if (resConc1.status === 201) createdReturnIds.push(resConc1.body?.data?.returnRequestId);
    if (resConc2.status === 201) createdReturnIds.push(resConc2.body?.data?.returnRequestId);

    await assert('TEST 7: Exactly ONE concurrent request succeeds (HTTP 201) and ONE fails (HTTP 400)', concSuccess === 1 && concFailure === 1, `Success: ${concSuccess}, Fail: ${concFailure}`);

    // =========================================================================
    // TEST 8: Partial Return & Exchange Workflow
    // =========================================================================
    console.log('\n>>> Running TEST 8: Partial Return & Exchange Workflows');
    const order8 = await createDeliveredOrder([
      { variantId: testVariantA1.id, title: 'Product A (Qty 3)', sku: testVariantA1.sku, price: 1000.00, qty: 3 }
    ]);
    const oi8 = order8.orderItems[0];

    // Request return for 2 units
    const resT8_part1 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order8.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi8.id, variantId: testVariantA1.id, quantity: 2 }]
    });
    await assert('TEST 8a: Partial return of 2/3 units succeeds (HTTP 201)', resT8_part1.status === 201);
    createdReturnIds.push(resT8_part1.body?.data?.returnRequestId);

    // Attempt to return 2 more units (2 + 2 = 4 > 3) -> BLOCKED
    const resT8_exceed = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order8.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi8.id, variantId: testVariantA1.id, quantity: 2 }]
    });
    await assert('TEST 8b: Attempt to return exceeding remaining limit (2 more when 1 left) is BLOCKED (HTTP 400)', resT8_exceed.status === 400);

    // Admin approves first return
    await makeRequest(`${baseUrl}/admin/returns/${resT8_part1.body?.data?.returnRequestId}/status`, 'POST', adminToken, { status: 'APPROVED' });

    // Return remaining 1 unit as EXCHANGE
    const resT8_part2 = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order8.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: oi8.id, variantId: testVariantA1.id, quantity: 1, replacementVariantId: testVariantA2.id }]
    });
    await assert('TEST 8c: Exchange of remaining 1 unit succeeds (HTTP 201)', resT8_part2.status === 201);
    createdReturnIds.push(resT8_part2.body?.data?.returnRequestId);

    // Now all 3 units have return records -> Any 3rd request must be BLOCKED
    const resT8_final = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order8.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: oi8.id, variantId: testVariantA1.id, quantity: 1 }]
    });
    await assert('TEST 8d: Any further return attempt after full quantity returned is BLOCKED (HTTP 400)', resT8_final.status === 400);

  } catch (err) {
    console.error('[TEST SUITE RUNTIME ERROR]', err);
  } finally {
    console.log('\n>>> Cleaning up all temporary test fixtures...');
    try {
      const allUserIds = [customer1UserId, adminUserId].filter(Boolean);

      let allReturnIds = [...createdReturnIds];
      if (createdOrderIds.length > 0) {
        const { data: ordReturns } = await supabaseAdmin.from('return_requests').select('id').in('order_id', createdOrderIds);
        if (ordReturns) allReturnIds.push(...ordReturns.map(r => r.id));
      }
      allReturnIds = [...new Set(allReturnIds)];

      if (allReturnIds.length > 0) {
        try { await supabaseAdmin.from('return_status_history').delete().in('return_request_id', allReturnIds); } catch (e) {}
        try { await supabaseAdmin.from('return_items').delete().in('return_request_id', allReturnIds); } catch (e) {}
        try { await supabaseAdmin.from('return_requests').delete().in('id', allReturnIds); } catch (e) {}
      }

      let allOrderIds = [...createdOrderIds];
      if (allOrderIds.length > 0) {
        try { await supabaseAdmin.from('return_status_history').delete().in('order_id', allOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('return_items').delete().in('order_id', allOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('return_requests').delete().in('order_id', allOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('order_status_history').delete().in('order_id', allOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('order_items').delete().in('order_id', allOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('orders').delete().in('id', allOrderIds); } catch (e) {}
      }

      if (createdProductIds.length > 0) {
        try {
          const { data: vList } = await supabaseAdmin.from('product_variants').select('id').in('product_id', createdProductIds);
          if (vList && vList.length > 0) {
            const vIds = vList.map(v => v.id);
            try { await supabaseAdmin.from('inventory_items').delete().in('variant_id', vIds); } catch (e) {}
            try { await supabaseAdmin.from('product_variants').delete().in('id', vIds); } catch (e) {}
          }
        } catch (e) {}
      }

      if (customer1UserId) {
        try { await supabaseAdmin.from('carts').delete().eq('user_id', customer1UserId); } catch (e) {}
      }

      if (createdProductIds.length > 0) {
        try { await supabaseAdmin.from('products').delete().in('id', createdProductIds); } catch (e) {}
      }
      if (createdSubcategoryIds.length > 0) {
        try { await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds); } catch (e) {}
      }
      if (createdCategoryIds.length > 0) {
        try { await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds); } catch (e) {}
      }
      if (createdSizeIds.length > 0) {
        try { await supabaseAdmin.from('sizes').delete().in('id', createdSizeIds); } catch (e) {}
      }
      if (createdColorIds.length > 0) {
        try { await supabaseAdmin.from('colors').delete().in('id', createdColorIds); } catch (e) {}
      }
      if (createdZoneIds.length > 0) {
        try { await supabaseAdmin.from('delivery_zones').delete().in('id', createdZoneIds); } catch (e) {}
      }
      for (const uid of createdUserIds) {
        try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch (e) {}
      }

      console.log(' [PASS] All temporary test records purged.');
    } catch (cleanErr) {
      console.log(` Cleanup warning: ${cleanErr.message}`);
    }

    server.close();
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runDuplicateReturnBusinessLogicTests();
