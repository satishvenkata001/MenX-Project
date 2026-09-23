import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runReturnValidationTests() {
  console.log('================================================================');
  console.log('  MENX INTEGRATION SUITE: RETURN & EXCHANGE VALIDATION & TERMS');
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

  let testCategory = null;
  let testSubcategory = null;
  let testBrand = null;
  let testSize1 = null;
  let testSize2 = null;
  let testSize3 = null;
  let testColor = null;
  let testProduct = null;
  let testVariant1 = null; // 28 (Available)
  let testVariant2 = null; // 30 (Available)
  let testVariant3 = null; // 32 (Out of stock)
  let testZone = null;
  let addr1 = null;

  try {
    console.log('>>> 1. Setting Up Test Accounts, Taxonomy & Catalog...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    async function createUser(email, firstName, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'Test' }
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

    const c1 = await createUser(`ret.cust1.${ts}@menx.com`, 'Customer1');
    customer1UserId = c1.uid;
    customer1Token = c1.token;

    const c2 = await createUser(`ret.cust2.${ts}@menx.com`, 'Customer2');
    customer2UserId = c2.uid;
    customer2Token = c2.token;

    const adm = await createUser(`ret.admin.${ts}@menx.com`, 'AdminUser', 'SUPER_ADMIN');
    adminUserId = adm.uid;
    adminToken = adm.token;

    // Delivery Zone
    const { data: zone } = await supabaseAdmin
      .from('delivery_zones')
      .insert({
        name: `RetZone-${ts}`,
        pincode_pattern: '500082',
        base_delivery_charge: 50.00,
        free_delivery_threshold: 500.00,
        is_active: true
      })
      .select()
      .single();
    testZone = zone;
    createdZoneIds.push(zone.id);

    // Address
    const { data: a1, error: addrErr } = await supabaseAdmin
      .from('addresses')
      .insert({
        user_id: customer1UserId,
        recipient_name: 'Customer One',
        phone_number: '+91 9900990099',
        address_line1: '123 Return Street',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500082',
        address_type: 'HOME',
        is_default: true
      })
      .select()
      .single();
    if (addrErr) throw new Error(`Address insert failed: ${addrErr.message}`);
    addr1 = a1;
    createdAddressIds.push(a1.id);

    // Taxonomy: Category, Subcategory, Brand, Sizes, Color
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .insert({ name: `Trousers-${ts}`, slug: `trousers-${ts}`, is_active: true })
      .select()
      .single();
    testCategory = cat;
    createdCategoryIds.push(cat.id);

    const { data: subcat } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: cat.id, name: `Formal-${ts}`, slug: `formal-${ts}`, is_active: true })
      .select()
      .single();
    testSubcategory = subcat;
    createdSubcategoryIds.push(subcat.id);

    const { data: br } = await supabaseAdmin
      .from('brands')
      .insert({ name: `MenX Tailored-${ts}`, slug: `menx-tailored-${ts}`, is_active: true })
      .select()
      .single();
    testBrand = br;
    createdBrandIds.push(br.id);

    const { data: sz1 } = await supabaseAdmin.from('sizes').insert({ name: `28-${ts}`, category_type: 'BOTTOMS' }).select().single();
    const { data: sz2 } = await supabaseAdmin.from('sizes').insert({ name: `30-${ts}`, category_type: 'BOTTOMS' }).select().single();
    const { data: sz3 } = await supabaseAdmin.from('sizes').insert({ name: `32-${ts}`, category_type: 'BOTTOMS' }).select().single();
    testSize1 = sz1;
    testSize2 = sz2;
    testSize3 = sz3;
    createdSizeIds.push(sz1.id, sz2.id, sz3.id);

    const { data: col } = await supabaseAdmin.from('colors').insert({ name: `Navy-${ts}`, hex_code: '#000080' }).select().single();
    testColor = col;
    createdColorIds.push(col.id);

    // Product
    const { data: prod, error: prodErr } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Tailored Fit Formal Trousers',
        slug: `tailored-fit-formal-trousers-${ts}`,
        brand_id: br.id,
        category_id: cat.id,
        subcategory_id: subcat.id,
        description: 'Premium luxury trousers',
        status: 'PUBLISHED',
        base_mrp: 1999.00,
        base_price: 1499.00
      })
      .select()
      .single();
    if (prodErr) throw new Error(`Product insert failed: ${prodErr.message}`);
    testProduct = prod;
    createdProductIds.push(prod.id);

    // Variant 1: Size 28 (Available: 10)
    const { data: v1, error: v1Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz1.id,
        color_id: col.id,
        sku: `TR-28-${ts}`,
        barcode: `BAR-28-${ts}`,
        mrp: 1999.00,
        selling_price: 1499.00,
        is_active: true
      })
      .select()
      .single();
    if (v1Err) throw new Error(`Variant 1 insert failed: ${v1Err.message}`);
    testVariant1 = v1;
    createdVariantIds.push(v1.id);

    // Variant 2: Size 30 (Available: 10)
    const { data: v2, error: v2Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz2.id,
        color_id: col.id,
        sku: `TR-30-${ts}`,
        barcode: `BAR-30-${ts}`,
        mrp: 1999.00,
        selling_price: 1499.00,
        is_active: true
      })
      .select()
      .single();
    if (v2Err) throw new Error(`Variant 2 insert failed: ${v2Err.message}`);
    testVariant2 = v2;
    createdVariantIds.push(v2.id);

    // Variant 3: Size 32 (Out of stock: 0)
    const { data: v3, error: v3Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz3.id,
        color_id: col.id,
        sku: `TR-32-${ts}`,
        barcode: `BAR-32-${ts}`,
        mrp: 1999.00,
        selling_price: 1499.00,
        is_active: true
      })
      .select()
      .single();
    if (v3Err) throw new Error(`Variant 3 insert failed: ${v3Err.message}`);
    testVariant3 = v3;
    createdVariantIds.push(v3.id);

    // Inventory items
    await supabaseAdmin.from('inventory_items').insert([
      { variant_id: v1.id, quantity_available: 10, quantity_reserved: 0 },
      { variant_id: v2.id, quantity_available: 10, quantity_reserved: 0 },
      { variant_id: v3.id, quantity_available: 0, quantity_reserved: 0 }
    ]);

    // Helper to make API requests
    async function makeRequest(url, method, token, body = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      return { status: res.status, body: data };
    }

    // Helper to setup test order
    async function setupTestOrder(customerId, variantId, qty = 2, status = 'DELIVERED', deliveredDaysAgo = 1) {
      const orderNum = `MX-TEST-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .insert({
          order_number: orderNum,
          customer_id: customerId,
          order_channel: 'ONLINE',
          order_status: status,
          payment_method: 'COD',
          payment_status: 'PENDING',
          subtotal_amount: 1499.00 * qty,
          discount_amount: 0.00,
          delivery_fee: 0.00,
          total_payable: 1499.00 * qty,
          cod_amount_due: 1499.00 * qty,
          shipping_address_id: addr1.id,
          shipping_snapshot: { address: '123 Return Street' },
          customer_phone: '+91 9900990099'
        })
        .select()
        .single();
      if (orderErr) throw new Error(`Order insert failed: ${orderErr.message}`);
      createdOrderIds.push(order.id);

      const { data: orderItem, error: itemErr } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          variant_id: variantId,
          quantity: qty,
          unit_mrp_snapshot: 1999.00,
          unit_price_snapshot: 1499.00,
          line_subtotal: 1499.00 * qty,
          line_discount: 0.00,
          line_total: 1499.00 * qty,
          product_title_snapshot: 'Tailored Fit Formal Trousers',
          variant_sku_snapshot: `TR-28-${ts}`,
          size_snapshot: '28',
          color_snapshot: 'Navy'
        })
        .select()
        .single();
      if (itemErr) throw new Error(`Order item insert failed: ${itemErr.message}`);

      if (status === 'DELIVERED' || status === 'RETURN_REQUESTED') {
        const delDate = new Date();
        delDate.setDate(delDate.getDate() - deliveredDaysAgo);
        await supabaseAdmin.from('order_status_history').insert({
          order_id: order.id,
          from_status: 'SHIPPED',
          to_status: 'DELIVERED',
          created_at: delDate.toISOString()
        });
      }

      return { orderId: order.id, orderItemId: orderItem.id, orderNumber: orderNum };
    }

    console.log('  [PASS] Test fixtures initialized successfully\n');

    // -------------------------------------------------------------------------
    // TEST 1: Valid Size Exchange with null customerComment (Regression fix for issue)
    // -------------------------------------------------------------------------
    console.log('>>> 2. Testing Valid Size Exchange (Customer scenario from screenshot)...');
    const order1 = await setupTestOrder(customer1UserId, testVariant1.id, 2);

    const exchangeRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order1.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      customerComment: null, // Critical: null customerComment must pass validation
      items: [
        {
          orderItemId: order1.orderItemId,
          variantId: testVariant1.id,
          quantity: 1,
          replacementVariantId: testVariant2.id // size 30
        }
      ]
    });

    await assert('1. Valid Size Exchange request with null customerComment succeeds (HTTP 201)', exchangeRes.status === 201);
    await assert('2. Return request returns valid returnNumber and status REQUESTED', exchangeRes.body?.data?.status === 'REQUESTED');
    if (exchangeRes.body?.data?.returnRequestId) {
      createdReturnIds.push(exchangeRes.body.data.returnRequestId);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Valid Refund Return with optional remarks
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Testing Valid Refund Return...');
    const order2 = await setupTestOrder(customer1UserId, testVariant1.id, 2);

    const returnRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: order2.orderId,
      requestType: 'RETURN',
      reason: 'DEFECTIVE',
      customerComment: 'Fabric stitching issue on left pocket',
      items: [
        {
          orderItemId: order2.orderItemId,
          variantId: testVariant1.id,
          quantity: 2,
          replacementVariantId: null
        }
      ]
    });

    await assert('3. Valid Refund Return request succeeds (HTTP 201)', returnRes.status === 201);
    if (returnRes.body?.data?.returnRequestId) {
      createdReturnIds.push(returnRes.body.data.returnRequestId);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Customer Isolation
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing Customer Data Isolation...');
    const orderCustomer1 = await setupTestOrder(customer1UserId, testVariant1.id, 1);

    const hijackRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer2Token, {
      orderId: orderCustomer1.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: orderCustomer1.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });

    await assert("4. Customer 2 cannot create return for Customer 1 order (HTTP 403)", hijackRes.status === 403);

    // -------------------------------------------------------------------------
    // TEST 4: Size Exchange Validations (Unavailable size, Same size, Missing size)
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Size Exchange Backend Guardrails...');
    const orderExc = await setupTestOrder(customer1UserId, testVariant1.id, 1);

    // A. Out of stock replacement size
    const outOfStockRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderExc.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      items: [
        {
          orderItemId: orderExc.orderItemId,
          variantId: testVariant1.id,
          quantity: 1,
          replacementVariantId: testVariant3.id // size 32 has 0 stock
        }
      ]
    });
    await assert('5. Size Exchange for unavailable/out-of-stock size is rejected (HTTP 400)', outOfStockRes.status === 400);
    await assert(
      '6. Error message clearly indicates selected exchange size is unavailable',
      outOfStockRes.body?.message?.includes('no longer available') || outOfStockRes.body?.message?.includes('unavailable')
    );

    // B. Same size exchange attempt
    const sameSizeRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderExc.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      items: [
        {
          orderItemId: orderExc.orderItemId,
          variantId: testVariant1.id,
          quantity: 1,
          replacementVariantId: testVariant1.id // same size 28
        }
      ]
    });
    await assert('7. Exchange for the exact same size is rejected (HTTP 400)', sameSizeRes.status === 400);

    // C. Missing replacement variant ID for exchange
    const missingVarRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderExc.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      items: [
        {
          orderItemId: orderExc.orderItemId,
          variantId: testVariant1.id,
          quantity: 1,
          replacementVariantId: null
        }
      ]
    });
    await assert('8. Size Exchange without replacement size is rejected (HTTP 400)', missingVarRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 5: Quantity & Boundary Checks
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Testing Quantity Validation & Over-Return Protection...');
    const orderQty = await setupTestOrder(customer1UserId, testVariant1.id, 2);

    // A. Quantity > Purchased
    const overQtyRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQty.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderQty.orderItemId, variantId: testVariant1.id, quantity: 5 }]
    });
    await assert('9. Return quantity exceeding eligible quantity fails (HTTP 400)', overQtyRes.status === 400);

    // B. Quantity <= 0
    const zeroQtyRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQty.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderQty.orderItemId, variantId: testVariant1.id, quantity: 0 }]
    });
    await assert('10. Return quantity <= 0 fails (HTTP 400)', zeroQtyRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 6: Delivery Eligibility Window (7-day rule) & Order Status
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Testing 7-Day Window and Non-Delivered Orders...');
    
    // A. Order delivered 10 days ago
    const oldOrder = await setupTestOrder(customer1UserId, testVariant1.id, 1, 'DELIVERED', 10);
    const expiredRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: oldOrder.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: oldOrder.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('11. Return request for order delivered > 7 days ago fails (HTTP 400)', expiredRes.status === 400);

    // B. Order in SHIPPED status (not yet delivered)
    const shippedOrder = await setupTestOrder(customer1UserId, testVariant1.id, 1, 'SHIPPED');
    const notDeliveredRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: shippedOrder.orderId,
      requestType: 'RETURN',
      reason: 'CHANGED_MIND',
      items: [{ orderItemId: shippedOrder.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('12. Return request for non-delivered order fails (HTTP 400)', notDeliveredRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 7: Invalid Input Parameters & Schema Validation
    // -------------------------------------------------------------------------
    console.log('\n>>> 8. Testing Zod Parameter Schema Enforcement...');

    // A. Invalid Reason
    const invalidReasonRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQty.orderId,
      requestType: 'RETURN',
      reason: 'INVALID_REASON_CODE',
      items: [{ orderItemId: orderQty.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('13. Invalid return reason fails schema validation (HTTP 400)', invalidReasonRes.status === 400);

    // B. Invalid Request Type
    const invalidTypeRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQty.orderId,
      requestType: 'CASHBACK',
      reason: 'WRONG_SIZE',
      items: [{ orderItemId: orderQty.orderItemId, variantId: testVariant1.id, quantity: 1 }]
    });
    await assert('14. Invalid request type fails schema validation (HTTP 400)', invalidTypeRes.status === 400);

    // C. Empty Items Array
    const emptyItemsRes = await makeRequest(`${baseUrl}/returns`, 'POST', customer1Token, {
      orderId: orderQty.orderId,
      requestType: 'RETURN',
      reason: 'WRONG_SIZE',
      items: []
    });
    await assert('15. Empty items array fails schema validation (HTTP 400)', emptyItemsRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 8: Historical Order Snapshot Safety
    // -------------------------------------------------------------------------
    console.log('\n>>> 9. Verifying Historical Order Snapshot Preservation...');
    const { data: originalOrderItem } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('id', order1.orderItemId)
      .single();

    await assert('16. Historical unit price snapshot intact (1499.00)', parseFloat(originalOrderItem.unit_price_snapshot) === 1499.00);
    await assert('17. Historical MRP snapshot intact (1999.00)', parseFloat(originalOrderItem.unit_mrp_snapshot) === 1999.00);
    await assert('18. Historical product title snapshot intact', originalOrderItem.product_title_snapshot === 'Tailored Fit Formal Trousers');
    await assert('19. Historical size snapshot intact (28)', originalOrderItem.size_snapshot === '28');

    console.log('\n================================================================');
    console.log(`  ALL RETURN VALIDATION & TERMS ASSERTIONS PASSED (${passedTests}/${totalTests}) ✅`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED WITH UNEXPECTED ERROR:', err);
  } finally {
    console.log('>>> Cleaning up test fixtures in finally block...');
    if (createdReturnIds.length > 0) {
      await supabaseAdmin.from('return_status_history').delete().in('return_request_id', createdReturnIds);
      await supabaseAdmin.from('return_items').delete().in('return_request_id', createdReturnIds);
      await supabaseAdmin.from('return_requests').delete().in('id', createdReturnIds);
    }
    if (createdOrderIds.length > 0) {
      await supabaseAdmin.from('order_status_history').delete().in('order_id', createdOrderIds);
      await supabaseAdmin.from('order_items').delete().in('order_id', createdOrderIds);
      await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
    }
    if (createdVariantIds.length > 0) {
      await supabaseAdmin.from('inventory_items').delete().in('variant_id', createdVariantIds);
      await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
    }
    if (createdProductIds.length > 0) {
      await supabaseAdmin.from('products').delete().in('id', createdProductIds);
    }
    if (createdSizeIds.length > 0) await supabaseAdmin.from('sizes').delete().in('id', createdSizeIds);
    if (createdColorIds.length > 0) await supabaseAdmin.from('colors').delete().in('id', createdColorIds);
    if (createdSubcategoryIds.length > 0) await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds);
    if (createdCategoryIds.length > 0) await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds);
    if (createdBrandIds.length > 0) await supabaseAdmin.from('brands').delete().in('id', createdBrandIds);
    if (createdAddressIds.length > 0) await supabaseAdmin.from('addresses').delete().in('id', createdAddressIds);
    if (createdZoneIds.length > 0) await supabaseAdmin.from('delivery_zones').delete().in('id', createdZoneIds);
    for (const uid of createdUserIds) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      } catch (_) {}
    }
    await new Promise((resolve) => server.close(resolve));
    console.log(' - Cleanup completed.\n');
  }

  if (passedTests !== totalTests || totalTests === 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runReturnValidationTests();
