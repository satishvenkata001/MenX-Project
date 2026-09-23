import { env } from '../config/env.js';
import { supabaseAdmin, createAuthClient, createUserClient } from '../config/supabase.js';
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
  console.log('TEST SUITE: MENX SIMPLE EMAIL/PASSWORD AUTHENTICATION');
  console.log('1. Registration (Immediate Account Creation, Supabase signUp)');
  console.log('2. Sign In with Email and Password');
  console.log('3. Forgot Password & Secure Password Reset');
  console.log('4. Verification that Magic Link is Removed');
  console.log('================================================================\n');

  await startServer();

  const timestamp = Date.now();
  const testCustomerEmail = `menx.auth.test.${timestamp}@gmail.com`;
  const testPassword = 'Password@123!';
  const newPassword = 'NewPassword@456!';
  let customerUserId = null;

  try {
    // =========================================================================
    // FLOW 1: REGISTRATION (Supabase signUp)
    // =========================================================================
    console.log('\n================================================================');
    console.log('FLOW 1: REGISTRATION');
    console.log('================================================================');

    // 1.1 Validation
    const invalidSignupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123',
        firstName: '',
        phone: 'bad-phone'
      })
    });
    assert(invalidSignupRes.status === 400, '1.1 Invalid registration rejected with HTTP 400');

    // 1.2 Customer Registration via POST /auth/signup
    const signupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Vikram',
        lastName: 'Rao',
        phone: '+91 9900112233',
        email: testCustomerEmail,
        password: testPassword
      })
    });
    const signupData = await signupRes.json();
    assert(signupRes.status === 201, '1.2 Registration endpoint returns HTTP 201 Created');
    assert(!!signupData.data?.user?.id, '1.2 Created user ID returned');
    customerUserId = signupData.data.user.id;

    // 1.3 Verify profile in database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', customerUserId)
      .single();
    assert(profile?.first_name === 'Vikram', '1.3 Customer profile created in database');
    assert(profile?.role === 'CUSTOMER', '1.3 Profile role is CUSTOMER');

    // Ensure email is confirmed for the created user
    await supabaseAdmin.auth.admin.updateUserById(customerUserId, { email_confirm: true });

    // =========================================================================
    // FLOW 2: SIGN IN WITH EMAIL & PASSWORD
    // =========================================================================
    console.log('\n================================================================');
    console.log('FLOW 2: SIGN IN WITH EMAIL & PASSWORD');
    console.log('================================================================');

    // 2.1 Incorrect password rejected
    const wrongPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, password: 'WrongPassword999!' })
    });
    assert(wrongPassRes.status === 401, '2.1 Incorrect password rejected with HTTP 401');

    // 2.2 Correct password sign-in
    const passwordLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, password: testPassword })
    });
    const passwordLoginData = await passwordLoginRes.json();
    assert(passwordLoginRes.status === 200, '2.2 Password login succeeds with HTTP 200');
    assert(!!passwordLoginData.data?.session?.accessToken, '2.2 Access token returned in session');
    assert(passwordLoginData.data?.user?.email === testCustomerEmail, '2.2 User email matches');

    const passwordToken = passwordLoginData.data.session.accessToken;

    // 2.3 Verify session with /auth/me
    const mePasswordRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${passwordToken}` }
    });
    const mePasswordData = await mePasswordRes.json();
    assert(mePasswordRes.status === 200, '2.3 GET /auth/me succeeds with Bearer token');
    assert(mePasswordData.data?.user?.id === customerUserId, '2.3 User ID verified');

    // 2.4 Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${passwordToken}` }
    });
    assert(logoutRes.status === 200, '2.4 POST /auth/logout succeeds with HTTP 200');

    // =========================================================================
    // FLOW 3: FORGOT PASSWORD & PASSWORD RESET
    // =========================================================================
    console.log('\n================================================================');
    console.log('FLOW 3: FORGOT PASSWORD & PASSWORD RESET');
    console.log('================================================================');

    // 3.1 Request password reset (does not leak email existence)
    const resetReqRes = await fetch(`${baseUrl}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail })
    });
    const resetReqData = await resetReqRes.json();
    assert(resetReqRes.status === 200, '3.1 Password reset request succeeds with HTTP 200');
    assert(
      resetReqData.data?.message?.includes('If an account with this email exists') ||
      resetReqData.message?.includes('password reset'),
      '3.1 Generic response returned without revealing account existence'
    );

    // 3.2 Update password via authenticated session (/auth/password-update)
    const updatePassRes = await fetch(`${baseUrl}/auth/password-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${passwordToken}`
      },
      body: JSON.stringify({ newPassword })
    });
    assert(updatePassRes.status === 200, '3.2 POST /auth/password-update succeeds with HTTP 200');

    // 3.3 Verify login works with new password
    const newPassLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail, password: newPassword })
    });
    assert(newPassLoginRes.status === 200, '3.3 Login succeeds with newly updated password');

    // =========================================================================
    // FLOW 4: VERIFY MAGIC LINK IS REMOVED
    // =========================================================================
    console.log('\n================================================================');
    console.log('FLOW 4: VERIFY MAGIC LINK IS REMOVED');
    console.log('================================================================');

    const magicLinkRes = await fetch(`${baseUrl}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testCustomerEmail })
    });
    assert(magicLinkRes.status === 404, '4.1 POST /auth/magic-link returns HTTP 404 Not Found');

    console.log('\n================================================================');
    console.log('✅ ALL AUTHENTICATION FLOW TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    console.log('Cleaning up test fixtures...');
    if (customerUserId) {
      await supabaseAdmin.auth.admin.deleteUser(customerUserId).catch(() => {});
    }
    await stopServer();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
