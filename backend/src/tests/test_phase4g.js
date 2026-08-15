import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { StorageService } from '../services/storage.service.js';
import { env } from '../config/env.js';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildMultipartBody(fields, fileBuffer, filename, mimetype, boundary) {
  const parts = [];
  
  // Add text fields
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    ));
  }
  
  // Add file
  if (fileBuffer) {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\n`
    ));
    parts.push(fileBuffer);
    parts.push(Buffer.from('\r\n'));
  }
  
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  
  return Buffer.concat(parts);
}

async function runPhase4GTests() {
  console.log('================================================================');
  console.log('         MENX PHASE 4G — STORAGE & UPLOADS TEST SUITE');
  console.log('================================================================\n');

  // Initialize the bucket first
  await StorageService.initBucket();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  let passedTests = 0;
  let totalTests = 0;

  async function assert(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(` [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(` [FAIL] ${name} — ${details}`);
    }
  }

  // Tracking IDs for cleanup
  const createdUserIds = [];
  const createdStoreIds = [];
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];
  const createdImageIds = [];

  let customerToken = null;
  let customerUserId = null;
  let staffToken = null;
  let staffUserId = null;
  let managerToken = null;
  let managerUserId = null;

  let testStore = null;
  let testCategory = null;
  let testSubcategory = null;
  let testProduct = null;
  let testProductDraft = null;
  let testVariant = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Test Accounts & Fixtures
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Initializing Customers, Admins, Taxonomy & Catalog...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    async function createUser(email, firstName, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'Customer' }
      });
      if (authErr) throw new Error(`User ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 200));
      const { error: profileErr } = await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);
      if (profileErr) throw new Error(`Profile role update failed for ${uid}: ${profileErr.message}`);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`User ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const cust = await createUser(`cust.${ts}@menx.com`, 'CustomerUser', 'CUSTOMER');
    customerUserId = cust.uid;
    customerToken = cust.token;

    const stf = await createUser(`staff.${ts}@menx.com`, 'StaffUser', 'STORE_STAFF');
    staffUserId = stf.uid;
    staffToken = stf.token;

    const mgr = await createUser(`mgr.${ts}@menx.com`, 'ManagerUser', 'STORE_MANAGER');
    managerUserId = mgr.uid;
    managerToken = mgr.token;

    // Store
    const { data: st, error: stErr } = await supabaseAdmin
      .from('stores')
      .insert({
        name: 'MenX 4G Warehouse',
        code: `ONLINE-${ts}`,
        type: 'ONLINE_FULFILLMENT',
        address_line1: 'Warehouse Zone 4G',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500081',
        phone: '+91 9900991111',
        is_active: true
      })
      .select()
      .single();
    if (stErr) throw new Error(`Store insert failed: ${stErr.message}`);
    testStore = st;
    createdStoreIds.push(st.id);

    // Category & Subcategory
    const { data: cat, error: catErr } = await supabaseAdmin
      .from('categories')
      .insert({ name: `Apparel-${ts}`, slug: `apparel-${ts}`, display_order: 1 })
      .select()
      .single();
    if (catErr) throw new Error(`Category insert failed: ${catErr.message}`);
    testCategory = cat;
    createdCategoryIds.push(cat.id);

    const { data: subcat, error: subcatErr } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: cat.id, name: `Shirts-${ts}`, slug: `shirts-${ts}`, display_order: 1 })
      .select()
      .single();
    if (subcatErr) throw new Error(`Subcategory insert failed: ${subcatErr.message}`);
    testSubcategory = subcat;
    createdSubcategoryIds.push(subcat.id);

    // Products
    const { data: prod, error: prodErr } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'F4G Test Product',
        slug: `f4g-test-product-${ts}`,
        description: 'F4G cotton shirt.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        status: 'PUBLISHED',
        base_mrp: 1000.00,
        base_price: 800.00
      })
      .select()
      .single();
    if (prodErr) throw new Error(`Product insert failed: ${prodErr.message}`);
    testProduct = prod;
    createdProductIds.push(prod.id);

    // Draft Product
    const { data: prodDraft, error: prodDraftErr } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'F4G Draft Product',
        slug: `f4g-draft-product-${ts}`,
        description: 'F4G draft cotton shirt.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        status: 'DRAFT',
        base_mrp: 1000.00,
        base_price: 800.00
      })
      .select()
      .single();
    if (prodDraftErr) throw new Error(`Draft Product insert failed: ${prodDraftErr.message}`);
    testProductDraft = prodDraft;
    createdProductIds.push(prodDraft.id);

    // Size & Color
    const { data: sz, error: szErr } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-${ts}`, category_type: 'APPAREL', sort_order: 1 })
      .select()
      .single();
    if (szErr) throw new Error(`Size insert failed: ${szErr.message}`);
    createdSizeIds.push(sz.id);

    const { data: cl, error: clErr } = await supabaseAdmin
      .from('colors')
      .insert({ name: `Crimson-${ts}`, hex_code: '#DC143C' })
      .select()
      .single();
    if (clErr) throw new Error(`Color insert failed: ${clErr.message}`);
    createdColorIds.push(cl.id);

    // Variant
    const { data: variant, error: variantErr } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod.id,
        size_id: sz.id,
        color_id: cl.id,
        sku: `VAR-L-${ts}`,
        barcode: `BAR-${ts}`,
        mrp: 1000.00,
        selling_price: 800.00,
        is_active: true
      })
      .select()
      .single();
    if (variantErr) throw new Error(`Variant insert failed: ${variantErr.message}`);
    testVariant = variant;
    createdVariantIds.push(variant.id);

    console.log(' Setup completed successfully!\n');

    // Helper for JSON and Multipart requests
    async function makeRequest(url, method, token, body = null, isMultipart = false, boundary = null) {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let reqBody = null;
      if (isMultipart) {
        headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
        reqBody = body;
      } else {
        headers['Content-Type'] = 'application/json';
        reqBody = body ? JSON.stringify(body) : null;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: reqBody
      });

      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch (e) {}

      return { status: res.status, body: json, rawText: text };
    }

    // Prepare a mock small 1x1 png image buffer for uploads
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated upload rejected
    // -------------------------------------------------------------------------
    const boundary = '----TestBoundary' + Date.now();
    const multipartBody1 = buildMultipartBody({}, dummyImageBuffer, 'test.png', 'image/png', boundary);
    const resAuth1 = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', null, multipartBody1, true, boundary);
    await assert('1. Unauthenticated upload rejected', resAuth1.status === 401);

    // -------------------------------------------------------------------------
    // TEST 2: CUSTOMER upload rejected
    // -------------------------------------------------------------------------
    const resAuth2 = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', customerToken, multipartBody1, true, boundary);
    await assert('2. CUSTOMER upload rejected', resAuth2.status === 403);

    // -------------------------------------------------------------------------
    // TEST 3: STORE_STAFF upload rejected
    // -------------------------------------------------------------------------
    const resAuth3 = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', staffToken, multipartBody1, true, boundary);
    await assert('3. STORE_STAFF upload rejected', resAuth3.status === 403);

    // -------------------------------------------------------------------------
    // TEST 4: Authorized manager upload succeeds
    // -------------------------------------------------------------------------
    const resAuth4 = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', managerToken, multipartBody1, true, boundary);
    await assert('4. Authorized manager upload succeeds', resAuth4.status === 201);
    
    let uploadedImage1 = null;
    if (resAuth4.status === 201) {
      uploadedImage1 = resAuth4.body.data;
      createdImageIds.push(uploadedImage1.id);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Unsupported MIME type rejected
    // -------------------------------------------------------------------------
    const multipartBodyMime = buildMultipartBody({}, dummyImageBuffer, 'test.txt', 'text/plain', boundary);
    const resMime = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', managerToken, multipartBodyMime, true, boundary);
    await assert('5. Unsupported MIME type rejected', resMime.status === 400);

    // -------------------------------------------------------------------------
    // TEST 6: Oversized file rejected
    // -------------------------------------------------------------------------
    // Generate an oversized buffer (>2MB)
    const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 100);
    const multipartBodyLarge = buildMultipartBody({}, largeBuffer, 'large.png', 'image/png', boundary);
    const resLarge = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', managerToken, multipartBodyLarge, true, boundary);
    await assert('6. Oversized file rejected', resLarge.status === 400);

    // -------------------------------------------------------------------------
    // TEST 7: Invalid product UUID rejected
    // -------------------------------------------------------------------------
    const resInvalidUuid = await makeRequest(`${baseUrl}/admin/products/invalid-uuid/images/upload`, 'POST', managerToken, multipartBody1, true, boundary);
    await assert('7. Invalid product UUID rejected', resInvalidUuid.status === 400);

    // -------------------------------------------------------------------------
    // TEST 8: Non-existent product rejected
    // -------------------------------------------------------------------------
    const nonExistentUuid = '99999999-9999-9999-9999-999999999999';
    const resNonExistent = await makeRequest(`${baseUrl}/admin/products/${nonExistentUuid}/images/upload`, 'POST', managerToken, multipartBody1, true, boundary);
    await assert('8. Non-existent product rejected', resNonExistent.status === 404);

    // -------------------------------------------------------------------------
    // TEST 9 & 10: Storage object created & product_images record created
    // -------------------------------------------------------------------------
    await assert('9. Storage object URL returned in upload response', uploadedImage1 && uploadedImage1.image_url.includes('menx-product-images'));
    
    // Fetch from storage to confirm it exists
    let storageExists = false;
    if (uploadedImage1) {
      const marker = '/public/menx-product-images/';
      const idx = uploadedImage1.image_url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = uploadedImage1.image_url.substring(idx + marker.length);
        const { data: listData } = await supabaseAdmin.storage.from(env.IMAGE_BUCKET_NAME).list(path.dirname(storagePath));
        storageExists = listData && listData.some(f => f.name === path.basename(storagePath));
      }
    }
    await assert('9b. Storage object confirmed existing in Supabase bucket', storageExists);

    const { data: dbImageRecord } = uploadedImage1 ? await supabaseAdmin.from('product_images').select('id').eq('id', uploadedImage1.id).single() : { data: null };
    await assert('10. product_images record created in database', dbImageRecord !== null);

    // -------------------------------------------------------------------------
    // TEST 11: Public product API returns image
    // -------------------------------------------------------------------------
    const resPublicProduct = await makeRequest(`${baseUrl}/products/${testProduct.slug}`, 'GET', null);
    const publicImages = resPublicProduct.body?.data?.images || [];
    await assert('11. Public product API returns image', publicImages.some(img => img.id === uploadedImage1.id));

    // -------------------------------------------------------------------------
    // TEST 12: Multiple images supported
    // -------------------------------------------------------------------------
    const multipartBody2 = buildMultipartBody({ displayOrder: '1' }, dummyImageBuffer, 'test2.png', 'image/png', boundary);
    const resSecondUpload = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/upload`, 'POST', managerToken, multipartBody2, true, boundary);
    let uploadedImage2 = null;
    if (resSecondUpload.status === 201) {
      uploadedImage2 = resSecondUpload.body.data;
      createdImageIds.push(uploadedImage2.id);
    }
    await assert('12. Multiple images supported (second upload success)', resSecondUpload.status === 201);

    // -------------------------------------------------------------------------
    // TEST 13: Image ordering works
    // -------------------------------------------------------------------------
    const reorderPayload = {
      images: [
        { imageId: uploadedImage1.id, displayOrder: 10 },
        { imageId: uploadedImage2.id, displayOrder: 5 }
      ]
    };
    const resReorder = await makeRequest(`${baseUrl}/admin/products/${testProduct.id}/images/reorder`, 'PATCH', managerToken, reorderPayload);
    await assert('13. Image ordering works (reorder success)', resReorder.status === 200);

    const { data: reorderedImage1 } = await supabaseAdmin.from('product_images').select('display_order').eq('id', uploadedImage1.id).single();
    const { data: reorderedImage2 } = await supabaseAdmin.from('product_images').select('display_order').eq('id', uploadedImage2.id).single();
    await assert('13b. Verify display order in DB', reorderedImage1?.display_order === 10 && reorderedImage2?.display_order === 5);

    // -------------------------------------------------------------------------
    // TEST 14: Primary image behavior works where supported
    // -------------------------------------------------------------------------
    // Initially, let's make uploadedImage1 primary
    const resPrimary1 = await makeRequest(`${baseUrl}/admin/images/${uploadedImage1.id}/primary`, 'POST', managerToken);
    await assert('14. Set first image as primary', resPrimary1.status === 200);

    const { data: prim1Check } = await supabaseAdmin.from('product_images').select('is_primary').eq('id', uploadedImage1.id).single();
    await assert('14b. Confirm first image is primary in DB', prim1Check?.is_primary === true);

    // Set second image as primary, which should unset first image
    const resPrimary2 = await makeRequest(`${baseUrl}/admin/images/${uploadedImage2.id}/primary`, 'POST', managerToken);
    await assert('14c. Set second image as primary', resPrimary2.status === 200);

    const { data: prim1After } = await supabaseAdmin.from('product_images').select('is_primary').eq('id', uploadedImage1.id).single();
    const { data: prim2After } = await supabaseAdmin.from('product_images').select('is_primary').eq('id', uploadedImage2.id).single();
    await assert('14d. Second image is primary and first is unset', prim1After?.is_primary === false && prim2After?.is_primary === true);

    // -------------------------------------------------------------------------
    // TEST 15: Unauthorized image deletion rejected
    // -------------------------------------------------------------------------
    const resDelUnauth = await makeRequest(`${baseUrl}/admin/images/${uploadedImage1.id}`, 'DELETE', customerToken);
    await assert('15. Unauthorized image deletion rejected', resDelUnauth.status === 403);

    // -------------------------------------------------------------------------
    // TEST 16 & 17 & 18: Authorized deletion succeeds, storage and DB removed
    // -------------------------------------------------------------------------
    const resDelAuth = await makeRequest(`${baseUrl}/admin/images/${uploadedImage1.id}`, 'DELETE', managerToken);
    await assert('16. Authorized image deletion succeeds', resDelAuth.status === 200);

    // Verify storage deleted
    let storageDeleted = false;
    if (uploadedImage1) {
      const marker = '/public/menx-product-images/';
      const idx = uploadedImage1.image_url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = uploadedImage1.image_url.substring(idx + marker.length);
        const { data: listData } = await supabaseAdmin.storage.from(env.IMAGE_BUCKET_NAME).list(path.dirname(storagePath));
        storageDeleted = !listData || !listData.some(f => f.name === path.basename(storagePath));
      }
    }
    await assert('17. Storage object removed after deletion', storageDeleted);

    const { data: dbRecordAfterDel } = await supabaseAdmin.from('product_images').select('id').eq('id', uploadedImage1.id).single();
    await assert('18. Database image record removed after deletion', dbRecordAfterDel === null);

    // Remove from tracking so cleanup won't complain/fail
    const trackingIdx = createdImageIds.indexOf(uploadedImage1.id);
    if (trackingIdx !== -1) createdImageIds.splice(trackingIdx, 1);

    // -------------------------------------------------------------------------
    // TEST 19: Invalid image ID rejected (delete non-existent returns 404)
    // -------------------------------------------------------------------------
    const resDelInvalid = await makeRequest(`${baseUrl}/admin/images/${nonExistentUuid}`, 'DELETE', managerToken);
    await assert('19. Invalid image ID deletion rejected', resDelInvalid.status === 404);

    // -------------------------------------------------------------------------
    // TEST 20: Cross-product image manipulation rejected
    // -------------------------------------------------------------------------
    // Create another product
    const { data: prod2, error: prod2Err } = await supabaseAdmin.from('products').insert({
      title: 'Product 2',
      slug: `product-2-${ts}`,
      description: 'Product 2 description',
      category_id: cat.id,
      subcategory_id: subcat.id,
      base_mrp: 100.00,
      base_price: 80.00
    }).select().single();
    if (prod2Err) throw new Error(`Product 2 insert failed: ${prod2Err.message}`);
    createdProductIds.push(prod2.id);

    // Reorder with images from different products
    const crossReorderPayload = {
      images: [
        { imageId: uploadedImage2.id, displayOrder: 1 } // belongs to testProduct, trying to patch under prod2
      ]
    };
    const resCrossReorder = await makeRequest(`${baseUrl}/admin/products/${prod2.id}/images/reorder`, 'PATCH', managerToken, crossReorderPayload);
    await assert('20. Cross-product image reordering rejected', resCrossReorder.status === 400);

    // -------------------------------------------------------------------------
    // TEST 21: Draft/archived product exposure remains protected
    // -------------------------------------------------------------------------
    // Fetch draft product publicly (should return 404)
    const resPublicDraft = await makeRequest(`${baseUrl}/products/${testProductDraft.slug}`, 'GET', null);
    await assert('21. Draft product details blocked publicly', resPublicDraft.status === 404);

    // -------------------------------------------------------------------------
    // TEST 22: Service-role secret is never present in API responses
    // -------------------------------------------------------------------------
    const rawTextResponse = resPublicProduct.rawText;
    const containsSecret = rawTextResponse.includes(env.SUPABASE_SECRET_KEY);
    await assert('22. Service-role secret is not leaked in API responses', !containsSecret);

    // -------------------------------------------------------------------------
    // TEST 23: Existing Phase 4B image endpoints still work
    // -------------------------------------------------------------------------
    const resPublicImages = await makeRequest(`${baseUrl}/products/${testProduct.id}/images`, 'GET', null);
    await assert('23. Public catalog image endpoint works', resPublicImages.status === 200 && Array.isArray(resPublicImages.body.data));

  } catch (err) {
    console.error('Test Suite encountered an error:', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purging all temporary test fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up all temporary test fixtures...');

    // 1. Storage cleanup for any remaining test images
    for (const imageId of createdImageIds) {
      const { data: img } = await supabaseAdmin.from('product_images').select('image_url').eq('id', imageId).single();
      if (img) {
        const marker = '/public/menx-product-images/';
        const idx = img.image_url.indexOf(marker);
        if (idx !== -1) {
          const storagePath = img.image_url.substring(idx + marker.length);
          await supabaseAdmin.storage.from(env.IMAGE_BUCKET_NAME).remove([storagePath]);
        }
      }
    }

    // Delete DB image metadata records
    if (createdImageIds.length > 0) {
      await supabaseAdmin.from('product_images').delete().in('id', createdImageIds);
    }

    // Delete other catalog and store fixtures
    if (createdVariantIds.length > 0) {
      await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
    }
    if (createdProductIds.length > 0) {
      await supabaseAdmin.from('products').delete().in('id', createdProductIds);
    }
    if (createdSizeIds.length > 0) {
      await supabaseAdmin.from('sizes').delete().in('id', createdSizeIds);
    }
    if (createdColorIds.length > 0) {
      await supabaseAdmin.from('colors').delete().in('id', createdColorIds);
    }
    if (createdSubcategoryIds.length > 0) {
      await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds);
    }
    if (createdCategoryIds.length > 0) {
      await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds);
    }
    if (createdStoreIds.length > 0) {
      await supabaseAdmin.from('stores').delete().in('id', createdStoreIds);
    }

    // Delete test users (Supabase auth and profiles cascades)
    for (const uid of createdUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    console.log(' [PASS] All temporary test records successfully purged.');
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runPhase4GTests();
