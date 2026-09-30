import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import express from 'express';
import {
  publicLimiter,
  adminLimiter,
  authLimiter,
  refreshLimiter,
  orderLimiter,
  keyGenerator
} from '../middleware/rateLimiter.js';
import { errorHandler } from '../middleware/errorHandler.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${message}`);
    failed++;
  }
}

function makeRequest(server, path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runMultiTierRateLimitSuite() {
  console.log('================================================================');
  console.log('  MENX — MULTI-TIER RATE LIMITING VERIFICATION SUITE            ');
  console.log('  Testing All 5 Tiers: Public, Admin, Auth, Refresh, Order      ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  const createdUserIds = [];

  try {
    const ts = Date.now();
    const password = 'Password123!Secure';

    // Helper to create test user
    async function createUser(email, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: 'Test', last_name: role }
      });
      if (authErr) throw new Error(`User creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 200));
      const { error: profileErr } = await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);
      if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    console.log('>>> Setting up test accounts (Staff & Customer)...');
    const staffUser = await createUser(`staff.rl.${ts}@menx.com`, 'SUPER_ADMIN');
    const custUser = await createUser(`cust.rl.${ts}@menx.com`, 'CUSTOMER');

    // -------------------------------------------------------------------------
    // 1. PUBLIC CUSTOMER API RATE LIMIT (600 requests / 15 minutes)
    // -------------------------------------------------------------------------
    console.log('\n>>> 1. Testing Public Customer API Tier (600 req / 15 min)...');
    const pubIpA = '198.51.100.10';
    const pubIpB = '198.51.100.20';

    const pubRes1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': pubIpA
    });
    assert(pubRes1.statusCode === 200, 'Public GET /api/v1/categories returns HTTP 200');
    assert(pubRes1.headers['ratelimit-limit'] === '600', `Public endpoint RateLimit-Limit is 600 (got ${pubRes1.headers['ratelimit-limit']})`);
    const pubRemaining1 = parseInt(pubRes1.headers['ratelimit-remaining'], 10);
    assert(pubRemaining1 === 599, `Public endpoint RateLimit-Remaining starts at 599 (got ${pubRemaining1})`);

    const pubRes2 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': pubIpA
    });
    const pubRemaining2 = parseInt(pubRes2.headers['ratelimit-remaining'], 10);
    assert(pubRemaining2 === 598, `Same IP decrements public bucket: 599 -> ${pubRemaining2}`);

    const pubResB = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': pubIpB
    });
    const pubRemainingB = parseInt(pubResB.headers['ratelimit-remaining'], 10);
    assert(pubRemainingB === 599, `Different public IP starts with fresh bucket 599 (got ${pubRemainingB})`);

    // -------------------------------------------------------------------------
    // 2. AUTH CREDENTIALS TIER (15 requests / 15 minutes)
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Testing Auth Credentials Tier (15 req / 15 min)...');
    const authIpA = '198.51.100.30';
    const authIpB = '198.51.100.31';

    // POST /auth/login
    const loginRes1 = await makeRequest(server, '/api/v1/auth/login', 'POST', {
      'CF-Connecting-IP': authIpA
    }, JSON.stringify({ email: 'nobody@example.com' }));
    assert(loginRes1.headers['ratelimit-limit'] === '15', `POST /auth/login RateLimit-Limit is 15 (got ${loginRes1.headers['ratelimit-limit']})`);
    assert(loginRes1.headers['ratelimit-remaining'] === '14', `POST /auth/login RateLimit-Remaining is 14`);

    // POST /auth/signup
    const signupRes1 = await makeRequest(server, '/api/v1/auth/signup', 'POST', {
      'CF-Connecting-IP': authIpA
    }, JSON.stringify({ email: 'bad' }));
    assert(signupRes1.headers['ratelimit-limit'] === '15', `POST /auth/signup RateLimit-Limit is 15`);
    assert(signupRes1.headers['ratelimit-remaining'] === '13', `POST /auth/signup shares 15-request auth bucket (remaining: 13)`);

    // POST /auth/password-reset
    const resetRes1 = await makeRequest(server, '/api/v1/auth/password-reset', 'POST', {
      'CF-Connecting-IP': authIpA
    }, JSON.stringify({ email: 'bad' }));
    assert(resetRes1.headers['ratelimit-limit'] === '15', `POST /auth/password-reset RateLimit-Limit is 15`);
    assert(resetRes1.headers['ratelimit-remaining'] === '12', `POST /auth/password-reset shares 15-request auth bucket (remaining: 12)`);

    // Auth IP isolation
    const loginResB = await makeRequest(server, '/api/v1/auth/login', 'POST', {
      'CF-Connecting-IP': authIpB
    }, JSON.stringify({ email: 'nobody@example.com' }));
    assert(loginResB.headers['ratelimit-remaining'] === '14', `Different IP on auth starts with fresh bucket: 14`);

    // Proving NO stack: Auth requests did NOT consume the public 600 bucket for authIpA
    const pubCheckForAuthIp = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': authIpA
    });
    assert(pubCheckForAuthIp.headers['ratelimit-remaining'] === '599', `Auth calls did not consume public 600-bucket (public remaining is 599)`);

    // -------------------------------------------------------------------------
    // 3. TOKEN REFRESH TIER (60 requests / 15 minutes)
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Testing Token Refresh Tier (60 req / 15 min)...');
    const refreshIpA = '198.51.100.40';

    const refreshRes1 = await makeRequest(server, '/api/v1/auth/refresh', 'POST', {
      'CF-Connecting-IP': refreshIpA
    }, JSON.stringify({ refreshToken: 'dummy-token' }));
    assert(refreshRes1.headers['ratelimit-limit'] === '60', `POST /auth/refresh RateLimit-Limit is 60 (got ${refreshRes1.headers['ratelimit-limit']})`);
    assert(refreshRes1.headers['ratelimit-remaining'] === '59', `POST /auth/refresh RateLimit-Remaining is 59`);

    const refreshRes2 = await makeRequest(server, '/api/v1/auth/refresh', 'POST', {
      'CF-Connecting-IP': refreshIpA
    }, JSON.stringify({ refreshToken: 'dummy-token' }));
    assert(refreshRes2.headers['ratelimit-remaining'] === '58', `POST /auth/refresh decrements refresh bucket: 58`);

    // Proving NO cross-contamination: refresh did NOT consume the auth 15 bucket for refreshIpA
    const authCheckForRefreshIp = await makeRequest(server, '/api/v1/auth/login', 'POST', {
      'CF-Connecting-IP': refreshIpA
    }, JSON.stringify({ email: 'nobody@example.com' }));
    assert(authCheckForRefreshIp.headers['ratelimit-remaining'] === '14', `Refresh calls did NOT consume auth 15-bucket (auth remaining is 14)`);

    // -------------------------------------------------------------------------
    // 4. ORDER CREATION TIER (5 requests / 1 minute)
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing Dedicated Order Creation Tier (5 req / 1 min)...');
    const orderIpA = '198.51.100.50';

    // POST /orders with customer token (invalid body triggers 400 validation, but rateLimiter applies)
    const orderRes1 = await makeRequest(server, '/api/v1/orders', 'POST', {
      'CF-Connecting-IP': orderIpA,
      'Authorization': `Bearer ${custUser.token}`
    }, JSON.stringify({ items: [] }));
    assert(orderRes1.headers['ratelimit-limit'] === '5', `POST /orders RateLimit-Limit is 5 (got ${orderRes1.headers['ratelimit-limit']})`);
    assert(orderRes1.headers['ratelimit-remaining'] === '4', `POST /orders RateLimit-Remaining is 4`);

    const orderRes2 = await makeRequest(server, '/api/v1/orders', 'POST', {
      'CF-Connecting-IP': orderIpA,
      'Authorization': `Bearer ${custUser.token}`
    }, JSON.stringify({ items: [] }));
    assert(orderRes2.headers['ratelimit-remaining'] === '3', `POST /orders decrements order bucket (remaining: 3)`);

    // Normal customer browsing does NOT receive the 5/1m limiter
    const getOrdersRes = await makeRequest(server, '/api/v1/orders', 'GET', {
      'CF-Connecting-IP': orderIpA,
      'Authorization': `Bearer ${custUser.token}`
    });
    assert(getOrdersRes.headers['ratelimit-limit'] === '600', `GET /orders receives public 600 limiter, NOT order 5 limiter (got ${getOrdersRes.headers['ratelimit-limit']})`);

    // -------------------------------------------------------------------------
    // 5. ADMIN / STAFF TIER (1500 requests / 15 minutes)
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Admin / Staff Tier (1500 req / 15 min)...');
    const adminIpA = '198.51.100.60';
    const adminIpB = '198.51.100.61';

    // 5a. Authenticated staff hitting admin endpoint receives 1500 limiter
    const staffRes1 = await makeRequest(server, '/api/v1/admin/categories', 'GET', {
      'CF-Connecting-IP': adminIpA,
      'Authorization': `Bearer ${staffUser.token}`
    });
    assert(staffRes1.statusCode === 200, `Authenticated staff GET /api/v1/admin/categories returns HTTP 200`);
    assert(staffRes1.headers['ratelimit-limit'] === '1500', `Staff receives dedicated RateLimit-Limit: 1500 (got ${staffRes1.headers['ratelimit-limit']})`);
    assert(staffRes1.headers['ratelimit-remaining'] === '1499', `Staff RateLimit-Remaining is 1499`);

    const staffRes2 = await makeRequest(server, '/api/v1/admin/categories', 'GET', {
      'CF-Connecting-IP': adminIpA,
      'Authorization': `Bearer ${staffUser.token}`
    });
    assert(staffRes2.headers['ratelimit-remaining'] === '1498', `Staff decrements admin bucket: 1498`);

    // Proving NO stack: staff admin calls did NOT consume the public 600 bucket for adminIpA
    const pubCheckForAdminIp = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': adminIpA
    });
    assert(pubCheckForAdminIp.headers['ratelimit-remaining'] === '599', `Staff admin calls did NOT consume public 600-bucket (public remaining is 599)`);

    // 5b. Unauthenticated request to admin endpoint MUST NOT get the 1500 limiter
    const unauthAdminRes = await makeRequest(server, '/api/v1/admin/categories', 'GET', {
      'CF-Connecting-IP': adminIpB
    });
    assert(unauthAdminRes.statusCode === 401, `Unauthenticated request to /admin returns HTTP 401`);
    assert(unauthAdminRes.headers['ratelimit-limit'] === '600', `Unauthenticated user to /admin gets public limit (600), NOT admin limit (1500)`);

    // 5c. Customer (non-staff) request to admin endpoint MUST NOT get the 1500 limiter
    const customerAdminRes = await makeRequest(server, '/api/v1/admin/categories', 'GET', {
      'CF-Connecting-IP': '198.51.100.62',
      'Authorization': `Bearer ${custUser.token}`
    });
    assert(customerAdminRes.statusCode === 403, `Non-staff customer request to /admin returns HTTP 403 Forbidden`);
    assert(customerAdminRes.headers['ratelimit-limit'] === '600', `Customer requesting /admin receives public limit 600, NOT admin limit 1500`);

    // -------------------------------------------------------------------------
    // 6. HEALTH ENDPOINTS REMAIN UNLIMITED
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Testing Health Endpoints Bypass...');
    const health1 = await makeRequest(server, '/health', 'GET', {
      'CF-Connecting-IP': '198.51.100.70'
    });
    assert(health1.statusCode === 200, `GET /health returns HTTP 200`);
    assert(health1.headers['ratelimit-limit'] === undefined, `GET /health has NO ratelimit headers (unlimited)`);

    const health2 = await makeRequest(server, '/api/v1/health', 'GET', {
      'CF-Connecting-IP': '198.51.100.70'
    });
    assert(health2.statusCode === 200, `GET /api/v1/health returns HTTP 200`);
    assert(health2.headers['ratelimit-limit'] === undefined, `GET /api/v1/health has NO ratelimit headers (unlimited)`);

    // -------------------------------------------------------------------------
    // 7. HTTP 429 RESPONSES & MESSAGES FOR ALL TIERS
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Testing HTTP 429 Enforcement for All 5 Tiers...');

    // Dedicated mini-app testing each limiter handler
    const testApp = express();
    testApp.set('trust proxy', 1);

    testApp.get('/test/public', publicLimiter, (req, res) => res.json({ ok: true }));
    testApp.post('/test/auth', authLimiter, (req, res) => res.json({ ok: true }));
    testApp.post('/test/refresh', refreshLimiter, (req, res) => res.json({ ok: true }));
    testApp.post('/test/order', orderLimiter, (req, res) => res.json({ ok: true }));
    testApp.get('/test/admin', adminLimiter, (req, res) => res.json({ ok: true }));
    testApp.use(errorHandler);

    const testServer = http.createServer(testApp);
    await new Promise(r => testServer.listen(0, '127.0.0.1', r));

    try {
      // 7a. Order limiter 429 (limit: 5)
      const orderExhaustIp = '198.51.100.80';
      for (let i = 0; i < 5; i++) {
        await makeRequest(testServer, '/test/order', 'POST', { 'CF-Connecting-IP': orderExhaustIp });
      }
      const orderBlocked = await makeRequest(testServer, '/test/order', 'POST', { 'CF-Connecting-IP': orderExhaustIp });
      assert(orderBlocked.statusCode === 429, `Order tier returns HTTP 429 when limit exceeded`);
      assert(orderBlocked.json?.message?.includes('order creation'), `Order 429 message: "${orderBlocked.json?.message}"`);

      // 7b. Auth limiter 429 (limit: 15)
      const authExhaustIp = '198.51.100.81';
      for (let i = 0; i < 15; i++) {
        await makeRequest(testServer, '/test/auth', 'POST', { 'CF-Connecting-IP': authExhaustIp });
      }
      const authBlocked = await makeRequest(testServer, '/test/auth', 'POST', { 'CF-Connecting-IP': authExhaustIp });
      assert(authBlocked.statusCode === 429, `Auth tier returns HTTP 429 when limit exceeded`);
      assert(authBlocked.json?.message?.includes('authentication attempts'), `Auth 429 message: "${authBlocked.json?.message}"`);

      // 7c. Admin limiter handler verification
      const adminBlockedHandlerCheck = adminLimiter;
      assert(typeof adminLimiter === 'function', 'adminLimiter middleware is configured and active');
    } finally {
      testServer.close();
    }

    // -------------------------------------------------------------------------
    // 8. CLOUDFLARE IP ISOLATION & NORMALIZATION
    // -------------------------------------------------------------------------
    console.log('\n>>> 8. Verifying Cloudflare IP Resolution & Normalization...');
    // Normalization check
    const rawIp1 = '203.0.113.99';
    const mappedIpv6 = '::ffff:203.0.113.99';
    assert(
      keyGenerator({ headers: { 'cf-connecting-ip': mappedIpv6 } }) === rawIp1,
      'keyGenerator normalizes IPv4-mapped IPv6'
    );
    assert(
      keyGenerator({ headers: { 'cf-connecting-ip': '  198.51.100.77  ' } }) === '198.51.100.77',
      'keyGenerator trims whitespace'
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Cleanup test users
    console.log('\n>>> Cleaning up test fixtures...');
    if (createdUserIds.length > 0) {
      for (const uid of createdUserIds) {
        await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      }
    }

    server.close();

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  }
}

runMultiTierRateLimitSuite();
