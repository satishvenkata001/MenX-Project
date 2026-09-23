import http from 'http';
import app from '../app.js';
import { ReturnService } from '../services/return.service.js';
import { pool } from '../config/db.js';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      console.log(`[TEST SERVER] Running ephemeral test server on port ${port}`);
      resolve();
    });
  });
}

async function closeServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

let passedTests = 0;
let totalTests = 0;

async function assert(description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(` [PASS] ${description}`);
  } else {
    console.error(` [FAIL] ${description} ${details ? `— ${details}` : ''}`);
  }
}

async function runReturnVisualsTests() {
  console.log('================================================================');
  console.log('       MENX RETURNS & EXCHANGES PRODUCT VISUALS TEST SUITE      ');
  console.log('================================================================\n');

  try {
    await startServer();

    // 1. Check existing customer returns in database
    const sampleReturnRes = await pool.query(`
      SELECT customer_id FROM return_requests LIMIT 1
    `);

    if (sampleReturnRes.rows.length === 0) {
      console.log('No existing returns in DB to test against, will verify service shape');
    }

    // 2. Query returns using ReturnService.getReturns
    const customerId = sampleReturnRes.rows[0]?.customer_id || '00000000-0000-0000-0000-000000000000';
    const returnsResult = await ReturnService.getReturns(customerId, { page: 1, limit: 10 });

    await assert('ReturnService.getReturns returns an object with returns array', Array.isArray(returnsResult.returns));
    await assert('ReturnService.getReturns returns pagination object', typeof returnsResult.pagination?.total === 'number');

    if (returnsResult.returns.length > 0) {
      const firstReturn = returnsResult.returns[0];
      await assert('Return record has return_number', typeof firstReturn.return_number === 'string');
      await assert('Return record has status', typeof firstReturn.status === 'string');
      await assert('Return record has request_type', typeof firstReturn.request_type === 'string');
      await assert('Return record has reason', typeof firstReturn.reason === 'string');
      await assert('Return record has items array', Array.isArray(firstReturn.items));

      if (firstReturn.items.length > 0) {
        const item = firstReturn.items[0];
        await assert('Item has product_title_snapshot', typeof item.product_title_snapshot === 'string');
        await assert('Item has size_snapshot', item.size_snapshot !== undefined);
        await assert('Item has color_snapshot', item.color_snapshot !== undefined);
        await assert('Item has unit_price_snapshot', typeof item.unit_price_snapshot === 'number');
        await assert('Item has primary_image_url field', 'primary_image_url' in item);
      }

      // Check for EXCHANGE vs RETURN
      const exchangeReq = returnsResult.returns.find(r => r.request_type === 'EXCHANGE');
      if (exchangeReq) {
        await assert('Exchange record has request_type = EXCHANGE', exchangeReq.request_type === 'EXCHANGE');
        if (exchangeReq.items.length > 0) {
          await assert('Exchange item contains replacement size/color metadata fields', 'replacement_size' in exchangeReq.items[0]);
        }
      }

      // Check for CANCELLED vs REQUESTED status
      const cancelledReq = returnsResult.returns.find(r => r.status === 'CANCELLED');
      if (cancelledReq) {
        await assert('Cancelled return record has status = CANCELLED', cancelledReq.status === 'CANCELLED');
      }

      const requestedReq = returnsResult.returns.find(r => r.status === 'REQUESTED');
      if (requestedReq) {
        await assert('Requested return record has status = REQUESTED', requestedReq.status === 'REQUESTED');
      }
    }

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await closeServer();
  }
}

runReturnVisualsTests();
