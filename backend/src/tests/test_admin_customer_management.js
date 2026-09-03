import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runTests() {
  console.log('================================================================');
  console.log('         MENX ADMIN CUSTOMER MANAGEMENT TEST SUITE');
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
  const createdOrderIds = [];
  const createdAddressIds = [];

  let adminToken = null;
  let adminUserId = null;
  let customer1Token = null;
  let customer1UserId = null;
  let customer2Token = null;
  let customer2UserId = null;

  try {
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

    console.log('>>> Creating test accounts...');
    const admin = await createUser(`admin.cust.${ts}@menx.com`, 'AdminUser', 'SUPER_ADMIN');
    adminUserId = admin.uid;
    adminToken = admin.token;

    const c1 = await createUser(`cust1.cust.${ts}@menx.com`, 'ZeroOrdersCust');
    customer1UserId = c1.uid;
    customer1Token = c1.token;

    const c2 = await createUser(`cust2.cust.${ts}@menx.com`, 'MultiOrdersCust');
    customer2UserId = c2.uid;
    customer2Token = c2.token;

    // Get active store
    const { data: store, error: storeErr } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (storeErr || !store) throw new Error('Active store required for tests');
    const storeId = store.id;

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
    // TEST 1: Admin authorized to access customer list
    // -------------------------------------------------------------------------
    const res1 = await makeRequest(`${baseUrl}/admin/customers`, 'GET', adminToken);
    await assert('Admin authorized to list customers', res1.status === 200);
    await assert('Response contains customers list', Array.isArray(res1.body?.data?.customers));

    // -------------------------------------------------------------------------
    // TEST 2: Normal customer blocked from accessing list (RBAC check)
    // -------------------------------------------------------------------------
    const res2 = await makeRequest(`${baseUrl}/admin/customers`, 'GET', customer1Token);
    await assert('Customer blocked from listing customers', res2.status === 403);

    // -------------------------------------------------------------------------
    // TEST 3: Invalid customer ID details request returns 404
    // -------------------------------------------------------------------------
    const invalidId = '44444444-4444-4444-4444-444444444444';
    const res3 = await makeRequest(`${baseUrl}/admin/customers/${invalidId}`, 'GET', adminToken);
    await assert('Invalid customer details request returns 404', res3.status === 404);

    // -------------------------------------------------------------------------
    // TEST 4: Customer with zero orders details is accurate
    // -------------------------------------------------------------------------
    const res4 = await makeRequest(`${baseUrl}/admin/customers/${customer1UserId}`, 'GET', adminToken);
    await assert('Fetched zero-orders customer successfully', res4.status === 200);
    const details1 = res4.body?.data;
    await assert('Zero-orders stats: total_orders = 0', details1?.statistics?.total_orders === 0);
    await assert('Zero-orders stats: total_spent = 0', details1?.statistics?.total_spent === 0);
    await assert('Zero-orders has empty orders list', details1?.orders?.length === 0);
    await assert('Zero-orders has empty addresses list', details1?.addresses?.length === 0);

    // Setup orders for customer 2 (Multi-orders)
    console.log('>>> Inserting test orders and addresses...');
    const orderInserts = [
      {
        order_number: `T-ORD-1-${ts}`,
        customer_id: customer2UserId,
        store_id: storeId,
        order_status: 'DELIVERED',
        total_payable: 1200.00,
        subtotal_amount: 1200.00,
        cod_amount_due: 1200.00,
        shipping_snapshot: {},
        customer_phone: '9999999999'
      },
      {
        order_number: `T-ORD-2-${ts}`,
        customer_id: customer2UserId,
        store_id: storeId,
        order_status: 'PENDING',
        total_payable: 450.00,
        subtotal_amount: 450.00,
        cod_amount_due: 450.00,
        shipping_snapshot: {},
        customer_phone: '9999999999'
      },
      {
        order_number: `T-ORD-3-${ts}`,
        customer_id: customer2UserId,
        store_id: storeId,
        order_status: 'CANCELLED',
        total_payable: 800.00,
        subtotal_amount: 800.00,
        cod_amount_due: 800.00,
        shipping_snapshot: {},
        customer_phone: '9999999999'
      }
    ];

    const { data: createdOrders, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert(orderInserts)
      .select();
    if (orderErr || !createdOrders) throw new Error(`Orders insert failed: ${orderErr.message}`);
    createdOrders.forEach(o => createdOrderIds.push(o.id));

    // Setup addresses for customer 2 (Multi-addresses)
    const addressInserts = [
      {
        user_id: customer2UserId,
        recipient_name: 'Recipient One',
        phone_number: '9999999999',
        address_line1: 'Address 1',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400001',
        is_default: true
      },
      {
        user_id: customer2UserId,
        recipient_name: 'Recipient Two',
        phone_number: '8888888888',
        address_line1: 'Address 2',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411001',
        is_default: false
      }
    ];

    const { data: createdAddresses, error: addrErr } = await supabaseAdmin
      .from('addresses')
      .insert(addressInserts)
      .select();
    if (addrErr || !createdAddresses) throw new Error(`Addresses insert failed: ${addrErr.message}`);
    createdAddresses.forEach(a => createdAddressIds.push(a.id));

    // -------------------------------------------------------------------------
    // TEST 5: Customer with multiple orders details is correct
    // -------------------------------------------------------------------------
    const res5 = await makeRequest(`${baseUrl}/admin/customers/${customer2UserId}`, 'GET', adminToken);
    await assert('Fetched multi-orders customer details successfully', res5.status === 200);
    const details2 = res5.body?.data;
    await assert('Multi-orders stats: total_orders = 3', details2?.statistics?.total_orders === 3);
    
    // DELIVERED = 1200, PENDING = 450, CANCELLED = 800 (excluded). Total Spent = 1200 + 450 = 1650
    await assert('Multi-orders stats: total_spent = 1650 (cancelled excluded)', details2?.statistics?.total_spent === 1650.00);
    await assert('Multi-orders stats: delivered_orders = 1', details2?.statistics?.delivered_orders === 1);
    await assert('Multi-orders stats: pending_orders = 1', details2?.statistics?.pending_orders === 1);
    await assert('Multi-orders stats: cancelled_orders = 1', details2?.statistics?.cancelled_orders === 1);
    
    // -------------------------------------------------------------------------
    // TEST 6: Addresses match and belong only to customer 2
    // -------------------------------------------------------------------------
    await assert('Addresses list contains 2 entries', details2?.addresses?.length === 2);
    await assert('Addresses list is sorted with default address first', details2?.addresses?.[0]?.is_default === true);
    const allBelongToCustomer = details2?.addresses?.every(a => createdAddressIds.includes(a.id));
    await assert('Addresses belong strictly to this customer', allBelongToCustomer === true);

    // -------------------------------------------------------------------------
    // TEST 7: Normal customer blocked from details page (RBAC check)
    // -------------------------------------------------------------------------
    const res7 = await makeRequest(`${baseUrl}/admin/customers/${customer2UserId}`, 'GET', customer2Token);
    await assert('Customer blocked from viewing details of another customer', res7.status === 403);

  } catch (err) {
    console.error('Test execution error:', err.message);
  } finally {
    // Cleanup
    console.log('\n>>> Cleaning up test fixtures...');
    if (createdOrderIds.length > 0) {
      await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
    }
    if (createdAddressIds.length > 0) {
      await supabaseAdmin.from('addresses').delete().in('id', createdAddressIds);
    }
    if (createdUserIds.length > 0) {
      for (const uid of createdUserIds) {
        await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      }
    }

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} PASSED`);
    console.log('================================================================\n');

    server.close();
    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runTests();
