process.env.NODE_ENV = 'test';
import http from 'http';
import app from '../app.js';
import { supabaseAdmin } from '../config/supabase.js';

async function runPhase4ATests() {
  console.log('================================================================');
  console.log('       MENX PHASE 4A — BACKEND FOUNDATION & AUTH TEST SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  let passedTests = 0;
  let totalTests = 0;

  const testEmail = `test.menx.${Date.now()}@menxfashion.com`;
  const testPassword = 'Password123!Secure';
  let accessToken = null;
  let refreshToken = null;
  let testUserId = null;

  async function assert(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(` [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(` [FAIL] ${name} — ${details}`);
    }
  }

  try {
    // TEST 1: Public Health Check
    console.log('>>> 1. Health Endpoint Tests');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    await assert('GET /api/v1/health returns HTTP 200', healthRes.status === 200);
    await assert('Health response status is "UP"', healthData.data?.status === 'UP');
    await assert('Health response contains app name "MENX REST API"', healthData.data?.app === 'MENX REST API');

    // TEST 2: Unauthenticated Protected Endpoints
    console.log('\n>>> 2. Unauthenticated Access Protection Tests');
    const unauthMeRes = await fetch(`${baseUrl}/auth/me`);
    const unauthMeData = await unauthMeRes.json();
    await assert('GET /api/v1/auth/me without token returns HTTP 401', unauthMeRes.status === 401);
    await assert('401 response has status "fail"', unauthMeData.status === 'fail');

    const unauthHealthRes = await fetch(`${baseUrl}/health/auth`);
    await assert('GET /api/v1/health/auth without token returns HTTP 401', unauthHealthRes.status === 401);

    const invalidTokenRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.malformed.jwt.token' }
    });
    await assert('GET /api/v1/auth/me with invalid token returns HTTP 401', invalidTokenRes.status === 401);

    // TEST 3: Request Validation with Zod
    console.log('\n>>> 3. Request Validation (Zod) Tests');
    const invalidSignupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' })
    });
    const invalidSignupData = await invalidSignupRes.json();
    await assert('Signup with invalid email & short password returns HTTP 400', invalidSignupRes.status === 400);
    await assert('Validation error details are returned', Array.isArray(invalidSignupData.details) && invalidSignupData.details.length >= 2);

    const missingLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@menxfashion.com' })
    });
    await assert('Login with missing password returns HTTP 400', missingLoginRes.status === 400);

    // TEST 4: User Signup Flow with Supabase Auth
    console.log('\n>>> 4. Supabase User Registration Flow');
    const signupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        firstName: 'Vikram',
        lastName: 'MenX',
        phone: '+91 9876543210'
      })
    });
    const signupData = await signupRes.json();
    await assert('User registration returns HTTP 201 Created', signupRes.status === 201, JSON.stringify(signupData));
    await assert('Registered user ID returned', !!signupData.data?.user?.id);
    testUserId = signupData.data?.user?.id;

    // Confirm user email administratively to allow login in automated test
    await supabaseAdmin.auth.admin.updateUserById(testUserId, { email_confirm: true });

    // TEST 5: User Login Flow with Supabase Auth
    console.log('\n>>> 5. User Login & Token Generation');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    await assert('User login returns HTTP 200 OK', loginRes.status === 200, JSON.stringify(loginData));
    await assert('Session contains access token', !!loginData.data?.session?.accessToken);
    await assert('Session contains refresh token', !!loginData.data?.session?.refreshToken);
    await assert('Profile returns default CUSTOMER role', loginData.data?.profile?.role === 'CUSTOMER');
    accessToken = loginData.data?.session?.accessToken;
    refreshToken = loginData.data?.session?.refreshToken;

    // TEST 6: Protected /auth/me Endpoint
    console.log('\n>>> 6. Protected /api/v1/auth/me Endpoint');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const meData = await meRes.json();
    await assert('GET /api/v1/auth/me with valid Bearer token returns HTTP 200', meRes.status === 200);
    await assert('User ID matches authenticated user', meData.data?.user?.id === testUserId);
    await assert('Profile contains first_name "Vikram"', meData.data?.profile?.first_name === 'Vikram');
    await assert('Profile is_active is true', meData.data?.profile?.is_active === true);

    // TEST 7: Protected /health/auth Verification Endpoint
    console.log('\n>>> 7. Protected /api/v1/health/auth Verification Endpoint');
    const authHealthRes = await fetch(`${baseUrl}/health/auth`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const authHealthData = await authHealthRes.json();
    await assert('GET /api/v1/health/auth returns HTTP 200', authHealthRes.status === 200);
    await assert('authenticated is true', authHealthData.data?.authenticated === true);
    await assert('Profile role is CUSTOMER', authHealthData.data?.profile?.role === 'CUSTOMER');

    // TEST 8: RBAC Middleware Enforcement
    console.log('\n>>> 8. RBAC Middleware Enforcement Tests');
    // Test CUSTOMER accessing SUPER_ADMIN endpoint -> should fail with 403
    const adminDeniedRes = await fetch(`${baseUrl}/health/test/admin-only`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const adminDeniedData = await adminDeniedRes.json();
    await assert('CUSTOMER accessing SUPER_ADMIN route returns HTTP 403 Forbidden', adminDeniedRes.status === 403);
    await assert('Forbidden error message indicates role lack of permission', adminDeniedData.message.includes('lacks required permissions'));

    // Test CUSTOMER accessing CUSTOMER route -> should succeed with 200
    const customerAllowedRes = await fetch(`${baseUrl}/health/test/customer-only`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    await assert('CUSTOMER accessing CUSTOMER route returns HTTP 200 OK', customerAllowedRes.status === 200);

    // TEST 9: Session Refresh Endpoint
    console.log('\n>>> 9. Session Refresh Token Endpoint');
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    const refreshData = await refreshRes.json();
    await assert('POST /api/v1/auth/refresh returns HTTP 200', refreshRes.status === 200);
    await assert('New access token returned', !!refreshData.data?.session?.accessToken);

    // TEST 10: Rate Limiting & 404 Route Tests
    console.log('\n>>> 10. Rate Limiting & 404 Route Tests');
    const notFoundRes = await fetch(`${baseUrl}/non-existent-route`);
    await assert('Undefined route returns HTTP 404', notFoundRes.status === 404);

    const notFoundRateLimitHeader = notFoundRes.headers.get('ratelimit-limit');
    await assert('Standard API response includes rate limit headers', notFoundRateLimitHeader !== null);
    await assert('Health check response bypasses rate limiter (no ratelimit header)', healthRes.headers.get('ratelimit-limit') === null);

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
  } finally {
    // Cleanup test user from Supabase Auth & profiles to keep database clean
    if (testUserId) {
      console.log('\n>>> Cleaning up test user account...');
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', testUserId);
        await supabaseAdmin.from('wishlists').delete().eq('user_id', testUserId);
        await supabaseAdmin.from('carts').delete().eq('user_id', testUserId);
        await supabaseAdmin.auth.admin.deleteUser(testUserId);
        console.log(' [PASS] Test user successfully cleaned up.');
      } catch (cleanErr) {
        console.warn(' Cleanup notice:', cleanErr.message);
      }
    }

    server.close();
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runPhase4ATests();
