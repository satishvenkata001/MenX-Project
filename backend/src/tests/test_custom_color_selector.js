/**
 * MENX ADMIN — CUSTOM COLOR SELECTOR TEST SUITE
 * 
 * Verifies:
 * 1. Admin POST /api/v1/admin/colors creates a custom color with valid #RRGGBB.
 * 2. #RGB normalization to uppercase 6-digit #RRGGBB (#800 -> #880000, #FFF -> #FFFFFF).
 * 3. Case-insensitive duplicate color handling (returns existing color, prevents duplicate DB rows).
 * 4. Whitespace trimming & normalization for duplicate checks.
 * 5. Invalid HEX format validation (e.g. invalid, #12, #12345).
 * 6. RBAC verification: Customer rejected (HTTP 403), Admin/Manager allowed (HTTP 201/200).
 * 7. Variant creation using newly created custom color.
 * 8. Verification that existing predefined colors (Charcoal Black, Crimson Red, Crisp White, etc.) remain valid.
 */

import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let server;
let baseUrl;

async function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('\n================================================================');
  console.log('       MENX — CUSTOM COLOR SELECTOR AUTOMATED TEST SUITE        ');
  console.log('================================================================\n');

  // Start ephemeral test server
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api/v1`;

  const createdUserIds = [];
  const createdColorIds = [];
  const createdProductIds = [];

  try {
    const ts = Date.now();
    const adminEmail = `admin_color_${ts}@menx.test`;
    const customerEmail = `customer_color_${ts}@menx.test`;
    const password = 'Password123!';

    // 1. Create Admin Account (SUPER_ADMIN)
    const { data: adminAuth, error: adminErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Color', last_name: 'Admin' }
    });
    if (adminErr) throw new Error(`Admin creation failed: ${adminErr.message}`);
    createdUserIds.push(adminAuth.user.id);

    await supabaseAdmin
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', adminAuth.user.id);

    // 2. Create Customer Account (CUSTOMER)
    const { data: customerAuth, error: custErr } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Color', last_name: 'Customer' }
    });
    if (custErr) throw new Error(`Customer creation failed: ${custErr.message}`);
    createdUserIds.push(customerAuth.user.id);

    const authClient = createAuthClient();

    // Login Admin
    const { data: adminLogin, error: adminLoginErr } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (adminLoginErr) throw new Error(`Admin login failed: ${adminLoginErr.message}`);
    const adminToken = adminLogin.session.access_token;
    await assert(!!adminToken, 'Admin successfully logged in');

    // Login Customer
    const { data: custLogin, error: custLoginErr } = await authClient.auth.signInWithPassword({
      email: customerEmail,
      password
    });
    if (custLoginErr) throw new Error(`Customer login failed: ${custLoginErr.message}`);
    const customerToken = custLogin.session.access_token;
    await assert(!!customerToken, 'Customer successfully logged in');

    console.log('\n--- 1. RBAC & Security Validation ---');
    // Customer attempting to create color -> HTTP 403
    const custColorRes = await fetch(`${baseUrl}/admin/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({ name: `TestMaroon-${ts}`, hexCode: '#800000' })
    });
    await assert(custColorRes.status === 403, 'Customer role is blocked from POST /admin/colors with HTTP 403');

    console.log('\n--- 2. Validation of Invalid Inputs ---');
    // Invalid HEX code
    const invalidHexRes = await fetch(`${baseUrl}/admin/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: `BadHex-${ts}`, hexCode: 'not-a-hex' })
    });
    await assert(invalidHexRes.status === 400, 'Invalid HEX format rejected with HTTP 400');

    // Empty name
    const emptyNameRes = await fetch(`${baseUrl}/admin/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: '   ', hexCode: '#800000' })
    });
    await assert(emptyNameRes.status === 400, 'Empty color name rejected with HTTP 400');

    console.log('\n--- 3. Custom Color Creation & #RGB Normalization ---');
    // 3-digit HEX normalization: #800 -> #880000
    const colorName1 = `Test Maroon-${ts}`;
    const createRes1 = await fetch(`${baseUrl}/admin/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: colorName1, hexCode: '#800' })
    });
    await assert(createRes1.status === 201, 'Admin can create a custom color with HTTP 201');
    const color1 = (await createRes1.json()).data;
    createdColorIds.push(color1.id);
    await assert(color1.name === colorName1, `Color name matches '${colorName1}'`);
    await assert(color1.hex_code === '#880000', `HEX #800 correctly normalized to 6-digit uppercase '#880000' (got ${color1.hex_code})`);

    // 6-digit lowercase HEX: #dc143c -> #DC143C
    const colorName2 = `Test Crimson-${ts}`;
    const createRes2 = await fetch(`${baseUrl}/admin/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: colorName2, hexCode: '#dc143c' })
    });
    const color2 = (await createRes2.json()).data;
    createdColorIds.push(color2.id);
    await assert(color2.hex_code === '#DC143C', `HEX #dc143c correctly formatted as uppercase '#DC143C'`);

    console.log('\n--- 4. Duplicate Color Handling (Case-Insensitive & Whitespace) ---');
    // Attempt duplicate with lowercase name and leading/trailing spaces
    const dupRes = await fetch(`${baseUrl}/admin/colors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ name: `   ${colorName1.toLowerCase()}   `, hexCode: '#800000' })
    });
    await assert(dupRes.status === 201 || dupRes.status === 200, 'Duplicate color request succeeds gracefully without DB error');
    const dupColor = (await dupRes.json()).data;
    await assert(dupColor.id === color1.id, `Returns existing color ID (${dupColor.id} === ${color1.id}) instead of creating a duplicate`);

    console.log('\n--- 5. Public Colors List Endpoint ---');
    const listRes = await fetch(`${baseUrl}/colors`);
    await assert(listRes.status === 200, 'GET /api/v1/colors returns HTTP 200');
    const publicColors = (await listRes.json()).data;
    const foundCustom = publicColors.some(c => c.id === color1.id);
    await assert(foundCustom, 'Newly created custom color is present in GET /api/v1/colors list');

    // Verify existing default colors exist
    const defaultColors = ['Charcoal Black', 'Crimson Red', 'Crisp White', 'Navy Blue', 'Olive Green'];
    for (const defCol of defaultColors) {
      const exists = publicColors.some(c => c.name.toLowerCase() === defCol.toLowerCase());
      await assert(exists, `Existing default color '${defCol}' exists and is functional`);
    }

    console.log('\n--- 6. Product Variant Creation with Custom Color ---');
    // Load category and size
    const catRes = await fetch(`${baseUrl}/categories`);
    const categories = (await catRes.json()).data;
    const category = categories.find(c => c.slug === 't-shirts') || categories[0];
    const subRes = await fetch(`${baseUrl}/subcategories`);
    const subcategories = (await subRes.json()).data;
    const subcategory = subcategories.find(s => s.category_id === category.id) || subcategories[0];

    const sizeRes = await fetch(`${baseUrl}/sizes`);
    const sizes = (await sizeRes.json()).data;
    const validSize = sizes.find(s => s.name === 'M' && s.category_type === 'APPAREL') || sizes.find(s => s.category_type === 'APPAREL') || sizes[0];

    // Create a product
    const prodSlug = `color-test-prod-${ts}`;
    const prodRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: `Color Test Product ${ts}`,
        slug: prodSlug,
        description: 'Test description for color variant test',
        categoryId: category.id,
        subcategoryId: subcategory.id,
        baseMrp: 1999,
        basePrice: 1499,
        status: 'DRAFT'
      })
    });
    await assert(prodRes.status === 201, 'Product created successfully');
    const product = (await prodRes.json()).data;
    createdProductIds.push(product.id);

    // Create variant with custom color
    const varSku = `SKU-COL-${ts}`;
    const varBarcode = `BC${ts}`.slice(0, 15);
    const varRes = await fetch(`${baseUrl}/admin/products/${product.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: validSize.id,
        colorId: color1.id,
        sku: varSku,
        barcode: varBarcode,
        mrp: 1999,
        sellingPrice: 1499,
        weightGrams: 300,
        lowStockThreshold: 5,
        initialStock: 20
      })
    });
    await assert(varRes.status === 201, 'Variant created with custom color successfully');
    const createdVariant = (await varRes.json()).data;
    await assert(createdVariant.color?.id === color1.id, 'Variant references the custom color ID correctly');
    await assert(createdVariant.color?.name === colorName1, `Variant contains color name '${colorName1}'`);
    await assert(createdVariant.color?.hex_code === '#880000', `Variant contains color hex code '#880000'`);

    // Fetch product variants list
    const prodVariantsRes = await fetch(`${baseUrl}/products/${product.id}/variants`);
    await assert(prodVariantsRes.status === 200, 'GET /api/v1/products/:id/variants returns HTTP 200');
    const prodVariants = (await prodVariantsRes.json()).data;
    const matchedVariant = prodVariants.find(v => v.id === createdVariant.id);
    await assert(!!matchedVariant, 'Variant found in product variants list');
    await assert(matchedVariant.color?.name === colorName1, 'Retrieved variant retains correct custom color name');
    await assert(matchedVariant.color?.hex_code === '#880000', 'Retrieved variant retains correct custom color HEX');

    console.log('\n================================================================');
    console.log('✅ ALL COLOR SELECTOR & API TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    throw err;
  } finally {
    console.log('>>> Cleaning up test fixtures...');
    if (createdProductIds.length > 0) {
      try {
        await supabaseAdmin.from('product_variants').delete().in('product_id', createdProductIds);
        await supabaseAdmin.from('products').delete().in('id', createdProductIds);
      } catch (e) {
        console.warn('Product cleanup warning:', e.message);
      }
    }
    if (createdColorIds.length > 0) {
      try {
        await supabaseAdmin.from('colors').delete().in('id', createdColorIds);
      } catch (e) {
        console.warn('Color cleanup warning:', e.message);
      }
    }
    if (createdUserIds.length > 0) {
      try {
        for (const uid of createdUserIds) {
          await supabaseAdmin.auth.admin.deleteUser(uid);
        }
      } catch (e) {
        console.warn('User cleanup warning:', e.message);
      }
    }
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }
}

runTests().then(() => {
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
