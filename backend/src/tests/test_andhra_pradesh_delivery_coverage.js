import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
import { validateCheckout, createOrder } from '../services/order.service.js';
import { seedAndhraPradeshPincodes } from '../../../database/scripts/seed_andhra_pradesh_pincodes.js';

const baseUrl = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('  MENX — ANDHRA PRADESH PIN CODE EXPANSION TESTS   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function assert(desc, condition) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // --- SECTION 1: DATA QUALITY & DATABASE INTEGRITY ---
  console.log('--- SECTION 1: Database & Data Quality ---');

  const countRes = await pool.query('SELECT COUNT(*) FROM delivery_zones WHERE is_active = true');
  const totalActive = parseInt(countRes.rows[0].count, 10);
  await assert('Database contains exactly 1262 active delivery zones', totalActive === 1262);

  const duplicateCheck = await pool.query(`
    SELECT pincode_pattern, COUNT(*) 
    FROM delivery_zones 
    GROUP BY pincode_pattern 
    HAVING COUNT(*) > 1
  `);
  await assert('Zero duplicate pincode_patterns exist in delivery_zones', duplicateCheck.rows.length === 0);

  const formatCheck = await pool.query(`
    SELECT pincode_pattern 
    FROM delivery_zones 
    WHERE pincode_pattern !~ '^\\d{6}$'
  `);
  await assert('All delivery_zone pincode_patterns are strictly 6 numeric digits', formatCheck.rows.length === 0);

  // Check existing 534340
  const pin534340 = await pool.query("SELECT * FROM delivery_zones WHERE pincode_pattern = '534340'");
  await assert('Original PIN 534340 exists and is active', pin534340.rows.length === 1 && pin534340.rows[0].is_active === true);

  // Verify Idempotency
  console.log('\n--- SECTION 2: Seed Idempotency ---');
  const seedStats = await seedAndhraPradeshPincodes();
  await assert('Re-running seed results in 0 new insertions (idempotent)', seedStats.insertedCount === 0);
  await assert('Re-running seed skips all 1262 existing PINs', seedStats.alreadyExistingCount === 1262);

  // --- SECTION 3: AUTHENTICATION & SETUP FOR API TESTING ---
  console.log('\n--- SECTION 3: Setting Up Test Customer & Cart ---');
  const testEmail = `ap_pincode_test_${Date.now()}@menx-test.com`;
  const testPassword = 'TestPassword123!';
  
  // Register customer
  const authRes = await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      firstName: 'AP Delivery',
      lastName: 'Tester',
      phone: '+91 9876543210'
    })
  });
  const authData = await authRes.json();
  const token = authData.data?.session?.access_token || authData.data?.session?.accessToken;
  const user = authData.data?.user;
  await assert('Test customer registered successfully', !!token && !!user);

  // Add a published in-stock product variant to cart
  const variantRes = await pool.query(`
    SELECT v.id, v.selling_price, i.quantity_available
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    JOIN inventory_items i ON i.variant_id = v.id
    WHERE v.is_active = true 
      AND p.status = 'PUBLISHED' 
      AND i.quantity_available >= 5
    LIMIT 1
  `);

  let variant = variantRes.rows[0];
  if (!variant) {
    // If none with >= 5, pick any published variant and top up inventory
    const anyVariantRes = await pool.query(`
      SELECT v.id FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active = true AND p.status = 'PUBLISHED'
      LIMIT 1
    `);
    const varId = anyVariantRes.rows[0].id;
    await pool.query(`
      UPDATE inventory_items 
      SET quantity_available = 50 
      WHERE variant_id = $1
    `, [varId]);
    variant = { id: varId };
  }

  await assert('Active product variant with stock retrieved for test', !!variant);

  // Add item to cart
  const addToCartRes = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      variantId: variant.id,
      quantity: 1
    })
  });
  const addToCartData = await addToCartRes.json();
  await assert('Item added to cart', addToCartRes.status === 200 || addToCartRes.status === 201);

  // --- SECTION 4: ADDRESS CREATION & PIN VALIDATION TESTS ---
  console.log('\n--- SECTION 4: Address API & PIN Format Validation ---');

  // Helper to create address
  async function testCreateAddress(postalCode, expectedStatus, expectedSuccess) {
    const res = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipientName: 'Test AP Recipient',
        phoneNumber: '9876543210',
        addressLine1: 'Main Street Road',
        city: 'Sample City',
        state: 'Andhra Pradesh',
        postalCode: postalCode,
        addressType: 'HOME'
      })
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // Test 5-digit PIN
  const res5Digit = await testCreateAddress('53434', 400, false);
  await assert('5-digit PIN rejected by address validator', res5Digit.status === 400);

  // Test 7-digit PIN
  const res7Digit = await testCreateAddress('5343400', 400, false);
  await assert('7-digit PIN rejected by address validator', res7Digit.status === 400);

  // Test alphabetic PIN
  const resAlpha = await testCreateAddress('ABCDE1', 400, false);
  await assert('Alphabetic PIN rejected by address validator', resAlpha.status === 400);

  // Test PIN with whitespace (e.g. " 534340 ")
  const resWhitespace = await testCreateAddress('  534340  ', 201, true);
  await assert('PIN with surrounding whitespace accepted and normalized', resWhitespace.status === 201 && resWhitespace.data?.data?.postalCode === '534340');

  // --- SECTION 5: DELIVERY VALIDATION ACROSS ANDHRA PRADESH ---
  console.log('\n--- SECTION 5: Delivery Validation for Valid AP PIN Codes ---');

  const apTestPins = [
    { pin: '534340', location: 'Talapudi (West Godavari - Existing)' },
    { pin: '520001', location: 'Vijayawada (NTR / Krishna)' },
    { pin: '530001', location: 'Visakhapatnam' },
    { pin: '517501', location: 'Tirupati' },
    { pin: '522001', location: 'Guntur' },
    { pin: '518001', location: 'Kurnool' },
    { pin: '515001', location: 'Anantapur' },
    { pin: '516001', location: 'Kadapa (YSR)' },
    { pin: '524001', location: 'Nellore (SPSR Nellore)' },
    { pin: '532001', location: 'Srikakulam' },
    { pin: '533001', location: 'Kakinada' },
    { pin: '535001', location: 'Vizianagaram' },
    { pin: '534001', location: 'Eluru' }
  ];

  for (const item of apTestPins) {
    const addr = await testCreateAddress(item.pin, 201, true);
    const addrId = addr.data?.data?.id;

    const valRes = await fetch(`${baseUrl}/checkout/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ addressId: addrId })
    });
    const valData = await valRes.json();
    await assert(
      `AP PIN ${item.pin} (${item.location}) -> Delivery Available (HTTP 200, fee: ${valData.data?.deliveryFee})`,
      valRes.status === 200 && valData.success === true && valData.data?.deliveryFee !== undefined
    );
  }

  // --- SECTION 6: REJECTION OF NON-AP & INVALID PIN CODES ---
  console.log('\n--- SECTION 6: Non-AP & Invalid PIN Codes Rejection ---');

  const nonApPins = [
    { pin: '560001', location: 'Bengaluru (Karnataka)' },
    { pin: '500001', location: 'Hyderabad (Telangana)' },
    { pin: '110001', location: 'New Delhi (Delhi)' },
    { pin: '400001', location: 'Mumbai (Maharashtra)' },
    { pin: '600001', location: 'Chennai (Tamil Nadu)' },
    { pin: '700001', location: 'Kolkata (West Bengal)' },
    { pin: '599999', location: 'Non-existent 6-digit PIN' }
  ];

  for (const item of nonApPins) {
    const addr = await testCreateAddress(item.pin, 201, true);
    const addrId = addr.data?.data?.id;

    const valRes = await fetch(`${baseUrl}/checkout/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ addressId: addrId })
    });
    const valData = await valRes.json();
    await assert(
      `Non-AP PIN ${item.pin} (${item.location}) -> Rejected with "No shipping service" (HTTP 400)`,
      valRes.status === 400 && valData.message?.includes('No shipping service available')
    );

    // Also verify that attempting to place an order with unsupported PIN fails server-side
    const orderAttemptRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        addressId: addrId,
        paymentMethod: 'COD'
      })
    });
    const orderAttemptData = await orderAttemptRes.json();
    await assert(
      `Non-AP PIN ${item.pin} order creation blocked by server-side atomic validation`,
      orderAttemptRes.status === 400 && orderAttemptData.message?.includes('No shipping service available')
    );
  }

  // --- SECTION 7: END-TO-END CHECKOUT & ORDER CREATION FOR AP PIN ---
  console.log('\n--- SECTION 7: End-to-End Order Creation with AP PIN ---');

  // Create order with Vijayawada PIN 520001
  const validApAddr = await testCreateAddress('520001', 201, true);
  const validAddrId = validApAddr.data?.data?.id;

  const orderRes = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      addressId: validAddrId,
      paymentMethod: 'COD',
      customerNotes: 'AP Wide Delivery Test Order'
    })
  });
  const orderData = await orderRes.json();
  const createdOrder = orderData.data;
  const createdOrderId = createdOrder?.order_id || createdOrder?.id;

  await assert('Order placed successfully with AP PIN 520001', orderRes.status === 201 && !!createdOrderId);
  await assert('Created order has valid delivery fee (20.00)', Number(createdOrder?.delivery_fee) === 20.00);

  const dbOrder = await pool.query('SELECT order_status, total_payable FROM orders WHERE id = $1', [createdOrderId]);
  await assert('Database order record verified with status PENDING', dbOrder.rows[0]?.order_status === 'PENDING');

  // --- CLEANUP ---
  console.log('\n--- Cleaning up test user and order ---');
  if (createdOrderId) {
    await supabaseAdmin.from('order_status_history').delete().eq('order_id', createdOrderId);
    await supabaseAdmin.from('order_items').delete().eq('order_id', createdOrderId);
    await supabaseAdmin.from('orders').delete().eq('id', createdOrderId);
  }
  if (user?.id) {
    await supabaseAdmin.from('addresses').delete().eq('user_id', user.id);
    await supabaseAdmin.from('cart_items').delete().match({ cart_id: addToCartData.data?.cart?.id });
    await supabaseAdmin.from('carts').delete().eq('user_id', user.id);
    await supabaseAdmin.from('profiles').delete().eq('id', user.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await pool.end();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(async (err) => {
  console.error('Test execution failed:', err);
  try { await pool.end(); } catch (e) {}
  process.exit(1);
});
