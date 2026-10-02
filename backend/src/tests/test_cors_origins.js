import express from 'express';
import http from 'http';
import app from '../app.js';
import { env } from '../config/env.js';

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

function makeRequest(server, options) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runCorsTests() {
  console.log('================================================================');
  console.log('       MENX CORS & LAN ORIGIN VALIDATION TEST SUITE');
  console.log('================================================================\n');

  // Start test server with app
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running on ephemeral port ${port} in NODE_ENV=${env.NODE_ENV}\n`);

  try {
    // 1. Test GET /api/v1/products with LAN Origin http://10.55.78.122:5173
    console.log('>>> 1. Testing GET /api/v1/products with LAN IP Origin (http://10.55.78.122:5173)...');
    const getRes = await makeRequest(server, {
      path: '/api/v1/products',
      method: 'GET',
      headers: {
        'Origin': 'http://10.55.78.122:5173'
      }
    });

    assert(getRes.statusCode === 200, `GET /api/v1/products returns HTTP 200 (got ${getRes.statusCode})`);
    assert(getRes.headers['access-control-allow-origin'] === 'http://10.55.78.122:5173', `Access-Control-Allow-Origin dynamically matches 'http://10.55.78.122:5173'`);
    assert(getRes.headers['access-control-allow-origin'] !== '*', `Access-Control-Allow-Origin is NOT wildcard '*'`);
    assert(getRes.headers['access-control-allow-credentials'] === 'true', `Access-Control-Allow-Credentials is 'true'`);
    assert(getRes.headers['vary'] && getRes.headers['vary'].includes('Origin'), `Vary header includes 'Origin'`);

    // 2. Test OPTIONS /api/v1/products Preflight with LAN Origin http://10.55.78.122:5173
    console.log('\n>>> 2. Testing OPTIONS /api/v1/products Preflight (http://10.55.78.122:5173)...');
    const optionsRes = await makeRequest(server, {
      path: '/api/v1/products',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://10.55.78.122:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Guest-Token'
      }
    });

    assert(optionsRes.statusCode === 204, `OPTIONS preflight returns HTTP 204 (got ${optionsRes.statusCode})`);
    assert(optionsRes.headers['access-control-allow-origin'] === 'http://10.55.78.122:5173', `Preflight Access-Control-Allow-Origin matches 'http://10.55.78.122:5173'`);
    assert(optionsRes.headers['access-control-allow-credentials'] === 'true', `Preflight Access-Control-Allow-Credentials is 'true'`);
    assert(optionsRes.headers['access-control-allow-methods'] && optionsRes.headers['access-control-allow-methods'].includes('GET'), `Preflight Access-Control-Allow-Methods includes GET`);
    assert(optionsRes.headers['vary'] && optionsRes.headers['vary'].includes('Origin'), `Preflight Vary header includes 'Origin'`);

    // 3. Test Localhost and Loopback Development Origins
    console.log('\n>>> 3. Testing Loopback & Localhost Origins...');
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://[::1]:5173'
    ];

    for (const origin of devOrigins) {
      const res = await makeRequest(server, {
        path: '/api/v1/products',
        method: 'GET',
        headers: { 'Origin': origin }
      });
      assert(res.statusCode === 200, `${origin} returns HTTP 200`);
      assert(res.headers['access-control-allow-origin'] === origin, `${origin} receives dynamic Access-Control-Allow-Origin`);
      assert(res.headers['access-control-allow-credentials'] === 'true', `${origin} receives Access-Control-Allow-Credentials: true`);
    }

    // 4. Test Private RFC 1918 & RFC 3927 IPv4 & mDNS Subnets
    console.log('\n>>> 4. Testing Private IPv4 Subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, *.local)...');
    const privateSubnetOrigins = [
      'http://10.0.0.1:5173',
      'http://10.255.255.254:3000',
      'http://172.16.0.1:5173',
      'http://172.31.255.255:8080',
      'http://192.168.1.100:5173',
      'http://192.168.0.1:5173',
      'http://169.254.1.1:5173',
      'http://my-laptop.local:5173'
    ];

    for (const origin of privateSubnetOrigins) {
      const res = await makeRequest(server, {
        path: '/api/v1/products',
        method: 'GET',
        headers: { 'Origin': origin }
      });
      assert(res.statusCode === 200, `${origin} returns HTTP 200`);
      assert(res.headers['access-control-allow-origin'] === origin, `${origin} receives dynamic Access-Control-Allow-Origin`);
      assert(res.headers['access-control-allow-credentials'] === 'true', `${origin} receives Access-Control-Allow-Credentials: true`);
    }

    // 5. Test Production Domain Origins (menx.shop and www.menx.shop)
    console.log('\n>>> 5. Testing Production Custom Domain Origins (https://menx.shop & https://www.menx.shop)...');
    const productionOrigins = [
      'https://menx.shop',
      'https://www.menx.shop',
      'https://menx-frontend.onrender.com'
    ];

    const prodEndpoints = [
      '/api/v1/products',
      '/api/v1/categories',
      '/api/v1/sizes',
      '/api/v1/brands',
      '/api/v1/colors',
      '/api/v1/subcategories'
    ];

    for (const origin of productionOrigins) {
      // 5a. Test Preflight OPTIONS on /api/v1/products
      const preflightRes = await makeRequest(server, {
        path: '/api/v1/products',
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Guest-Token'
        }
      });
      assert(preflightRes.statusCode === 204, `[Preflight] ${origin} OPTIONS /api/v1/products returns HTTP 204`);
      assert(preflightRes.headers['access-control-allow-origin'] === origin, `[Preflight] ${origin} matches Access-Control-Allow-Origin exactly`);
      assert(preflightRes.headers['access-control-allow-origin'] !== '*', `[Preflight] ${origin} does NOT receive wildcard '*'`);
      assert(preflightRes.headers['access-control-allow-credentials'] === 'true', `[Preflight] ${origin} receives Access-Control-Allow-Credentials: true`);
      assert(preflightRes.headers['access-control-allow-methods']?.includes('GET'), `[Preflight] ${origin} allows GET method`);

      // 5b. Test GET on /api/v1/products
      const getRes = await makeRequest(server, {
        path: '/api/v1/products',
        method: 'GET',
        headers: { 'Origin': origin }
      });
      assert(getRes.statusCode === 200, `[GET] ${origin} /api/v1/products returns HTTP 200`);
      assert(getRes.headers['access-control-allow-origin'] === origin, `[GET] ${origin} receives Access-Control-Allow-Origin: ${origin}`);
      assert(getRes.headers['access-control-allow-credentials'] === 'true', `[GET] ${origin} receives Access-Control-Allow-Credentials: true`);

      // 5c. Test Authenticated/Credentialed Preflight OPTIONS on /api/v1/cart
      const cartPreflight = await makeRequest(server, {
        path: '/api/v1/cart',
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Guest-Token, x-guest-token'
        }
      });
      assert(cartPreflight.statusCode === 204, `[Auth Preflight] ${origin} OPTIONS /api/v1/cart returns HTTP 204`);
      assert(cartPreflight.headers['access-control-allow-origin'] === origin, `[Auth Preflight] ${origin} cart preflight matches Access-Control-Allow-Origin`);
      assert(cartPreflight.headers['access-control-allow-credentials'] === 'true', `[Auth Preflight] ${origin} cart preflight allows credentials`);
    }

    // 5d. Test other catalog endpoints for https://menx.shop
    console.log('\n>>> 5d. Testing additional catalog endpoints for https://menx.shop...');
    for (const endpoint of prodEndpoints) {
      const res = await makeRequest(server, {
        path: endpoint,
        method: 'GET',
        headers: { 'Origin': 'https://menx.shop' }
      });
      assert(res.statusCode === 200, `GET ${endpoint} returns HTTP 200`);
      assert(res.headers['access-control-allow-origin'] === 'https://menx.shop', `GET ${endpoint} allows Origin https://menx.shop`);
    }

    // 6. Test Unauthorized / Malicious Origins (Safe Rejection without 500)
    console.log('\n>>> 6. Testing Unauthorized Origin Safe Rejection...');
    const unauthorizedOrigins = [
      'http://malicious-site.com',
      'https://evil-hacker.io',
      'https://fake-menx.shop',
      'http://172.32.0.1:5173', // Outside 172.16 - 172.31 range
      'http://8.8.8.8:5173',    // Public IPv4
      'http://1.1.1.1:3000'     // Public IPv4
    ];

    for (const origin of unauthorizedOrigins) {
      const res = await makeRequest(server, {
        path: '/api/v1/products',
        method: 'GET',
        headers: { 'Origin': origin }
      });
      assert(res.statusCode === 200, `${origin} does not crash server (HTTP ${res.statusCode})`);
      assert(!res.headers['access-control-allow-origin'], `${origin} does NOT receive Access-Control-Allow-Origin header`);

      const optRes = await makeRequest(server, {
        path: '/api/v1/products',
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET'
        }
      });
      assert(!optRes.headers['access-control-allow-origin'], `Preflight for ${origin} does NOT receive Access-Control-Allow-Origin header`);
    }

    // 7. Test Non-Origin Requests (curl, server-to-server, native mobile apps)
    console.log('\n>>> 7. Testing Requests with No Origin (server-to-server, curl)...');
    const noOriginRes = await makeRequest(server, {
      path: '/api/v1/products',
      method: 'GET'
    });
    assert(noOriginRes.statusCode === 200, `Requests without Origin header succeed with HTTP 200`);

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`CORS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCorsTests().catch(err => {
  console.error('Fatal error running CORS tests:', err);
  process.exit(1);
});
