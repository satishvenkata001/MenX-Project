import http from 'http';
import app from '../app.js';

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

function makeRequest(server, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers
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
    req.end();
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  MENX — TRUST PROXY & RATE LIMITING RFC-429 VERIFICATION SUITE  ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  try {
    // 1. Verify /health and /api/v1/health bypass global limiter
    console.log('>>> 1. Testing Health Endpoints bypass rate limiter...');
    const health1 = await makeRequest(server, '/health');
    assert(health1.statusCode === 200, `GET /health returns HTTP 200`);
    assert(health1.headers['ratelimit-limit'] === undefined, `GET /health has NO ratelimit headers (bypassed)`);

    const health2 = await makeRequest(server, '/api/v1/health');
    assert(health2.statusCode === 200, `GET /api/v1/health returns HTTP 200`);
    assert(health2.headers['ratelimit-limit'] === undefined, `GET /api/v1/health has NO ratelimit headers (bypassed)`);

    // 2. Test Multi-Device / Multi-IP Separation via X-Forwarded-For behind trust proxy
    console.log('\n>>> 2. Testing IP separation with trust proxy (Render simulation)...');
    const ipA = '203.0.113.10';
    const ipB = '198.51.100.25';

    // Device A request 1
    const resA1 = await makeRequest(server, '/api/v1/categories', 'GET', { 'X-Forwarded-For': ipA });
    assert(resA1.statusCode === 200, `Device A (/categories) returns HTTP 200`);
    const remainingA1 = parseInt(resA1.headers['ratelimit-remaining'], 10);
    assert(!isNaN(remainingA1), `Device A receives rate limit remaining header: ${remainingA1}`);

    // Device A request 2
    const resA2 = await makeRequest(server, '/api/v1/categories', 'GET', { 'X-Forwarded-For': ipA });
    const remainingA2 = parseInt(resA2.headers['ratelimit-remaining'], 10);
    assert(remainingA2 === remainingA1 - 1, `Device A correctly decrements its own bucket (${remainingA1} -> ${remainingA2})`);

    // Device B request 1 (Different device/IP)
    const resB1 = await makeRequest(server, '/api/v1/categories', 'GET', { 'X-Forwarded-For': ipB });
    assert(resB1.statusCode === 200, `Device B (/categories) returns HTTP 200`);
    const remainingB1 = parseInt(resB1.headers['ratelimit-remaining'], 10);
    assert(remainingB1 === remainingA1, `Device B starts with fresh bucket (${remainingB1}), isolated from Device A!`);

    // 3. Test HTTP 429 Too Many Requests enforcement
    console.log('\n>>> 3. Testing HTTP 429 Too Many Requests response on rate limit exhaustion...');
    const express = (await import('express')).default;
    const rateLimit = (await import('express-rate-limit')).default;
    const { AppError } = await import('../utils/appError.js');
    const { errorHandler } = await import('../middleware/errorHandler.js');
    
    const rlApp = express();
    rlApp.set('trust proxy', 1);
    rlApp.get('/test-rl', rateLimit({
      windowMs: 60000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next) => {
        next(AppError.tooManyRequests('Too many requests from this IP. Please try again after 15 minutes.'));
      }
    }), (req, res) => res.json({ ok: true }));
    rlApp.use(errorHandler);

    const rlServer = http.createServer(rlApp);
    await new Promise(r => rlServer.listen(0, '127.0.0.1', r));

    const testIp = '198.51.100.99';
    try {
      const firstReq = await makeRequest(rlServer, '/test-rl', 'GET', { 'X-Forwarded-For': testIp });
      assert(firstReq.statusCode === 200, `First request returns HTTP 200`);
      const secondReq = await makeRequest(rlServer, '/test-rl', 'GET', { 'X-Forwarded-For': testIp });
      assert(secondReq.statusCode === 200, `Second request returns HTTP 200`);

      const thirdReq = await makeRequest(rlServer, '/test-rl', 'GET', { 'X-Forwarded-For': testIp });
      assert(thirdReq.statusCode === 429, `Third request returns HTTP 429 (Too Many Requests), NOT 403`);
      assert(thirdReq.json?.message?.includes('Too many requests'), `Error message explains rate limit: "${thirdReq.json?.message}"`);
      assert(thirdReq.headers['ratelimit-remaining'] === '0', `Rate limit remaining header is 0`);
      assert(Boolean(thirdReq.headers['retry-after'] || thirdReq.headers['ratelimit-reset']), `Retry-After or ratelimit-reset header is present`);
    } finally {
      rlServer.close();
    }

    // 4. Test Health check STILL works when client IP is 429 blocked
    console.log('\n>>> 4. Testing Health check availability even when IP is blocked on APIs...');
    const healthAfterBlock = await makeRequest(server, '/api/v1/health', 'GET', { 'X-Forwarded-For': testIp });
    assert(healthAfterBlock.statusCode === 200, `GET /api/v1/health STILL returns HTTP 200 even when IP is rate-limited on standard APIs`);
    assert(healthAfterBlock.json?.data?.status === 'UP', `Health payload status remains 'UP'`);

  } catch (err) {
    console.error('Test error:', err);
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

runTestSuite();
