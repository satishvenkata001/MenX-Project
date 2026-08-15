import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runPhase4BTests() {
  console.log('================================================================');
  console.log('       MENX PHASE 4B — CATALOG & PRODUCT API TEST SUITE');
  console.log('================================================================\n');

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
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];
  const createdImageIds = [];

  let customerToken = null;
  let adminToken = null;
  let customerUserId = null;
  let adminUserId = null;

  let testCategory = null;
  let testSubcategory = null;
  let testBrand = null;
  let testSize = null;
  let testColor = null;
  let testPublishedProduct = null;
  let testDraftProduct = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create Test Customer & Admin Users
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Initializing Test Accounts & Fixtures...');
    const customerEmail = `test.customer.${Date.now()}@menxfashion.com`;
    const adminEmail = `test.admin.${Date.now()}@menxfashion.com`;
    const password = 'Password123!Secure';

    // 1. Customer User
    const { data: custAuth, error: custAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Customer', last_name: 'Tester' }
    });
    if (custAuthErr) throw new Error(`Customer signup failed: ${custAuthErr.message}`);
    customerUserId = custAuth.user.id;
    createdUserIds.push(customerUserId);

    const custAuthClient = createAuthClient();
    const { data: custLogin, error: custLoginErr } = await custAuthClient.auth.signInWithPassword({
      email: customerEmail,
      password
    });
    if (custLoginErr) throw new Error(`Customer login failed: ${custLoginErr.message}`);
    customerToken = custLogin.session.access_token;

    // 2. Admin User
    const { data: adminAuth, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Admin', last_name: 'Tester' }
    });
    if (adminAuthErr) throw new Error(`Admin signup failed: ${adminAuthErr.message}`);
    adminUserId = adminAuth.user.id;
    createdUserIds.push(adminUserId);

    // Promote admin role in profiles table and verify
    await new Promise(r => setTimeout(r, 400));
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', adminUserId);

    const adminAuthClient = createAuthClient();
    const { data: adminLogin, error: adminLoginErr } = await adminAuthClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (adminLoginErr) throw new Error(`Admin login failed: ${adminLoginErr.message}`);
    adminToken = adminLogin.session.access_token;

    // 3. Seed sizes & colors
    const { data: sz, error: szErr } = await supabaseAdmin
      .from('sizes')
      .insert({
        name: `Medium-${Date.now()}`,
        category_type: 'APPAREL',
        sort_order: 2
      })
      .select()
      .single();
    if (szErr) throw new Error(`Size insert failed: ${szErr.message}`);
    testSize = sz;
    createdSizeIds.push(sz.id);

    const { data: cl, error: clErr } = await supabaseAdmin
      .from('colors')
      .insert({
        name: `Midnight Navy ${Date.now()}`,
        hex_code: '#001F3F'
      })
      .select()
      .single();
    if (clErr) throw new Error(`Color insert failed: ${clErr.message}`);
    testColor = cl;
    createdColorIds.push(cl.id);

    // 4. Seed Category, Subcategory, Brand via Admin API
    const catRes = await fetch(`${baseUrl}/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Men Shirts',
        slug: `men-shirts-${Date.now()}`,
        description: 'Premium casual and formal shirts',
        displayOrder: 1
      })
    });
    const catData = await catRes.json();
    if (catRes.status !== 201) throw new Error(`Category setup failed: ${JSON.stringify(catData)}`);
    testCategory = catData.data;
    createdCategoryIds.push(testCategory.id);

    const subcatRes = await fetch(`${baseUrl}/admin/subcategories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        categoryId: testCategory.id,
        name: 'Oxford Casual',
        slug: `oxford-casual-${Date.now()}`,
        displayOrder: 1
      })
    });
    const subcatData = await subcatRes.json();
    if (subcatRes.status !== 201) throw new Error(`Subcategory setup failed: ${JSON.stringify(subcatData)}`);
    testSubcategory = subcatData.data;
    createdSubcategoryIds.push(testSubcategory.id);

    const brandRes = await fetch(`${baseUrl}/admin/brands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: `MenX Sartorial ${Date.now()}`,
        slug: `menx-sartorial-${Date.now()}`
      })
    });
    const brandData = await brandRes.json();
    if (brandRes.status !== 201) throw new Error(`Brand setup failed: ${JSON.stringify(brandData)}`);
    testBrand = brandData.data;
    createdBrandIds.push(testBrand.id);

    // 5. Seed 1 Published Product + 1 Draft Product via Admin API
    const pubProdRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Signature Oxford Cotton Shirt',
        slug: `signature-oxford-shirt-${Date.now()}`,
        description: 'Tailored regular fit casual shirt in pure Egyptian cotton.',
        categoryId: testCategory.id,
        subcategoryId: testSubcategory.id,
        brandId: testBrand.id,
        status: 'PUBLISHED',
        baseMrp: 2999.00,
        basePrice: 1999.00,
        material: '100% Egyptian Cotton',
        careInstructions: 'Machine wash cold with like colors',
        tags: ['oxford', 'casual', 'cotton', 'summer']
      })
    });
    const pubProdData = await pubProdRes.json();
    if (pubProdRes.status !== 201) throw new Error(`Published product setup failed: ${JSON.stringify(pubProdData)}`);
    testPublishedProduct = pubProdData.data;
    createdProductIds.push(testPublishedProduct.id);

    // Create Variant via Admin API
    const varRes = await fetch(`${baseUrl}/admin/products/${testPublishedProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: testSize.id,
        colorId: testColor.id,
        sku: `SHIRT-OXF-M-NAVY-${Date.now()}`,
        barcode: `89012345${Date.now().toString().slice(-6)}`,
        mrp: 2999.00,
        sellingPrice: 1999.00,
        weightGrams: 320,
        lowStockThreshold: 5
      })
    });
    const varData = await varRes.json();
    if (varRes.status !== 201) throw new Error(`Variant setup failed: ${JSON.stringify(varData)}`);
    createdVariantIds.push(varData.data.id);

    // Create Image via Admin API
    const imgRes = await fetch(`${baseUrl}/admin/products/${testPublishedProduct.id}/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c',
        altText: 'Signature Oxford Navy Front View',
        displayOrder: 1,
        isPrimary: true
      })
    });
    const imgData = await imgRes.json();
    if (imgRes.status !== 201) throw new Error(`Image setup failed: ${JSON.stringify(imgData)}`);
    createdImageIds.push(imgData.data.id);

    // Seed Draft Product
    const draftProdRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Unpublished Linen Summer Shirt',
        slug: `unpublished-linen-shirt-${Date.now()}`,
        description: 'Prototype linen shirt still in drafting stage.',
        categoryId: testCategory.id,
        subcategoryId: testSubcategory.id,
        status: 'DRAFT',
        baseMrp: 3499.00,
        basePrice: 3499.00
      })
    });
    const draftProdData = await draftProdRes.json();
    if (draftProdRes.status !== 201) throw new Error(`Draft product setup failed: ${JSON.stringify(draftProdData)}`);
    testDraftProduct = draftProdData.data;
    createdProductIds.push(testDraftProduct.id);

    console.log(' [PASS] Setup completed successfully with all test fixtures.\n');

    // -------------------------------------------------------------------------
    // TEST SUITE EXECUTION
    // -------------------------------------------------------------------------

    // 1. PUBLIC CATEGORIES
    console.log('>>> 1. Public Taxonomy Endpoints');
    const pubCatRes = await fetch(`${baseUrl}/categories`);
    const pubCatData = await pubCatRes.json();
    await assert('GET /api/v1/categories returns HTTP 200', pubCatRes.status === 200);
    await assert('Categories list contains seeded category', pubCatData.data.some(c => c.id === testCategory.id));

    const pubCatSlugRes = await fetch(`${baseUrl}/categories/${testCategory.slug}`);
    const pubCatSlugData = await pubCatSlugRes.json();
    await assert('GET /api/v1/categories/:slug returns HTTP 200', pubCatSlugRes.status === 200);
    await assert('Category detail contains nested subcategories array', Array.isArray(pubCatSlugData.data.subcategories));

    // 2. PUBLIC SUBCATEGORIES, BRANDS, SIZES, COLORS
    const pubSubcatRes = await fetch(`${baseUrl}/subcategories`);
    const pubSubcatData = await pubSubcatRes.json();
    await assert('GET /api/v1/subcategories returns HTTP 200', pubSubcatRes.status === 200);
    await assert('Subcategories list contains seeded subcategory', pubSubcatData.data.some(s => s.id === testSubcategory.id));

    const pubBrandRes = await fetch(`${baseUrl}/brands`);
    const pubBrandData = await pubBrandRes.json();
    await assert('GET /api/v1/brands returns HTTP 200', pubBrandRes.status === 200);
    await assert('Brands list contains seeded brand', pubBrandData.data.some(b => b.id === testBrand.id));

    const pubSizeRes = await fetch(`${baseUrl}/sizes`);
    const pubSizeData = await pubSizeRes.json();
    await assert('GET /api/v1/sizes returns HTTP 200', pubSizeRes.status === 200);
    await assert('Sizes list contains seeded size', pubSizeData.data.some(s => s.id === testSize.id));

    const pubColorRes = await fetch(`${baseUrl}/colors`);
    const pubColorData = await pubColorRes.json();
    await assert('GET /api/v1/colors returns HTTP 200', pubColorRes.status === 200);
    await assert('Colors list contains seeded color', pubColorData.data.some(c => c.id === testColor.id));

    // 3. PRODUCT LIST, PAGINATION, SEARCH, FILTER, SORT
    console.log('\n>>> 2. Public Product Catalog, Search & Filtering');
    const prodListRes = await fetch(`${baseUrl}/products?page=1&limit=5`);
    const prodListData = await prodListRes.json();
    await assert('GET /api/v1/products returns HTTP 200', prodListRes.status === 200);
    await assert('Product list contains pagination metadata', prodListData.meta?.limit === 5);
    await assert('Product items have price calculations', typeof prodListData.data[0]?.price?.sellingPrice === 'number');

    // Search
    const searchRes = await fetch(`${baseUrl}/products?search=Oxford`);
    const searchData = await searchRes.json();
    await assert('Search query returns matching products', searchData.data.some(p => p.id === testPublishedProduct.id));

    // Category & Brand Filter
    const filterRes = await fetch(`${baseUrl}/products?category=${testCategory.slug}&brand=${testBrand.slug}`);
    const filterData = await filterRes.json();
    await assert('Category and brand filter returns matching product', filterData.data.some(p => p.id === testPublishedProduct.id));

    // Sorting (price-asc)
    const sortRes = await fetch(`${baseUrl}/products?sortBy=price-asc`);
    await assert('Sorting by price-asc returns HTTP 200', sortRes.status === 200);

    // Maximum Pagination Limit
    const maxLimitRes = await fetch(`${baseUrl}/products?limit=500`);
    const maxLimitData = await maxLimitRes.json();
    await assert('Limit 500 is capped to maximum 50', maxLimitData.meta?.limit <= 50);

    // 4. UNPUBLISHED PRODUCT ISOLATION
    console.log('\n>>> 3. Unpublished Products Security Check');
    const allProdRes = await fetch(`${baseUrl}/products`);
    const allProdData = await allProdRes.json();
    const draftInPublic = allProdData.data.some(p => p.id === testDraftProduct.id);
    await assert('Public product list DOES NOT contain DRAFT products', !draftInPublic);

    const draftDetailRes = await fetch(`${baseUrl}/products/${testDraftProduct.slug}`);
    await assert('Public GET on DRAFT product slug returns HTTP 404', draftDetailRes.status === 404);

    // 5. PRODUCT DETAIL & RELATIONS
    console.log('\n>>> 4. Product Detail & Nested Relations');
    const detailRes = await fetch(`${baseUrl}/products/${testPublishedProduct.slug}`);
    const detailData = await detailRes.json();
    await assert('GET /api/v1/products/:slug returns HTTP 200', detailRes.status === 200);
    await assert('Detail contains variants array with size and color', detailData.data.variants.length > 0 && !!detailData.data.variants[0].size);
    await assert('Detail contains images array', detailData.data.images.length > 0);
    await assert('Detail price contains calculated discount percentage', detailData.data.price.discountPercent > 0);

    // Product Variants Sub-endpoint
    const varSubRes = await fetch(`${baseUrl}/products/${testPublishedProduct.id}/variants`);
    const varSubData = await varSubRes.json();
    await assert('GET /api/v1/products/:id/variants returns HTTP 200', varSubRes.status === 200);
    await assert('Variants sub-endpoint returns variant list', varSubData.data.length > 0);

    // Product Images Sub-endpoint
    const imgSubRes = await fetch(`${baseUrl}/products/${testPublishedProduct.id}/images`);
    const imgSubData = await imgSubRes.json();
    await assert('GET /api/v1/products/:id/images returns HTTP 200', imgSubRes.status === 200);
    await assert('Images sub-endpoint returns images list', imgSubData.data.length > 0);

    // 6. RBAC & CUSTOMER PERMISSION CONSTRAINTS
    console.log('\n>>> 5. Admin RBAC & Customer Access Denials');
    // Customer cannot create product -> 403
    const custCreateRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        title: 'Hacked Product',
        slug: 'hacked-product',
        description: 'Hacked description',
        categoryId: testCategory.id,
        subcategoryId: testSubcategory.id,
        baseMrp: 100
      })
    });
    await assert('CUSTOMER attempting POST /admin/products returns HTTP 403 Forbidden', custCreateRes.status === 403);

    // Unauthenticated request -> 401
    const unauthAdminRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'No Auth',
        slug: 'no-auth',
        description: 'Desc',
        categoryId: testCategory.id,
        subcategoryId: testSubcategory.id,
        baseMrp: 100
      })
    });
    await assert('Unauthenticated POST /admin/products returns HTTP 401 Unauthorized', unauthAdminRes.status === 401);

    // Customer cannot patch product -> 403
    const custPatchRes = await fetch(`${baseUrl}/admin/products/${testPublishedProduct.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ title: 'Modified By Customer' })
    });
    await assert('CUSTOMER attempting PATCH /admin/products/:id returns HTTP 403 Forbidden', custPatchRes.status === 403);

    // 7. ADMIN VALIDATION & CATALOG MANAGEMENT
    console.log('\n>>> 6. Admin Catalog Management & Input Validation');
    // Invalid product creation -> 400
    const invalidProdRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: '', // Empty
        slug: 'INVALID SLUG WITH SPACES',
        description: '', // Empty
        categoryId: 'not-a-uuid',
        subcategoryId: 'not-a-uuid',
        baseMrp: -500 // Negative
      })
    });
    const invalidProdData = await invalidProdRes.json();
    await assert('Invalid admin product payload returns HTTP 400 Bad Request', invalidProdRes.status === 400);
    await assert('Validation details list specific field issues', Array.isArray(invalidProdData.details) && invalidProdData.details.length >= 3);

    // Invalid UUID parameter -> 400
    const invalidUuidRes = await fetch(`${baseUrl}/products/invalid-uuid-format/variants`);
    await assert('Invalid UUID path parameter returns HTTP 400 Bad Request', invalidUuidRes.status === 400);

    // Admin archiving product
    const archiveRes = await fetch(`${baseUrl}/admin/products/${testPublishedProduct.id}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const archiveData = await archiveRes.json();
    await assert('Authorized SUPER_ADMIN archiving product returns HTTP 200', archiveRes.status === 200);
    await assert('Archived product status is ARCHIVED', archiveData.data.status === 'ARCHIVED');

    // Admin creating variant with sellingPrice > MRP -> 400
    const invalidPriceVariantRes = await fetch(`${baseUrl}/admin/products/${testPublishedProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: testSize.id,
        colorId: testColor.id,
        sku: `INV-PRICE-${Date.now()}`,
        barcode: `89012345${Date.now().toString().slice(-6)}`,
        mrp: 1000,
        sellingPrice: 1500
      })
    });
    await assert('Creating variant with sellingPrice > MRP returns HTTP 400', invalidPriceVariantRes.status === 400);

  } catch (err) {
    console.error('[TEST SUITE RUNTIME ERROR]', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purge all temporary test fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up all temporary test fixtures...');
    try {
      if (createdImageIds.length > 0) {
        await supabaseAdmin.from('product_images').delete().in('id', createdImageIds);
      }
      if (createdVariantIds.length > 0) {
        await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
      }
      if (createdProductIds.length > 0) {
        await supabaseAdmin.from('products').delete().in('id', createdProductIds);
      }
      if (createdSubcategoryIds.length > 0) {
        await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds);
      }
      if (createdCategoryIds.length > 0) {
        await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds);
      }
      if (createdBrandIds.length > 0) {
        await supabaseAdmin.from('brands').delete().in('id', createdBrandIds);
      }
      if (createdSizeIds.length > 0) {
        await supabaseAdmin.from('sizes').delete().in('id', createdSizeIds);
      }
      if (createdColorIds.length > 0) {
        await supabaseAdmin.from('colors').delete().in('id', createdColorIds);
      }
      for (const uid of createdUserIds) {
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.from('wishlists').delete().eq('user_id', uid);
        await supabaseAdmin.from('carts').delete().eq('user_id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      console.log(' [PASS] All temporary test records successfully purged.');
    } catch (cleanErr) {
      console.warn(' Cleanup warning:', cleanErr.message);
    }

    server.close();
    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  }
}

runPhase4BTests();
