import http from 'http';
import app from '../app.js';
import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

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
        try { json = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runBulkVariantTests() {
  console.log('================================================================');
  console.log('  MENX — BULK PRODUCT VARIANT CREATION VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  const createdUserIds = [];
  const createdProductIds = [];

  try {
    const ts = Date.now();
    const adminEmail = `admin.bulkvar.${ts}@menxfashion.com`;
    const password = 'Password123!Secure';

    // 1. Create and authenticate Admin user
    const { data: createdAdmin, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', full_name: 'Bulk Variant Admin Test' }
    });
    if (adminErr) throw new Error(`Admin creation failed: ${adminErr.message}`);
    createdUserIds.push(createdAdmin.user.id);

    await supabaseAdmin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', createdAdmin.user.id);

    const authClient = createAuthClient();
    const { data: adminLogin, error: loginErr } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (loginErr) throw new Error(`Admin login failed: ${loginErr.message}`);
    const adminToken = adminLogin.session.access_token;

    // 2. Fetch Category & Subcategory
    const catRes = await pool.query("SELECT id FROM categories WHERE slug = 't-shirts' LIMIT 1");
    if (catRes.rows.length === 0) throw new Error("Category 't-shirts' not found");
    const catId = catRes.rows[0].id;

    const subRes = await pool.query("SELECT id FROM subcategories WHERE category_id = $1 LIMIT 1", [catId]);
    const subId = subRes.rows.length > 0 ? subRes.rows[0].id : null;

    // 3. Create Test Product
    const testSlug = `bulk-var-test-${ts}`;
    const prodInsert = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, base_mrp, base_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PUBLISHED')
       RETURNING id, title, slug`,
      ['Bulk Variant Test Shirt', testSlug, 'Test Description for Bulk Variants', catId, subId, 1999, 1499]
    );
    const testProduct = prodInsert.rows[0];
    createdProductIds.push(testProduct.id);

    // 4. Fetch Colors
    const greenRes = await pool.query("SELECT id, name, hex_code FROM colors WHERE hex_code = '#808000' OR name = 'Olive Green' LIMIT 1");
    const greenColor = greenRes.rows[0];

    const blueRes = await pool.query("SELECT id, name, hex_code FROM colors WHERE name = 'Navy Blue' OR name = 'Royal Blue' LIMIT 1");
    const blueColor = blueRes.rows[0];

    // 5. Fetch Apparel Sizes
    const sizesRes = await pool.query("SELECT id, name, category_type FROM sizes WHERE name = ANY($1::text[]) AND category_type = 'APPAREL'", [['S', 'M', 'L', 'XL']]);
    const sizeMap = new Map(sizesRes.rows.map(s => [s.name, s]));
    const sizeS = sizeMap.get('S');
    const sizeM = sizeMap.get('M');
    const sizeL = sizeMap.get('L');
    const sizeXL = sizeMap.get('XL');

    // -------------------------------------------------------------------------
    // TEST 1: Single-Request Bulk Variant Creation (Colorway + 4 Sizes)
    // -------------------------------------------------------------------------
    console.log('>>> 1. Testing Single-Request Bulk Variant Creation (1 POST for 4 sizes)...');
    const bulkPayloadGroup1 = {
      variants: [
        {
          sizeId: sizeS.id,
          colorId: greenColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-GRN-S-01`,
          barcode: `890${Date.now().toString().slice(-6)}101`,
          mrp: 1999,
          sellingPrice: 1499,
          weightGrams: 300,
          lowStockThreshold: 5,
          initialStock: 10
        },
        {
          sizeId: sizeM.id,
          colorId: greenColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-GRN-M-02`,
          barcode: `890${Date.now().toString().slice(-6)}102`,
          mrp: 1999,
          sellingPrice: 1499,
          weightGrams: 300,
          lowStockThreshold: 5,
          initialStock: 15
        },
        {
          sizeId: sizeL.id,
          colorId: greenColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-GRN-L-03`,
          barcode: `890${Date.now().toString().slice(-6)}103`,
          mrp: 1999,
          sellingPrice: 1499,
          weightGrams: 300,
          lowStockThreshold: 5,
          initialStock: 20
        },
        {
          sizeId: sizeXL.id,
          colorId: greenColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-GRN-XL-04`,
          barcode: `890${Date.now().toString().slice(-6)}104`,
          mrp: 1999,
          sellingPrice: 1499,
          weightGrams: 300,
          lowStockThreshold: 5,
          initialStock: 5
        }
      ]
    };

    const res1 = await makeRequest(server, `/api/v1/admin/products/${testProduct.id}/variants/bulk`, 'POST', {
      'Authorization': `Bearer ${adminToken}`
    }, JSON.stringify(bulkPayloadGroup1));

    assert(res1.statusCode === 201, `POST /admin/products/:id/variants/bulk returns HTTP 201 (got ${res1.statusCode})`);
    assert(Array.isArray(res1.json?.data), 'Response data is an array');
    assert(res1.json?.data?.length === 4, `All 4 variants created in a single batch (got ${res1.json?.data?.length})`);
    assert(res1.headers['ratelimit-limit'] === '1500', `Bulk endpoint is protected by adminLimiter (1500 limit)`);

    // Verify stock and inventory created authoritatively
    for (const v of res1.json.data) {
      const invCheck = await pool.query('SELECT quantity_available FROM inventory_items WHERE variant_id = $1', [v.id]);
      assert(invCheck.rows.length === 1, `inventory_items record exists for variant ${v.sku}`);
      assert(invCheck.rows[0].quantity_available === v.availableStock, `inventory_items quantity (${invCheck.rows[0].quantity_available}) matches payload initialStock (${v.availableStock})`);

      const moveCheck = await pool.query("SELECT quantity, movement_type FROM stock_movements WHERE variant_id = $1 AND movement_type = 'INITIAL_STOCK'", [v.id]);
      assert(moveCheck.rows.length === 1, `stock_movements record exists for variant ${v.sku}`);
      assert(moveCheck.rows[0].quantity === v.availableStock, `stock_movements quantity matches initial stock`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Intra-Batch Duplicate Prevention
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Testing Intra-Batch Duplicate Prevention...');
    const duplicatePayload = {
      variants: [
        {
          sizeId: sizeS.id,
          colorId: blueColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-BLU-S-01`,
          barcode: `890${Date.now().toString().slice(-6)}201`,
          mrp: 1999,
          sellingPrice: 1499,
          initialStock: 10
        },
        {
          sizeId: sizeS.id, // SAME size and color in same payload!
          colorId: blueColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-BLU-S-02`,
          barcode: `890${Date.now().toString().slice(-6)}202`,
          mrp: 1999,
          sellingPrice: 1499,
          initialStock: 12
        }
      ]
    };

    const res2 = await makeRequest(server, `/api/v1/admin/products/${testProduct.id}/variants/bulk`, 'POST', {
      'Authorization': `Bearer ${adminToken}`
    }, JSON.stringify(duplicatePayload));

    assert(res2.statusCode === 409, `Intra-batch duplicate size/color rejected with HTTP 409 (got ${res2.statusCode})`);
    assert(res2.json?.message?.includes('Duplicate size and color'), `Error message explains conflict: "${res2.json?.message}"`);

    // -------------------------------------------------------------------------
    // TEST 3: Database Duplicate Prevention (Existing Active Variant)
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Testing Database Duplicate Prevention...');
    const dbDuplicatePayload = {
      variants: [
        {
          sizeId: sizeS.id, // Already created in Test 1 with greenColor!
          colorId: greenColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-GRN-S-NEW`,
          barcode: `890${Date.now().toString().slice(-6)}301`,
          mrp: 1999,
          sellingPrice: 1499,
          initialStock: 8
        }
      ]
    };

    const res3 = await makeRequest(server, `/api/v1/admin/products/${testProduct.id}/variants/bulk`, 'POST', {
      'Authorization': `Bearer ${adminToken}`
    }, JSON.stringify(dbDuplicatePayload));

    assert(res3.statusCode === 409, `Pre-existing variant rejected with HTTP 409 (got ${res3.statusCode})`);
    assert(res3.json?.message?.includes('already exists'), `Error message explains duplicate: "${res3.json?.message}"`);

    // -------------------------------------------------------------------------
    // TEST 4: Atomic Rollback on Failure
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing Atomic Rollback on Failure...');
    // In this batch, item 1 is valid (Blue M), item 2 has an invalid size for Apparel (e.g. shoe size 8 or duplicate SKU)
    const atomicTestPayload = {
      variants: [
        {
          sizeId: sizeM.id,
          colorId: blueColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-BLU-M-01`,
          barcode: `890${Date.now().toString().slice(-6)}401`,
          mrp: 1999,
          sellingPrice: 1499,
          initialStock: 10
        },
        {
          sizeId: sizeL.id,
          colorId: blueColor.id,
          sku: `${testSlug.slice(0, 8).toUpperCase()}-GRN-S-01`, // Collision with item from Test 1!
          barcode: `890${Date.now().toString().slice(-6)}402`,
          mrp: 1999,
          sellingPrice: 1499,
          initialStock: 15
        }
      ]
    };

    const res4 = await makeRequest(server, `/api/v1/admin/products/${testProduct.id}/variants/bulk`, 'POST', {
      'Authorization': `Bearer ${adminToken}`
    }, JSON.stringify(atomicTestPayload));

    assert(res4.statusCode === 409, `Batch with collision rejected with HTTP 409 (got ${res4.statusCode})`);

    // Verify Blue M was rolled back and NOT inserted into the database!
    const blueMCheck = await pool.query(
      "SELECT id FROM product_variants WHERE product_id = $1 AND sku = $2",
      [testProduct.id, `${testSlug.slice(0, 8).toUpperCase()}-BLU-M-01`]
    );
    assert(blueMCheck.rows.length === 0, 'Atomic rollback verified: First item was NOT persisted when second item failed');

    // -------------------------------------------------------------------------
    // TEST 5: Backward Compatibility of Single-Variant Creation
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Existing Single-Variant Creation Contract Unchanged...');
    const singlePayload = {
      sizeId: sizeL.id,
      colorId: blueColor.id,
      sku: `${testSlug.slice(0, 8).toUpperCase()}-BLU-L-SINGLE`,
      barcode: `890${Date.now().toString().slice(-6)}501`,
      mrp: 1999,
      sellingPrice: 1499,
      initialStock: 7
    };

    const singleRes = await makeRequest(server, `/api/v1/admin/products/${testProduct.id}/variants`, 'POST', {
      'Authorization': `Bearer ${adminToken}`
    }, JSON.stringify(singlePayload));

    assert(singleRes.statusCode === 201, `Existing POST /admin/products/:id/variants still works (HTTP 201)`);
    assert(singleRes.json?.data?.sku === singlePayload.sku, `Single variant returned expected SKU`);
    assert(singleRes.json?.data?.availableStock === 7, `Single variant returned expected availableStock`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    console.log('\n>>> Cleaning up test fixtures...');
    if (createdProductIds.length > 0) {
      for (const pid of createdProductIds) {
        const vRes = await pool.query("SELECT id FROM product_variants WHERE product_id = $1", [pid]);
        const vIds = vRes.rows.map(r => r.id);
        if (vIds.length > 0) {
          await pool.query("DELETE FROM stock_movements WHERE variant_id = ANY($1)", [vIds]);
          await pool.query("DELETE FROM inventory_items WHERE variant_id = ANY($1)", [vIds]);
          await pool.query("DELETE FROM product_variants WHERE product_id = $1", [pid]);
        }
        await pool.query("DELETE FROM products WHERE id = $1", [pid]);
      }
    }
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

runBulkVariantTests();
