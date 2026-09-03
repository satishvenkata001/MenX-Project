import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runPhase4ETests() {
  console.log('================================================================');
  console.log('         MENX PHASE 4E — CHECKOUT & ORDER TEST SUITE');
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
  const createdCouponIds = [];
  const createdOrderIds = [];

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
  let testSizeActive = null;
  let testSizeInactive = null;
  let testColor = null;
  let testProduct = null;
  let testVariant = null;
  let testDraftProduct = null;
  let testDraftVariant = null;
  let testInactiveVariant = null;
  let testZone = null;
  let testCoupon = null;

  let addr1 = null;
  let addr2 = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Test Accounts & Fixtures
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Initializing Customers, Admins, Taxonomy & Catalog...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    // Helper to create test users
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
        name: 'MenX Online Warehouse',
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

    const { data: szActive, error: szActiveErr } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-Act-${ts}`, category_type: 'APPAREL', sort_order: 1 })
      .select()
      .single();
    if (szActiveErr) throw new Error(`SizeActive insert failed: ${szActiveErr.message}`);
    testSizeActive = szActive;
    createdSizeIds.push(szActive.id);

    const { data: szInactive, error: szInactiveErr } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-Inact-${ts}`, category_type: 'APPAREL', sort_order: 2 })
      .select()
      .single();
    if (szInactiveErr) throw new Error(`SizeInactive insert failed: ${szInactiveErr.message}`);
    testSizeInactive = szInactive;
    createdSizeIds.push(szInactive.id);

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
        title: 'Crimson Premium Shirt',
        slug: `crimson-premium-shirt-${ts}`,
        description: 'Premium crimson cotton shirt.',
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

    // Variant 1 (Active, price=800, mrp=1000)
    const { data: variant, error: variantErr } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: szActive.id,
        color_id: cl.id,
        sku: `CRIMSON-L-${ts}`,
        barcode: `BAR-${ts}`,
        mrp: 1000.00,
        selling_price: 800.00,
        is_active: true
      })
      .select()
      .single();
    if (variantErr) throw new Error(`Variant insert failed: ${variantErr.message}`);
    testVariant = variant;
    createdVariantIds.push(variant.id);

    // Inventory Item (qty = 10)
    const { error: invErr1 } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        store_id: st.id,
        variant_id: variant.id,
        quantity_available: 10,
        quantity_reserved: 0
      });
    if (invErr1) throw new Error(`Inventory item 1 insert failed: ${invErr1.message}`);

    // Draft Product
    const { data: prodDraft, error: prodDraftErr } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Draft Shirt',
        slug: `draft-shirt-${ts}`,
        description: 'Draft cotton shirt.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'DRAFT',
        base_mrp: 1000.00,
        base_price: 800.00
      })
      .select()
      .single();
    if (prodDraftErr) throw new Error(`Draft product insert failed: ${prodDraftErr.message}`);
    testDraftProduct = prodDraft;
    createdProductIds.push(prodDraft.id);

    const { data: varDraft, error: varDraftErr } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodDraft.id,
        size_id: szActive.id,
        color_id: cl.id,
        sku: `DRAFT-L-${ts}`,
        barcode: `BARD-${ts}`,
        mrp: 1000.00,
        selling_price: 800.00,
        is_active: true
      })
      .select()
      .single();
    if (varDraftErr) throw new Error(`Draft variant insert failed: ${varDraftErr.message}`);
    testDraftVariant = varDraft;
    createdVariantIds.push(varDraft.id);

    const { error: invErr2 } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        store_id: st.id,
        variant_id: varDraft.id,
        quantity_available: 10,
        quantity_reserved: 0
      });
    if (invErr2) throw new Error(`Inventory item 2 insert failed: ${invErr2.message}`);

    // Inactive Variant under published product (using different size to prevent unique constraint violation)
    const { data: varInactive, error: varInactiveErr } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: szInactive.id,
        color_id: cl.id,
        sku: `INACTIVE-L-${ts}`,
        barcode: `BARI-${ts}`,
        mrp: 1000.00,
        selling_price: 800.00,
        is_active: false
      })
      .select()
      .single();
    if (varInactiveErr) throw new Error(`Inactive variant insert failed: ${varInactiveErr.message}`);
    testInactiveVariant = varInactive;
    createdVariantIds.push(varInactive.id);

    const { error: invErr3 } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        store_id: st.id,
        variant_id: varInactive.id,
        quantity_available: 10,
        quantity_reserved: 0
      });
    if (invErr3) throw new Error(`Inventory item 3 insert failed: ${invErr3.message}`);

    // Coupon
    const { data: coupon, error: couponErr } = await supabaseAdmin
      .from('coupons')
      .insert({
        code: `SAVE100-${ts}`,
        discount_type: 'FLAT_AMOUNT',
        discount_value: 100.00,
        min_order_amount: 200.00,
        usage_limit_per_user: 1,
        total_usage_limit: 2,
        is_active: true
      })
      .select()
      .single();
    if (couponErr) throw new Error(`Coupon insert failed: ${couponErr.message}`);
    testCoupon = coupon;
    createdCouponIds.push(coupon.id);

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

    // -------------------------------------------------------------------------
    // TEST 1: Empty cart checkout rejection
    // -------------------------------------------------------------------------
    const res1 = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', customer1Token, {
      addressId: addr1
    });
    await assert('Empty cart validation rejected', res1.status === 400 && res1.body?.message?.includes('empty'));

    const res1b = await makeRequest(`${baseUrl}/orders`, 'POST', customer1Token, {
      addressId: addr1,
      paymentMethod: 'COD'
    });
    await assert('Empty cart order placement rejected', res1b.status === 400 && res1b.body?.message?.includes('empty'));

    // -------------------------------------------------------------------------
    // TEST 2: Invalid address & ownership
    // -------------------------------------------------------------------------
    // Add V1 to Cust 1's cart
    const cart1 = (await supabaseAdmin.from('carts').select('id').eq('user_id', customer1UserId).single()).data;
    await supabaseAdmin.from('cart_items').insert({
      cart_id: cart1.id,
      variant_id: testVariant.id,
      quantity: 1
    });

    const res2 = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', customer1Token, {
      addressId: '00000000-0000-0000-0000-000000000000'
    });
    await assert('Invalid address ID format/existence rejected', res2.status === 400);

    const res2b = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', customer1Token, {
      addressId: addr2 // Cust 2's address ID
    });
    await assert('Address ownership validation enforced', res2b.status === 400 && res2b.body?.message?.includes('ownership'));

    // -------------------------------------------------------------------------
    // TEST 3: Draft product rejection
    // -------------------------------------------------------------------------
    await supabaseAdmin.from('cart_items').insert({
      cart_id: cart1.id,
      variant_id: testDraftVariant.id,
      quantity: 1
    });

    const res3 = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', customer1Token, {
      addressId: addr1
    });
    await assert('Draft product checkout validation rejected', res3.status === 400 && res3.body?.message?.includes('active or published'));

    // Remove draft variant
    await supabaseAdmin.from('cart_items').delete().eq('cart_id', cart1.id).eq('variant_id', testDraftVariant.id);

    // -------------------------------------------------------------------------
    // TEST 4: Inactive variant rejection
    // -------------------------------------------------------------------------
    await supabaseAdmin.from('cart_items').insert({
      cart_id: cart1.id,
      variant_id: testInactiveVariant.id,
      quantity: 1
    });

    const res4 = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', customer1Token, {
      addressId: addr1
    });
    await assert('Inactive variant checkout validation rejected', res4.status === 400 && res4.body?.message?.includes('active or published'));

    // Remove inactive variant
    await supabaseAdmin.from('cart_items').delete().eq('cart_id', cart1.id).eq('variant_id', testInactiveVariant.id);

    // -------------------------------------------------------------------------
    // TEST 5: COD-only enforcement
    // -------------------------------------------------------------------------
    const res5 = await makeRequest(`${baseUrl}/orders`, 'POST', customer1Token, {
      addressId: addr1,
      paymentMethod: 'PREPAID'
    });
    await assert('Prepaid payment method rejected during order creation', res5.status === 400);

    // -------------------------------------------------------------------------
    // TEST 6: Successful checkout & coupon application
    // -------------------------------------------------------------------------
    // Update quantity of V1 to 2 items. Total = 1600.00
    await supabaseAdmin.from('cart_items').update({ quantity: 2 }).eq('cart_id', cart1.id).eq('variant_id', testVariant.id);

    const res6 = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', customer1Token, {
      addressId: addr1,
      couponCode: `SAVE100-${ts}`
    });

    await assert('Successful checkout validation', res6.status === 200 && res6.body?.success === true);
    if (res6.status === 200) {
      await assert('Server-side pricing subtotal correct', Number(res6.body.data.subtotal) === 1600.00);
      await assert('Server-side coupon discount correct', Number(res6.body.data.discount) === 100.00);
      await assert('Server-side delivery fee correct', Number(res6.body.data.deliveryFee) === 0.00);
      await assert('Server-side total payable correct', Number(res6.body.data.total) === 1500.00);
    }

    // Call create order
    const res6b = await makeRequest(`${baseUrl}/orders`, 'POST', customer1Token, {
      addressId: addr1,
      couponCode: `SAVE100-${ts}`,
      customerNotes: 'Deliver on weekday',
      paymentMethod: 'COD'
    });

    await assert('Successful order creation', res6b.status === 201 && res6b.body?.success === true);
    let orderId1 = null;
    if (res6b.status === 201) {
      orderId1 = res6b.body.data.order_id;
      createdOrderIds.push(orderId1);
      await assert('Order returned has order_id', !!orderId1);
      await assert('Order returned has order_number', !!res6b.body.data.order_number);
    }

    // -------------------------------------------------------------------------
    // TEST 7: DB state and snapshots
    // -------------------------------------------------------------------------
    if (orderId1) {
      const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', orderId1).single();
      await assert('Order snapshotted address contains state', order?.shipping_snapshot?.state === 'Telangana');
      await assert('Order initial status is PENDING', order?.order_status === 'PENDING');
      await assert('Order initial payment status is PENDING', order?.payment_status === 'PENDING');

      const { data: orderItem } = await supabaseAdmin.from('order_items').select('*').eq('order_id', orderId1).single();
      await assert('Order items snapshotted title matches', orderItem?.product_title_snapshot === 'Crimson Premium Shirt');
      await assert('Order items snapshotted price matches', Number(orderItem?.unit_price_snapshot) === 800.00);

      const { data: cartItems1 } = await supabaseAdmin.from('cart_items').select('*').eq('cart_id', cart1.id);
      await assert('Customer cart was cleared post checkout', cartItems1.length === 0);

      const { data: inventory } = await supabaseAdmin.from('inventory_items').select('*').eq('store_id', testStore.id).eq('variant_id', testVariant.id).single();
      await assert('Stock was reserved correctly', inventory?.quantity_available === 8 && inventory?.quantity_reserved === 2);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Customer order isolation
    // -------------------------------------------------------------------------
    if (orderId1) {
      const res8 = await makeRequest(`${baseUrl}/orders/${orderId1}`, 'GET', customer2Token);
      await assert('Customer cannot view other customer orders', res8.status === 404);

      const res8b = await makeRequest(`${baseUrl}/orders`, 'GET', customer2Token);
      const containsOrder = res8b.body?.data?.orders?.some(o => o.id === orderId1);
      await assert('Customer order history filtered to user orders only', res8b.status === 200 && !containsOrder);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Customer cancellation rules
    // -------------------------------------------------------------------------
    if (orderId1) {
      // Cancel order 1
      const res9 = await makeRequest(`${baseUrl}/orders/${orderId1}/cancel`, 'POST', customer1Token, {
        reason: 'Change of mind'
      });
      await assert('Customer allowed to cancel PENDING order', res9.status === 200);

      // Verify cancellation stock recovery
      const { data: inventoryPostCancel } = await supabaseAdmin.from('inventory_items').select('*').eq('store_id', testStore.id).eq('variant_id', testVariant.id).single();
      await assert('Inventory restored on customer cancellation', inventoryPostCancel?.quantity_available === 10 && inventoryPostCancel?.quantity_reserved === 0);

      // Try to cancel again
      const res9b = await makeRequest(`${baseUrl}/orders/${orderId1}/cancel`, 'POST', customer1Token);
      await assert('Cannot cancel order already CANCELLED', res9b.status === 400);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Admin RBAC and order search
    // -------------------------------------------------------------------------
    const res10 = await makeRequest(`${baseUrl}/admin/orders`, 'GET', customer1Token);
    await assert('Customer blocked from admin order list', res10.status === 403);

    const res10b = await makeRequest(`${baseUrl}/admin/orders`, 'GET', adminToken);
    await assert('Admin allowed to fetch orders list', res10b.status === 200 && res10b.body?.data?.orders?.length > 0);

    // -------------------------------------------------------------------------
    // TEST 11: Admin status transitions state machine
    // -------------------------------------------------------------------------
    // Create Order 2 for Cust 1. Total = 850
    await supabaseAdmin.from('cart_items').insert({
      cart_id: cart1.id,
      variant_id: testVariant.id,
      quantity: 1
    });
    const order2 = (await makeRequest(`${baseUrl}/orders`, 'POST', customer1Token, {
      addressId: addr1,
      paymentMethod: 'COD'
    })).body.data;
    createdOrderIds.push(order2.order_id);

    // Invalid: PENDING -> PACKED
    const res11 = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/status`, 'PATCH', adminToken, {
      status: 'PACKED'
    });
    await assert('Invalid transition PENDING -> PACKED rejected', res11.status === 400);

    // Valid: PENDING -> CONFIRMED
    const res11b = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/status`, 'PATCH', adminToken, {
      status: 'CONFIRMED'
    });
    await assert('Valid transition PENDING -> CONFIRMED accepted', res11b.status === 200);

    // Valid: CONFIRMED -> PACKED
    const res11c = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/status`, 'PATCH', adminToken, {
      status: 'PACKED'
    });
    await assert('Valid transition CONFIRMED -> PACKED accepted', res11c.status === 200);

    // Valid: PACKED -> SHIPPED
    const res11d = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/status`, 'PATCH', adminToken, {
      status: 'SHIPPED'
    });
    await assert('Valid transition PACKED -> SHIPPED accepted', res11d.status === 200);

    // Valid: SHIPPED -> OUT_FOR_DELIVERY
    const res11e = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/status`, 'PATCH', adminToken, {
      status: 'OUT_FOR_DELIVERY'
    });
    await assert('Valid transition SHIPPED -> OUT_FOR_DELIVERY accepted', res11e.status === 200);

    // Valid: OUT_FOR_DELIVERY -> DELIVERED
    const res11f = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/status`, 'PATCH', adminToken, {
      status: 'DELIVERED'
    });
    await assert('Valid transition OUT_FOR_DELIVERY -> DELIVERED accepted', res11f.status === 200);

    // Verify stock clear reservation upon DELIVERED
    const { data: inventoryPostDelivered } = await supabaseAdmin.from('inventory_items').select('*').eq('store_id', testStore.id).eq('variant_id', testVariant.id).single();
    await assert('Stock reservation cleared upon DELIVERED', inventoryPostDelivered?.quantity_available === 9 && inventoryPostDelivered?.quantity_reserved === 0);

    // Verify status history
    const resHist = await makeRequest(`${baseUrl}/orders/${order2.order_id}/status-history`, 'GET', customer1Token);
    await assert('Status logs recorded for transition', resHist.status === 200 && resHist.body.data.length >= 6);

    // -------------------------------------------------------------------------
    // TEST 12: COD Collection & limits
    // -------------------------------------------------------------------------
    // Order 2 amount_due = 800.00
    // Try over collection
    const res12 = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/cod-collection`, 'POST', adminToken, {
      amountCollected: 900.00
    });
    await assert('COD over collection rejected', res12.status === 400);

    // Partial collection: 500
    const res12b = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/cod-collection`, 'POST', adminToken, {
      amountCollected: 500.00
    });
    await assert('COD partial collection accepted', res12b.status === 200 && res12b.body.data.paymentStatus === 'PENDING');

    // Remaining collection: 300
    const res12c = await makeRequest(`${baseUrl}/admin/orders/${order2.order_id}/cod-collection`, 'POST', adminToken, {
      amountCollected: 300.00
    });
    await assert('COD full collection accepted', res12c.status === 200 && res12c.body.data.paymentStatus === 'COLLECTED');

    // Verify DB update
    const { data: orderPostCollect } = await supabaseAdmin.from('orders').select('*').eq('id', order2.order_id).single();
    await assert('Payment status is now COLLECTED in DB', orderPostCollect?.payment_status === 'COLLECTED');
    await assert('COD amount collected equals due', Number(orderPostCollect?.cod_amount_collected) === 800.00);

  } catch (err) {
    console.error('[TEST SUITE RUNTIME ERROR]', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purge all temporary test fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up all temporary test fixtures...');
    try {
      if (createdOrderIds.length > 0) {
        try { await supabaseAdmin.from('return_status_history').delete().in('order_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('return_items').delete().in('order_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('return_requests').delete().in('order_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('order_status_history').delete().in('order_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('order_items').delete().in('order_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('coupon_redemptions').delete().in('order_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('stock_movements').delete().in('reference_id', createdOrderIds); } catch (e) {}
        try { await supabaseAdmin.from('orders').delete().in('id', createdOrderIds); } catch (e) {}
      }

      if (createdProductIds.length > 0) {
        try {
          const { data: vList } = await supabaseAdmin.from('product_variants').select('id').in('product_id', createdProductIds);
          if (vList && vList.length > 0) {
            const vIds = vList.map(v => v.id);
            try { await supabaseAdmin.from('order_items').delete().in('variant_id', vIds); } catch (e) {}
            try { await supabaseAdmin.from('inventory_items').delete().in('variant_id', vIds); } catch (e) {}
            try { await supabaseAdmin.from('cart_items').delete().in('variant_id', vIds); } catch (e) {}
            try { await supabaseAdmin.from('stock_movements').delete().in('variant_id', vIds); } catch (e) {}
            try { await supabaseAdmin.from('product_variants').delete().in('id', vIds); } catch (e) {}
          }
        } catch (e) {}
      }

      if (createdVariantIds.length > 0) {
        try { await supabaseAdmin.from('order_items').delete().in('variant_id', createdVariantIds); } catch (e) {}
        try { await supabaseAdmin.from('inventory_items').delete().in('variant_id', createdVariantIds); } catch (e) {}
        try { await supabaseAdmin.from('cart_items').delete().in('variant_id', createdVariantIds); } catch (e) {}
        try { await supabaseAdmin.from('stock_movements').delete().in('variant_id', createdVariantIds); } catch (e) {}
        try { await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds); } catch (e) {}
      }
      if (createdUserIds.length > 0) {
        try { await supabaseAdmin.from('carts').delete().in('user_id', createdUserIds); } catch (e) {}
      }

      if (createdProductIds.length > 0) {
        try { await supabaseAdmin.from('product_images').delete().in('product_id', createdProductIds); } catch (e) {}
        try { await supabaseAdmin.from('products').delete().in('id', createdProductIds); } catch (e) {}
      }
      if (createdCategoryIds.length > 0) {
        try { await supabaseAdmin.from('products').delete().in('category_id', createdCategoryIds); } catch (e) {}
        try { await supabaseAdmin.from('subcategories').delete().in('category_id', createdCategoryIds); } catch (e) {}
      }
      if (createdSubcategoryIds.length > 0) {
        try { await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds); } catch (e) {}
      }
      if (createdCategoryIds.length > 0) {
        try { await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds); } catch (e) {}
      }
      if (createdBrandIds.length > 0) {
        try { await supabaseAdmin.from('brands').delete().in('id', createdBrandIds); } catch (e) {}
      }
      if (createdSizeIds.length > 0) {
        try { await supabaseAdmin.from('sizes').delete().in('id', createdSizeIds); } catch (e) {}
      }
      if (createdColorIds.length > 0) {
        try { await supabaseAdmin.from('colors').delete().in('id', createdColorIds); } catch (e) {}
      }
      if (createdStoreIds.length > 0) {
        try { await supabaseAdmin.from('stores').delete().in('id', createdStoreIds); } catch (e) {}
      }
      if (createdCouponIds.length > 0) {
        try { await supabaseAdmin.from('coupons').delete().in('id', createdCouponIds); } catch (e) {}
      }
      if (createdZoneIds.length > 0) {
        try { await supabaseAdmin.from('delivery_zones').delete().in('id', createdZoneIds); } catch (e) {}
      }
      if (createdAddressIds.length > 0) {
        try { await supabaseAdmin.from('addresses').delete().in('id', createdAddressIds); } catch (e) {}
      }

      for (const uid of createdUserIds) {
        try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch (e) {}
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

runPhase4ETests();
