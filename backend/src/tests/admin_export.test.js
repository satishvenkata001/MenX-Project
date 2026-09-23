import http from 'http';
import app from '../app.js';
import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { sanitizeSpreadsheetCell } from '../utils/exportGenerators.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING ADMIN DATA CENTER & BUSINESS EXPORT TESTS');
  console.log('================================================================');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  const ts = Date.now();

  let adminUser = null;
  let customerUser = null;

  try {
    // -------------------------------------------------------------
    // 1. Formula Injection Protection Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Formula Injection Protection Tests ---');
    assert(sanitizeSpreadsheetCell('=SUM(1,2)') === "'=SUM(1,2)", 'Formula starting with = is escaped with quote');
    assert(sanitizeSpreadsheetCell('+cmd|/C calc') === "'+cmd|/C calc", 'Formula starting with + non-numeric is escaped');
    assert(sanitizeSpreadsheetCell('+100') === 100, 'Valid positive number string +100 preserved as number');
    assert(sanitizeSpreadsheetCell('-50') === -50, 'Valid negative number string -50 preserved as number');
    assert(sanitizeSpreadsheetCell('@IMPORT(...)') === "'@IMPORT(...)", 'Formula starting with @ is escaped');
    assert(sanitizeSpreadsheetCell('\t=1+1') === "'\t=1+1", 'Tab-prefixed formula is escaped');
    assert(sanitizeSpreadsheetCell('Normal Title') === 'Normal Title', 'Safe text string unchanged');

    // -------------------------------------------------------------
    // 2. Setup Test Users (Super Admin and Customer)
    // -------------------------------------------------------------
    console.log('\n--- 2. Setting up Test Auth ---');
    const { data: createdAdmin } = await supabaseAdmin.auth.admin.createUser({
      email: `admin-export-test-${ts}@menx.com`,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', full_name: 'Admin Export Test' }
    });
    adminUser = createdAdmin;

    await supabaseAdmin
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', adminUser.user.id);

    const authClient = createAuthClient();
    const { data: adminLogin } = await authClient.auth.signInWithPassword({
      email: adminUser.user.email,
      password: 'Password123!'
    });
    const adminToken = adminLogin.session.access_token;

    const { data: createdCust } = await supabaseAdmin.auth.admin.createUser({
      email: `cust-export-test-${ts}@menx.com`,
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { role: 'CUSTOMER', full_name: 'Customer Test' }
    });
    customerUser = createdCust;

    const { data: custLogin } = await authClient.auth.signInWithPassword({
      email: customerUser.user.email,
      password: 'Password123!'
    });
    const custToken = custLogin.session.access_token;

    // -------------------------------------------------------------
    // 3. Security & Authorization Checks
    // -------------------------------------------------------------
    console.log('\n--- 3. Authorization & RBAC Enforcement Tests ---');

    // Unauthenticated request to /exports/summary
    const resNoAuth = await fetch(`${baseUrl}/admin/exports/summary`);
    assert(resNoAuth.status === 401, 'Unauthenticated request to /exports/summary rejected with HTTP 401');

    // Customer request to /exports/summary
    const resCustSummary = await fetch(`${baseUrl}/admin/exports/summary`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });
    assert(resCustSummary.status === 403, 'Customer request to /exports/summary rejected with HTTP 403');

    // Customer request to /exports/products
    const resCustProd = await fetch(`${baseUrl}/admin/exports/products?format=csv`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });
    assert(resCustProd.status === 403, 'Customer request to /exports/products rejected with HTTP 403');

    // Customer request to /exports/orders
    const resCustOrders = await fetch(`${baseUrl}/admin/exports/orders?format=csv`, {
      headers: { Authorization: `Bearer ${custToken}` }
    });
    assert(resCustOrders.status === 403, 'Customer request to /exports/orders rejected with HTTP 403');

    // -------------------------------------------------------------
    // 4. Authorized Export Summary Endpoint
    // -------------------------------------------------------------
    console.log('\n--- 4. Data Center Summary Endpoint Tests ---');
    const resAdminSummary = await fetch(`${baseUrl}/admin/exports/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resAdminSummary.status === 200, 'Authorized admin receives HTTP 200 on /exports/summary');
    const summaryData = await resAdminSummary.json();
    assert(summaryData.success === true, 'Summary response has success=true');
    assert(Array.isArray(summaryData.data?.datasets), 'Summary returns datasets array');
    assert(summaryData.data.datasets.some(d => d.id === 'products_stock'), 'Dataset products_stock is listed');
    assert(summaryData.data.datasets.some(d => d.id === 'orders'), 'Dataset orders is listed');

    // -------------------------------------------------------------
    // 5. Products & Stock Export Tests (CSV & XLSX)
    // -------------------------------------------------------------
    console.log('\n--- 5. Products & Stock Export Tests ---');

    // Products CSV Export
    const resProdCsv = await fetch(`${baseUrl}/admin/exports/products?format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resProdCsv.status === 200, 'Products CSV export returns HTTP 200');
    assert(resProdCsv.headers.get('content-type')?.includes('text/csv'), 'Products CSV has text/csv content-type');
    const prodArrayBuffer = await resProdCsv.arrayBuffer();
    const prodBuffer = Buffer.from(prodArrayBuffer);
    assert(prodBuffer[0] === 0xEF && prodBuffer[1] === 0xBB && prodBuffer[2] === 0xBF, 'Products CSV contains UTF-8 BOM bytes');
    const prodCsvText = prodBuffer.toString('utf-8');
    assert(prodCsvText.includes('Product ID') && prodCsvText.includes('Stock Available'), 'Products CSV contains expected column headers');
    assert(prodCsvText.includes('MENS-CLASS-3137'), 'Products CSV contains SKU MENS-CLASS-3137');

    // Products XLSX Export
    const resProdXlsx = await fetch(`${baseUrl}/admin/exports/products?format=xlsx`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resProdXlsx.status === 200, 'Products XLSX export returns HTTP 200');
    assert(
      resProdXlsx.headers.get('content-type')?.includes('openxmlformats-officedocument.spreadsheetml.sheet'),
      'Products XLSX has openxmlformats content-type'
    );
    const prodXlsxBuffer = await resProdXlsx.arrayBuffer();
    assert(prodXlsxBuffer.byteLength > 1000, 'Products XLSX returned valid non-empty workbook binary');

    // Products with stockStatus filter
    const resProdFilter = await fetch(`${baseUrl}/admin/exports/products?format=csv&stockStatus=IN_STOCK`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resProdFilter.status === 200, 'Products export with stockStatus=IN_STOCK returns HTTP 200');

    // -------------------------------------------------------------
    // 6. Orders Export Tests (CSV, XLSX, Date Validation)
    // -------------------------------------------------------------
    console.log('\n--- 6. Orders Export Tests ---');

    // Invalid date range (from > to)
    const resInvalidDates = await fetch(`${baseUrl}/admin/exports/orders?fromDate=2026-12-31&toDate=2026-01-01`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resInvalidDates.status === 400, 'Orders export with fromDate > toDate rejected with HTTP 400');

    // Orders CSV Export
    const resOrdersCsv = await fetch(`${baseUrl}/admin/exports/orders?format=csv`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resOrdersCsv.status === 200, 'Orders CSV export returns HTTP 200');
    assert(resOrdersCsv.headers.get('content-type')?.includes('text/csv'), 'Orders CSV has text/csv content-type');
    const ordersArrayBuffer = await resOrdersCsv.arrayBuffer();
    const ordersBuffer = Buffer.from(ordersArrayBuffer);
    assert(ordersBuffer[0] === 0xEF && ordersBuffer[1] === 0xBB && ordersBuffer[2] === 0xBF, 'Orders CSV contains UTF-8 BOM bytes');
    const ordersCsvText = ordersBuffer.toString('utf-8');
    assert(ordersCsvText.includes('Order Number') && ordersCsvText.includes('Line Total (₹)'), 'Orders CSV contains expected column headers');

    // Orders XLSX Export
    const resOrdersXlsx = await fetch(`${baseUrl}/admin/exports/orders?format=xlsx`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resOrdersXlsx.status === 200, 'Orders XLSX export returns HTTP 200');
    const ordersXlsxBuffer = await resOrdersXlsx.arrayBuffer();
    assert(ordersXlsxBuffer.byteLength > 1000, 'Orders XLSX returned valid non-empty workbook binary');

    // -------------------------------------------------------------
    // 7. Audit Logging Verification
    // -------------------------------------------------------------
    console.log('\n--- 7. Audit Logging Tests ---');
    if (pool) {
      const { rows: auditRows } = await pool.query(
        `SELECT * FROM audit_logs WHERE target_entity = 'DATA_CENTER' ORDER BY created_at DESC LIMIT 5`
      );
      assert(auditRows.length > 0, 'Audit logs contains entries for Data Center exports');
      if (auditRows.length > 0) {
        const latest = auditRows[0];
        assert(
          latest.action === 'EXPORT_PRODUCTS_STOCK' || latest.action === 'EXPORT_ORDERS',
          `Audit log recorded expected export action: ${latest.action}`
        );
      }
    }

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Cleanup test users
    if (adminUser?.user?.id) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', adminUser.user.id);
        await supabaseAdmin.auth.admin.deleteUser(adminUser.user.id);
      } catch {}
    }
    if (customerUser?.user?.id) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', customerUser.user.id);
        await supabaseAdmin.auth.admin.deleteUser(customerUser.user.id);
      } catch {}
    }

    server.close();
    console.log('\n================================================================');
    console.log(`Export tests finished: ${passed} passed, ${failed} failed.`);
    console.log('================================================================');
  }
}

runTests();
