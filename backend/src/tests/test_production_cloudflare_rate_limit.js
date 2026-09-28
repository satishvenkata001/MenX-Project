import http from 'http';
import app from '../app.js';
import { globalLimiter, authLimiter, keyGenerator } from '../middleware/rateLimiter.js';

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

async function runProductionRateLimitTests() {
  console.log('================================================================');
  console.log('  MENX — PRODUCTION RATE-LIMIT & SECURITY VERIFICATION SUITE    ');
  console.log('  Simulating: Client -> Cloudflare -> Render -> Express         ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unit Verification of keyGenerator & Normalization
    // -------------------------------------------------------------------------
    console.log('>>> 1. Unit Testing keyGenerator Security & Normalization...');

    // 1a. Prioritizes CF-Connecting-IP
    const fakeReqCF = {
      headers: {
        'cf-connecting-ip': '203.0.113.195'
      },
      ip: '172.68.25.10'
    };
    assert(keyGenerator(fakeReqCF) === '203.0.113.195', 'keyGenerator prioritizes CF-Connecting-IP over req.ip');

    // 1b. Missing CF-Connecting-IP falls back strictly to req.ip (ignores arbitrary headers like X-Real-IP)
    const fakeReqSpoofedRealIp = {
      headers: {
        'x-real-ip': '198.51.100.1' // Unverified header that must NOT be trusted
      },
      ip: '10.0.0.1'
    };
    assert(keyGenerator(fakeReqSpoofedRealIp) === '10.0.0.1', 'keyGenerator ignores untrusted X-Real-IP and falls back to req.ip');

    // 1c. Missing CF-Connecting-IP falls back to req.ip on direct connection
    const fakeReqDirect = {
      headers: {},
      ip: '192.168.1.50'
    };
    assert(keyGenerator(fakeReqDirect) === '192.168.1.50', 'keyGenerator falls back to req.ip when proxy headers are absent');

    // 1d. Normalizes IPv4-mapped IPv6 address
    const fakeReqMappedIpv6 = {
      headers: {
        'cf-connecting-ip': '::ffff:203.0.113.195'
      },
      ip: '172.68.25.10'
    };
    assert(keyGenerator(fakeReqMappedIpv6) === '203.0.113.195', 'keyGenerator normalizes IPv4-mapped IPv6 (::ffff:x.x.x.x -> x.x.x.x)');

    // 1e. Normalizes uppercase and whitespace IPv6 addresses
    const fakeReqIpv6 = {
      headers: {
        'cf-connecting-ip': '  2606:4700:4700::AAAA  '
      },
      ip: '172.68.25.10'
    };
    assert(keyGenerator(fakeReqIpv6) === '2606:4700:4700::aaaa', 'keyGenerator trims and lowercases IPv6 addresses');

    // 1f. Comma-separated list in CF-Connecting-IP
    const fakeReqCommaIp = {
      headers: {
        'cf-connecting-ip': '203.0.113.100, 10.0.0.1'
      },
      ip: '172.68.25.10'
    };
    assert(keyGenerator(fakeReqCommaIp) === '203.0.113.100', 'keyGenerator safely extracts primary IP from comma-separated header');

    // -------------------------------------------------------------------------
    // TEST 2: Production Multi-Device IPv4 Isolation behind Cloudflare Proxy
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Multi-Device IPv4 Rate-Limit Isolation (CF Simulation)...');
    const cloudflareProxyIp = '172.68.25.10';
    const clientIpA = '203.0.113.195';
    const clientIpB = '198.51.100.42';

    // IPv4 Device A - Request 1
    const resA1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': clientIpA,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(resA1.statusCode === 200, 'IPv4 Device A (Req 1) returns HTTP 200');
    const remainingA1 = parseInt(resA1.headers['ratelimit-remaining'], 10);
    assert(!isNaN(remainingA1), `IPv4 Device A (Req 1) received RateLimit-Remaining: ${remainingA1}`);

    // IPv4 Device A - Request 2 (Proving: Same IPv4 shares bucket)
    const resA2 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': clientIpA,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(resA2.statusCode === 200, 'IPv4 Device A (Req 2) returns HTTP 200');
    const remainingA2 = parseInt(resA2.headers['ratelimit-remaining'], 10);
    assert(remainingA2 === remainingA1 - 1, `Same IPv4 client A decrements its own bucket (${remainingA1} -> ${remainingA2})`);

    // IPv4 Device B - Request 1 (Proving: IPv4 Device B isolated from IPv4 Device A)
    const resB1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': clientIpB,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(resB1.statusCode === 200, 'IPv4 Device B (Req 1) returns HTTP 200');
    const remainingB1 = parseInt(resB1.headers['ratelimit-remaining'], 10);
    assert(
      remainingB1 === remainingA1,
      `IPv4 Device B has independent bucket (${remainingB1}), isolated from Device A (${remainingA2})`
    );

    // IPv4 Device B - Request 2 (Same IPv4 shares bucket)
    const resB2 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': clientIpB,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(resB2.statusCode === 200, 'IPv4 Device B (Req 2) returns HTTP 200');
    const remainingB2 = parseInt(resB2.headers['ratelimit-remaining'], 10);
    assert(remainingB2 === remainingB1 - 1, `Same IPv4 client B decrements its own bucket (${remainingB1} -> ${remainingB2})`);

    // -------------------------------------------------------------------------
    // TEST 3: IPv6 Client Handling & Isolation
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. IPv6 Client Handling & Subnet Isolation...');
    const ipv6ClientA = '2606:4700:4700::1111';
    const ipv6ClientB = '2606:4700:4700::2222';

    // IPv6 Client A - Request 1
    const res6A1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': ipv6ClientA,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(res6A1.statusCode === 200, 'IPv6 Client A (Req 1) returns HTTP 200');
    const remaining6A1 = parseInt(res6A1.headers['ratelimit-remaining'], 10);
    assert(!isNaN(remaining6A1), `IPv6 Client A received RateLimit-Remaining: ${remaining6A1}`);

    // IPv6 Client A - Request 2 (Same IPv6 client shares bucket)
    const res6A2 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': ipv6ClientA,
      'X-Forwarded-For': cloudflareProxyIp
    });
    const remaining6A2 = parseInt(res6A2.headers['ratelimit-remaining'], 10);
    assert(remaining6A2 === remaining6A1 - 1, `Same IPv6 Client A decrements its own bucket (${remaining6A1} -> ${remaining6A2})`);

    // IPv6 Client B - Request 1 (IPv6 Client B isolated from IPv6 Client A)
    const res6B1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'CF-Connecting-IP': ipv6ClientB,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(res6B1.statusCode === 200, 'IPv6 Client B (Req 1) returns HTTP 200');
    const remaining6B1 = parseInt(res6B1.headers['ratelimit-remaining'], 10);
    assert(remaining6B1 === remaining6A1, `IPv6 Client B starts with fresh bucket (${remaining6B1}), isolated from IPv6 Client A`);

    // -------------------------------------------------------------------------
    // TEST 4: Missing CF-Connecting-IP Falls Back to req.ip
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Missing CF-Connecting-IP Fallback to req.ip...');
    const directIpX = '203.0.113.111';
    const directIpY = '203.0.113.222';

    // Direct request X via X-Forwarded-For (Express trusts 1 hop, sets req.ip to directIpX)
    const resDirectX1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'X-Forwarded-For': directIpX
    });
    assert(resDirectX1.statusCode === 200, 'Direct Client X (no CF header) returns HTTP 200 via req.ip');
    const remDirectX1 = parseInt(resDirectX1.headers['ratelimit-remaining'], 10);

    const resDirectX2 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'X-Forwarded-For': directIpX
    });
    const remDirectX2 = parseInt(resDirectX2.headers['ratelimit-remaining'], 10);
    assert(remDirectX2 === remDirectX1 - 1, `Direct Client X decrements its req.ip bucket (${remDirectX1} -> ${remDirectX2})`);

    // Direct request Y via X-Forwarded-For
    const resDirectY1 = await makeRequest(server, '/api/v1/categories', 'GET', {
      'X-Forwarded-For': directIpY
    });
    const remDirectY1 = parseInt(resDirectY1.headers['ratelimit-remaining'], 10);
    assert(remDirectY1 === remDirectX1, `Direct Client Y has fresh bucket (${remDirectY1}), isolated from Client X`);

    // -------------------------------------------------------------------------
    // TEST 5: Auth Limiter Bucket Separation (IPv4 & IPv6)
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Auth Limiter Isolation behind Cloudflare...');
    const authPayload = JSON.stringify({ email: 'test@example.com' }); // missing password triggers 400

    const authResA1 = await makeRequest(server, '/api/v1/auth/login', 'POST', {
      'CF-Connecting-IP': '203.0.113.88',
      'X-Forwarded-For': cloudflareProxyIp
    }, authPayload);
    const authRemainingA1 = parseInt(authResA1.headers['ratelimit-remaining'], 10);
    assert(!isNaN(authRemainingA1), `Device A on /auth/login receives auth rate limit header: ${authRemainingA1}`);

    const authResA2 = await makeRequest(server, '/api/v1/auth/login', 'POST', {
      'CF-Connecting-IP': '203.0.113.88',
      'X-Forwarded-For': cloudflareProxyIp
    }, authPayload);
    const authRemainingA2 = parseInt(authResA2.headers['ratelimit-remaining'], 10);
    assert(authRemainingA2 === authRemainingA1 - 1, `Device A decrements auth rate limit bucket (${authRemainingA1} -> ${authRemainingA2})`);

    const authResB1 = await makeRequest(server, '/api/v1/auth/login', 'POST', {
      'CF-Connecting-IP': '2606:4700:4700::8888',
      'X-Forwarded-For': cloudflareProxyIp
    }, authPayload);
    const authRemainingB1 = parseInt(authResB1.headers['ratelimit-remaining'], 10);
    assert(authRemainingB1 === authRemainingA1, `Device B (IPv6) starts with fresh auth rate limit bucket (${authRemainingB1}), isolated from Device A`);

    // -------------------------------------------------------------------------
    // TEST 6: Health Check Remains Unaffected
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Health Check Bypass Verification with CF-Connecting-IP...');
    const healthRoot = await makeRequest(server, '/health', 'GET', {
      'CF-Connecting-IP': clientIpA,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(healthRoot.statusCode === 200, 'GET /health returns HTTP 200 with CF-Connecting-IP');
    assert(healthRoot.headers['ratelimit-limit'] === undefined, 'GET /health has NO ratelimit headers (bypassed)');

    const healthApi = await makeRequest(server, '/api/v1/health', 'GET', {
      'CF-Connecting-IP': clientIpA,
      'X-Forwarded-For': cloudflareProxyIp
    });
    assert(healthApi.statusCode === 200, 'GET /api/v1/health returns HTTP 200 with CF-Connecting-IP');
    assert(healthApi.headers['ratelimit-limit'] === undefined, 'GET /api/v1/health has NO ratelimit headers (bypassed)');
    assert(healthApi.json?.data?.status === 'UP', 'GET /api/v1/health returns status UP');

    // -------------------------------------------------------------------------
    // TEST 7: HTTP 429 Enforcement and Inter-Client Isolation
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. HTTP 429 Enforcement and Inter-Client Isolation...');
    const express = (await import('express')).default;
    const rateLimit = (await import('express-rate-limit')).default;
    const { AppError } = await import('../utils/appError.js');
    const { errorHandler } = await import('../middleware/errorHandler.js');

    const testApp = express();
    testApp.set('trust proxy', 1);
    testApp.use('/test-endpoint', rateLimit({
      windowMs: 60000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: (req, res, next) => {
        next(AppError.tooManyRequests('Too many requests from this IP. Please try again after 15 minutes.'));
      }
    }), (req, res) => res.json({ success: true }));
    testApp.use(errorHandler);

    const testServer = http.createServer(testApp);
    await new Promise(r => testServer.listen(0, '127.0.0.1', r));

    try {
      const blockedClientIp = '203.0.113.250';
      const cleanClientIp = '198.51.100.250';

      // Blocked client makes 2 successful requests
      const r1 = await makeRequest(testServer, '/test-endpoint', 'GET', {
        'CF-Connecting-IP': blockedClientIp,
        'X-Forwarded-For': cloudflareProxyIp
      });
      assert(r1.statusCode === 200, 'Client 1 first request succeeds (200)');

      const r2 = await makeRequest(testServer, '/test-endpoint', 'GET', {
        'CF-Connecting-IP': blockedClientIp,
        'X-Forwarded-For': cloudflareProxyIp
      });
      assert(r2.statusCode === 200, 'Client 1 second request succeeds (200)');

      // Client 1 third request hits limit -> 429
      const r3 = await makeRequest(testServer, '/test-endpoint', 'GET', {
        'CF-Connecting-IP': blockedClientIp,
        'X-Forwarded-For': cloudflareProxyIp
      });
      assert(r3.statusCode === 429, 'Client 1 third request is blocked with HTTP 429');
      assert(r3.headers['ratelimit-remaining'] === '0', 'Client 1 RateLimit-Remaining is 0');

      // Clean client making request on SAME server through SAME proxy IP must SUCCEED with HTTP 200
      const cleanReq = await makeRequest(testServer, '/test-endpoint', 'GET', {
        'CF-Connecting-IP': cleanClientIp,
        'X-Forwarded-For': cloudflareProxyIp
      });
      assert(
        cleanReq.statusCode === 200,
        'Client 2 (different CF-Connecting-IP) SUCCEEDS with HTTP 200 despite sharing Cloudflare proxy IP with blocked Client 1!'
      );
    } finally {
      testServer.close();
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionRateLimitTests();
