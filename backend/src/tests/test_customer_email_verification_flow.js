import { env } from '../config/env.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import http from 'http';
import app from '../app.js';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      console.log(`Test server running on ${baseUrl}`);
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Customer Email Verification & Authentication Flow');
  console.log('================================================================\n');

  await startServer();

  const timestamp = Date.now();
  const testCustomerEmail = `test.menx.customer.${timestamp}@menxfashion.test`;
  const testPassword = 'Password@123!';
  const testAdminEmail = `test.menx.admin.${timestamp}@menxfashion.test`;
  let customerUserId = null;
  let adminUserId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Invalid Registration Payload Validations (Zod)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Validation Tests ---');
    const invalidEmailRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password: 'short',
        firstName: '',
        phone: 'invalid'
      })
    });
    assert(invalidEmailRes.status === 400, 'Invalid registration payload rejected with HTTP 400');
    const invalidEmailData = await invalidEmailRes.json();
    assert(invalidEmailData.status === 'fail', 'Response status is "fail"');

    // -------------------------------------------------------------------------
    // TEST 2: Customer Registration via Supabase Auth
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Customer Registration Flow ---');
    // We test standard signUp with options (name, mobile, emailRedirectTo)
    const authClient = createAuthClient();
    const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
      email: testCustomerEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Vikram',
          last_name: 'Rao',
          phone: '+91 9900112233'
        },
        emailRedirectTo: `${env.FRONTEND_URL}/login`
      }
    });

    assert(!signUpError, `Supabase signUp succeeded without error: ${signUpError?.message || ''}`);
    assert(!!signUpData?.user?.id, 'Supabase returned created user ID');
    customerUserId = signUpData.user.id;

    // Verify profile creation in database
    const { data: profileData, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', customerUserId)
      .single();

    assert(!profileErr && !!profileData, 'Customer profile record created in database');
    assert(profileData.first_name === 'Vikram', 'Profile first_name matches registration');
    assert(profileData.role === 'CUSTOMER', 'Profile role is CUSTOMER');

    // -------------------------------------------------------------------------
    // TEST 3: Auto-Login Prevention Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Auto-Login Prevention & Verification-Pending State ---');
    // Direct API signup test with unconfirmed account
    const unconfirmedEmail = `test.unconf.${timestamp}@menxfashion.test`;
    const apiSignupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: unconfirmedEmail,
        password: testPassword,
        firstName: 'Unconfirmed',
        lastName: 'Customer',
        phone: '+91 9988776655'
      })
    });
    assert(apiSignupRes.status === 201, 'Customer signup endpoint returns HTTP 201 Created');
    const apiSignupData = await apiSignupRes.json();
    assert(!apiSignupData.data?.session?.accessToken, 'Auto-login prevented: signup does not return active session token for unverified customer');
    if (apiSignupData.data?.user?.id) {
      await supabaseAdmin.auth.admin.deleteUser(apiSignupData.data.user.id).catch(() => {});
    }

    // -------------------------------------------------------------------------
    // TEST 4: Resend Verification Link Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Resend Verification Link Endpoint ---');
    const resendRes = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail })
    });
    const resendData = await resendRes.json();
    assert(resendRes.status === 200 || resendRes.status === 429 || resendRes.status === 400, 'Resend endpoint responds appropriately');

    // -------------------------------------------------------------------------
    // TEST 4: Unverified User Login Attempt
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Unverified Customer Login Attempt ---');
    // If Supabase confirmations are active, user cannot log in until email confirmed
    // Check if user is unconfirmed
    const { data: freshUser } = await supabaseAdmin.auth.admin.getUserById(customerUserId);
    if (!freshUser.user.email_confirmed_at) {
      const unverifiedLoginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testCustomerEmail, password: testPassword })
      });
      assert(unverifiedLoginRes.status === 403, 'Unverified user login rejected with HTTP 403');
      const unverifiedData = await unverifiedLoginRes.json();
      assert(unverifiedData.message.toLowerCase().includes('confirm') || unverifiedData.message.toLowerCase().includes('verify'), 'Error message informs user to verify email');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Email Verification Confirmation & Normal Email+Password Login
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Confirm Email & Test Email+Password Login ---');
    // Simulate email confirmation by Supabase
    await supabaseAdmin.auth.admin.updateUserById(customerUserId, { email_confirm: true });

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'Verified customer login succeeds with HTTP 200');
    assert(!!loginData.data?.session?.accessToken, 'Access token returned in session');
    assert(loginData.data?.user?.email === testCustomerEmail, 'User email matches in session');
    assert(loginData.data?.profile?.role === 'CUSTOMER', 'Profile role is CUSTOMER');

    const customerToken = loginData.data.session.accessToken;

    // -------------------------------------------------------------------------
    // TEST 6: Authenticated Profile & Session Check
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Authenticated Session /me Endpoint ---');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /auth/me succeeds with Bearer token');
    assert(meData.data?.user?.id === customerUserId, 'User ID matches authenticated customer');

    // -------------------------------------------------------------------------
    // TEST 7: Incorrect Password Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Incorrect Password Rejection ---');
    const wrongPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, password: 'WrongPassword999!' })
    });
    assert(wrongPassRes.status === 401, 'Wrong password rejected with HTTP 401');

    // -------------------------------------------------------------------------
    // TEST 8: Duplicate Email Registration Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Duplicate Email Registration ---');
    const dupSignupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCustomerEmail,
        password: testPassword,
        firstName: 'Vikram',
        lastName: 'Rao',
        phone: '+91 9900112233'
      })
    });
    assert(dupSignupRes.status === 400, 'Duplicate registration rejected with HTTP 400');

    // -------------------------------------------------------------------------
    // TEST 9: Customer Cannot Access Protected Admin Endpoints
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Customer RBAC Protection ---');
    const customerAdminRes = await fetch(`${baseUrl}/admin/customers`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert(customerAdminRes.status === 403, 'Customer forbidden from /api/v1/admin/* (HTTP 403)');

    // -------------------------------------------------------------------------
    // TEST 10: Admin Authentication & Access
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Admin Authentication ---');
    const { data: adminAuthData, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: testAdminEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { first_name: 'Admin', last_name: 'User', phone: '+91 9000000000' }
    });
    assert(!adminAuthErr && !!adminAuthData.user, 'Admin user created successfully');
    adminUserId = adminAuthData.user.id;

    // Update profile role to SUPER_ADMIN
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', adminUserId);

    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAdminEmail, password: testPassword })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login succeeds with HTTP 200');
    assert(adminLoginData.data?.profile?.role === 'SUPER_ADMIN', 'Admin profile role is SUPER_ADMIN');

    const adminToken = adminLoginData.data.session.accessToken;
    const adminAccessRes = await fetch(`${baseUrl}/admin/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminAccessRes.status === 200, 'Admin successfully accesses /api/v1/admin/customers (HTTP 200)');

    console.log('\n================================================================');
    console.log('✅ ALL CUSTOMER EMAIL VERIFICATION & AUTH TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    // Cleanup created test users
    console.log('Cleaning up test users...');
    if (customerUserId) {
      await supabaseAdmin.auth.admin.deleteUser(customerUserId).catch(() => {});
    }
    if (adminUserId) {
      await supabaseAdmin.auth.admin.deleteUser(adminUserId).catch(() => {});
    }
    await stopServer();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
