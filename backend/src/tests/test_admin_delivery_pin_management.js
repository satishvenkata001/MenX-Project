import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';

const baseUrl = 'http://localhost:5000/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('  MENX — ADMIN DELIVERY PIN CODE MANAGEMENT TESTS   ');
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

  // --- SECTION 1: SET UP ADMIN & CUSTOMER TEST SESSIONS ---
  console.log('--- SECTION 1: Setup Admin & Customer Authentication ---');

  // 1. Create Admin User
  const adminEmail = `admin_pin_mgr_${Date.now()}@menx.com`;
  const adminSignupRes = await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: adminEmail,
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'Manager',
      phone: '+91 9876543210'
    })
  });
  const adminSignupData = await adminSignupRes.json();
  const adminToken = adminSignupData.data?.session?.accessToken;
  const adminUserId = adminSignupData.data?.user?.id;

  // Elevate to SUPER_ADMIN
  await pool.query("UPDATE profiles SET role = 'SUPER_ADMIN' WHERE id = $1", [adminUserId]);
  await assert('Admin user created and elevated to SUPER_ADMIN', !!adminToken && !!adminUserId);

  // 2. Create Regular Customer User
  const customerEmail = `customer_pin_user_${Date.now()}@menx.com`;
  const customerSignupRes = await fetch(`${baseUrl}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: customerEmail,
      password: 'CustomerPassword123!',
      firstName: 'Customer',
      lastName: 'User',
      phone: '+91 9876543211'
    })
  });
  const customerSignupData = await customerSignupRes.json();
  const customerToken = customerSignupData.data?.session?.accessToken;
  const customerUserId = customerSignupData.data?.user?.id;
  await assert('Customer user created for permission and checkout tests', !!customerToken && !!customerUserId);

  // --- SECTION 2: RBAC AUTHORIZATION ENFORCEMENT ---
  console.log('\n--- SECTION 2: RBAC Authorization ---');

  const unauthRes = await fetch(`${baseUrl}/admin/delivery-zones`);
  await assert('Unauthenticated request to /admin/delivery-zones rejected (HTTP 401)', unauthRes.status === 401);

  const customerAccessRes = await fetch(`${baseUrl}/admin/delivery-zones`, {
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });
  await assert('Customer role denied access to /admin/delivery-zones (HTTP 403)', customerAccessRes.status === 403);

  const adminAccessRes = await fetch(`${baseUrl}/admin/delivery-zones`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  await assert('Super Admin granted access to /admin/delivery-zones (HTTP 200)', adminAccessRes.status === 200);

  // --- SECTION 3: LISTING, PAGINATION & SEARCH ---
  console.log('\n--- SECTION 3: Listing, Pagination & Search ---');

  const listData = (await adminAccessRes.json()).data;
  await assert('Delivery zones listing returns array of zones', Array.isArray(listData.zones));
  await assert('Pagination metadata returns total >= 1262', listData.pagination?.total >= 1262);
  await assert('Summary stats return activeCount and totalConfigured', listData.summary?.activeCount > 0 && listData.summary?.totalConfigured >= 1262);

  // Search existing PIN 534340
  const searchPinRes = await fetch(`${baseUrl}/admin/delivery-zones?search=534340`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const searchPinData = (await searchPinRes.json()).data;
  const found534340 = searchPinData.zones?.find(z => z.pincode === '534340');
  await assert('Search by PIN "534340" finds existing Talapudi zone', !!found534340 && found534340.isActive === true);

  // Search by Region / District
  const searchDistRes = await fetch(`${baseUrl}/admin/delivery-zones?search=Anakapalli`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const searchDistData = (await searchDistRes.json()).data;
  await assert('Search by district name "Anakapalli" returns matching zones', searchDistData.zones?.length > 0);

  // Filter by State
  const filterStateRes = await fetch(`${baseUrl}/admin/delivery-zones?state=Andhra%20Pradesh`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const filterStateData = (await filterStateRes.json()).data;
  await assert('Filter by state "Andhra Pradesh" returns valid zones', filterStateData.zones?.length > 0);

  // --- SECTION 4: ADD PIN CODE & VALIDATION RULES ---
  console.log('\n--- SECTION 4: Add Delivery PIN Code & Validation ---');

  const testPin1 = '517991';

  // Add valid PIN
  const addRes1 = await fetch(`${baseUrl}/admin/delivery-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      pincode: testPin1,
      state: 'Andhra Pradesh',
      district: 'Tirupati Test Area',
      isActive: true,
      baseDeliveryCharge: 20.00
    })
  });
  const addData1 = await addRes1.json();
  const createdZoneId1 = addData1.data?.id;
  await assert(`Add valid PIN ${testPin1} succeeds (HTTP 201)`, addRes1.status === 201 && !!createdZoneId1);
  await assert('Created zone matches submitted PIN and Active status', addData1.data?.pincode === testPin1 && addData1.data?.isActive === true);

  // Duplicate PIN rejection
  const dupRes = await fetch(`${baseUrl}/admin/delivery-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      pincode: testPin1,
      state: 'Andhra Pradesh',
      district: 'Duplicate Attempt'
    })
  });
  const dupData = await dupRes.json();
  await assert('Duplicate PIN code insertion correctly rejected (HTTP 400)', dupRes.status === 400 && dupData.message?.includes('already configured'));

  // 5-digit PIN rejection
  const res5Digit = await fetch(`${baseUrl}/admin/delivery-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      pincode: '51799',
      state: 'Andhra Pradesh'
    })
  });
  await assert('5-digit PIN rejected by admin validator (HTTP 400)', res5Digit.status === 400);

  // 7-digit PIN rejection
  const res7Digit = await fetch(`${baseUrl}/admin/delivery-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      pincode: '5179999',
      state: 'Andhra Pradesh'
    })
  });
  await assert('7-digit PIN rejected by admin validator (HTTP 400)', res7Digit.status === 400);

  // Alphabetic PIN rejection
  const resAlpha = await fetch(`${baseUrl}/admin/delivery-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      pincode: '5179AB',
      state: 'Andhra Pradesh'
    })
  });
  await assert('Alphabetic PIN rejected by admin validator (HTTP 400)', resAlpha.status === 400);

  // Surrounding whitespace normalized
  const testPin2 = '517992';
  const resWhitespace = await fetch(`${baseUrl}/admin/delivery-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      pincode: `  ${testPin2}  `,
      state: 'Andhra Pradesh',
      district: 'Whitespace Test Area'
    })
  });
  const dataWhitespace = await resWhitespace.json();
  const createdZoneId2 = dataWhitespace.data?.id;
  await assert('PIN with whitespace normalized and created with trimmed 6 digits', resWhitespace.status === 201 && dataWhitespace.data?.pincode === testPin2);

  // --- SECTION 5: DYNAMIC TOGGLE & CUSTOMER CHECKOUT VALIDATION ---
  console.log('\n--- SECTION 5: Dynamic Toggle & Customer Delivery Validation ---');

  // 1. Prepare customer cart with an active product
  const variantRes = await pool.query(`
    SELECT v.id FROM product_variants v
    JOIN products p ON p.id = v.product_id
    JOIN inventory_items i ON i.variant_id = v.id
    WHERE v.is_active = true AND p.status = 'PUBLISHED' AND i.quantity_available >= 5
    LIMIT 1
  `);
  const testVariantId = variantRes.rows[0].id;

  // Customer adds item to cart
  await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ variantId: testVariantId, quantity: 1 })
  });

  // Customer creates shipping address using testPin1 (517991)
  const custAddrRes = await fetch(`${baseUrl}/addresses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({
      recipientName: 'AP Test Recipient',
      phoneNumber: '9876543210',
      addressLine1: 'Test Address Line',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      postalCode: testPin1,
      addressType: 'HOME'
    })
  });
  const custAddrData = await custAddrRes.json();
  const custAddrId = custAddrData.data?.id;

  // Step A: While testPin1 is ACTIVE, customer validation MUST SUCCEED
  const custValRes1 = await fetch(`${baseUrl}/checkout/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ addressId: custAddrId })
  });
  const custValData1 = await custValRes1.json();
  await assert(`Customer validation for ACTIVE PIN ${testPin1} succeeds (HTTP 200)`, custValRes1.status === 200 && custValData1.success === true);

  // Step B: Admin DEACTIVATES testPin1
  const toggleOffRes = await fetch(`${baseUrl}/admin/delivery-zones/${createdZoneId1}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ isActive: false })
  });
  const toggleOffData = await toggleOffRes.json();
  await assert(`Admin deactivates PIN ${testPin1} (isActive: false)`, toggleOffRes.status === 200 && toggleOffData.data?.isActive === false);

  // Step C: Customer validation MUST NOW REJECT testPin1
  const custValRes2 = await fetch(`${baseUrl}/checkout/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ addressId: custAddrId })
  });
  const custValData2 = await custValRes2.json();
  await assert(`Customer validation for DEACTIVATED PIN ${testPin1} correctly rejected (HTTP 400)`, custValRes2.status === 400 && custValData2.message?.includes('No shipping service available'));

  // Step D: Admin REACTIVATES testPin1
  const toggleOnRes = await fetch(`${baseUrl}/admin/delivery-zones/${createdZoneId1}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ isActive: true })
  });
  const toggleOnData = await toggleOnRes.json();
  await assert(`Admin reactivates PIN ${testPin1} (isActive: true)`, toggleOnRes.status === 200 && toggleOnData.data?.isActive === true);

  // Step E: Customer validation MUST SUCCEED AGAIN
  const custValRes3 = await fetch(`${baseUrl}/checkout/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ addressId: custAddrId })
  });
  const custValData3 = await custValRes3.json();
  await assert(`Customer validation for REACTIVATED PIN ${testPin1} succeeds again (HTTP 200)`, custValRes3.status === 200 && custValData3.success === true);

  // --- SECTION 6: SAFE DELETION ---
  console.log('\n--- SECTION 6: Safe Deletion ---');

  const delRes1 = await fetch(`${baseUrl}/admin/delivery-zones/${createdZoneId1}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  await assert(`Admin deletes test PIN ${testPin1} (HTTP 200)`, delRes1.status === 200);

  const delRes2 = await fetch(`${baseUrl}/admin/delivery-zones/${createdZoneId2}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  await assert(`Admin deletes test PIN ${testPin2} (HTTP 200)`, delRes2.status === 200);

  // Verify PIN is gone from database
  const verifyDelRes = await pool.query('SELECT id FROM delivery_zones WHERE pincode_pattern IN ($1, $2)', [testPin1, testPin2]);
  await assert('Deleted test PINs are no longer present in delivery_zones table', verifyDelRes.rows.length === 0);

  // --- SECTION 7: CLEANUP ---
  console.log('\n--- Cleaning up test fixtures ---');
  if (custAddrId) {
    await supabaseAdmin.from('addresses').delete().eq('id', custAddrId);
  }
  if (customerUserId) {
    await supabaseAdmin.from('carts').delete().eq('user_id', customerUserId);
    await supabaseAdmin.from('profiles').delete().eq('id', customerUserId);
    await supabaseAdmin.auth.admin.deleteUser(customerUserId);
  }
  if (adminUserId) {
    await supabaseAdmin.from('profiles').delete().eq('id', adminUserId);
    await supabaseAdmin.auth.admin.deleteUser(adminUserId);
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
  try { await pool.end(); } catch (e) { }
  process.exit(1);
});
