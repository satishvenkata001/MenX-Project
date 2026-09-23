import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runCompleteTestSuite() {
  console.log('================================================================');
  console.log('    MENX: PRODUCT STATUS & CATALOGUE FLOW TEST SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  let passedTests = 0;
  let totalTests = 0;

  function assert(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(` [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(` [FAIL] ${name} — ${details}`);
    }
  }

  const createdUserIds = [];
  const createdProductIds = [];

  try {
    const ts = Date.now();
    const password = 'Password123!Secure';

    // Helper to create test user with role
    async function createTestUser(email, role) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: 'Test', last_name: role }
      });
      if (error) throw error;
      const userId = data.user.id;
      createdUserIds.push(userId);

      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        email,
        first_name: 'Test',
        last_name: role,
        phone: '9876543210',
        role,
        is_active: true
      });

      const authClient = createAuthClient();
      const { data: loginData, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw loginErr;
      return { userId, token: loginData.session.access_token };
    }

    console.log('>>> 1. Creating Admin, Manager & Customer Test Users...');
    const superAdmin = await createTestUser(`sa.${ts}@menx.com`, 'SUPER_ADMIN');
    const invManager = await createTestUser(`im.${ts}@menx.com`, 'INVENTORY_MANAGER');
    const storeManager = await createTestUser(`sm.${ts}@menx.com`, 'STORE_MANAGER');
    const customerUser = await createTestUser(`cust.${ts}@menx.com`, 'CUSTOMER');
    assert('Admin, manager, and customer test users created', true);

    // Fetch fixtures: category, subcategory, brand, size, color
    const { data: cat } = await supabaseAdmin.from('categories').select('id, name, slug').eq('slug', 'shirts').eq('is_active', true).limit(1).single();
    const { data: sub } = await supabaseAdmin.from('subcategories').select('id, name, slug').eq('category_id', cat.id).eq('is_active', true).limit(1).single();
    const { data: brand } = await supabaseAdmin.from('brands').select('id, name, slug').eq('is_active', true).limit(1).single();
    const { data: size } = await supabaseAdmin.from('sizes').select('id, name').eq('name', 'M').limit(1).single();
    const { data: color } = await supabaseAdmin.from('colors').select('id, name').limit(1).single();

    console.log(`\n>>> Fixtures: Cat="${cat.name}", Sub="${sub.name}", Brand="${brand.name}", Size="${size?.name}"`);

    // -------------------------------------------------------------------------
    // TEST A: CREATE PRODUCT (Status = DRAFT)
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Testing CREATE PRODUCT with Status = DRAFT...');
    const slugA = `test-draft-prod-${ts}`;
    const createResA = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        title: `Test Draft Product ${ts}`,
        slug: slugA,
        description: 'Detailed description for test draft product',
        categoryId: cat.id,
        subcategoryId: sub.id,
        brandId: brand.id,
        baseMrp: 2999.00,
        basePrice: 1999.00,
        material: '100% Organic Linen',
        careInstructions: 'Machine wash cold',
        tags: ['linen', 'summer', 'draft'],
        isFeatured: false,
        status: 'DRAFT'
      })
    });

    const createDataA = await createResA.json();
    assert('POST /admin/products with status DRAFT returns HTTP 201', createResA.status === 201, JSON.stringify(createDataA));
    assert('Created product response contains ID', Boolean(createDataA.data?.id));
    assert('Created product has status DRAFT', createDataA.data?.status === 'DRAFT');
    assert('Created product has material saved', createDataA.data?.material === '100% Organic Linen');
    const prodAId = createDataA.data?.id;
    if (prodAId) createdProductIds.push(prodAId);

    // -------------------------------------------------------------------------
    // TEST SECURITY: status=ALL & DRAFT ISOLATION CHECKS
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Testing status=ALL & Role Security Enforcement...');
    // 1. Authorized Admin/Manager with Bearer token can see DRAFT with status=ALL
    const adminCatalogRes = await fetch(`${baseUrl}/products?status=ALL&page=1&limit=50`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` }
    });
    const adminCatalogData = await adminCatalogRes.json();
    assert('Authorized Admin GET /products?status=ALL returns HTTP 200', adminCatalogRes.status === 200);
    const foundInAdmin = (adminCatalogData.data || []).find(p => p.id === prodAId);
    assert('DRAFT product is listed in Admin Catalog when authenticated as Super Admin', Boolean(foundInAdmin));
    assert('DRAFT product in Admin Catalog has DRAFT status badge', foundInAdmin?.status === 'DRAFT');

    // 2. Inventory Manager with Bearer token can see DRAFT with status=ALL
    const imCatalogRes = await fetch(`${baseUrl}/products?status=ALL&page=1&limit=50`, {
      headers: { Authorization: `Bearer ${invManager.token}` }
    });
    const imCatalogData = await imCatalogRes.json();
    const foundInIM = (imCatalogData.data || []).find(p => p.id === prodAId);
    assert('DRAFT product is listed in Admin Catalog when authenticated as Inventory Manager', Boolean(foundInIM));

    // 3. Unauthenticated guest GET /products?status=ALL -> MUST IGNORE status=ALL and return ONLY PUBLISHED
    const guestAllRes = await fetch(`${baseUrl}/products?status=ALL&page=1&limit=50`);
    const guestAllData = await guestAllRes.json();
    const foundInGuestAll = (guestAllData.data || []).find(p => p.id === prodAId);
    assert('Unauthenticated guest GET /products?status=ALL CANNOT see DRAFT product', !foundInGuestAll);

    // 4. Authenticated CUSTOMER GET /products?status=ALL -> MUST IGNORE status=ALL and return ONLY PUBLISHED
    const customerAllRes = await fetch(`${baseUrl}/products?status=ALL&page=1&limit=50`, {
      headers: { Authorization: `Bearer ${customerUser.token}` }
    });
    const customerAllData = await customerAllRes.json();
    const foundInCustAll = (customerAllData.data || []).find(p => p.id === prodAId);
    assert('Customer GET /products?status=ALL CANNOT see DRAFT product (status=ALL ignored for non-admins)', !foundInCustAll);

    // 5. Customer GET /products?status=DRAFT -> MUST IGNORE status=DRAFT and return ONLY PUBLISHED
    const customerDraftRes = await fetch(`${baseUrl}/products?status=DRAFT&page=1&limit=50`, {
      headers: { Authorization: `Bearer ${customerUser.token}` }
    });
    const customerDraftData = await customerDraftRes.json();
    const foundInCustDraft = (customerDraftData.data || []).find(p => p.id === prodAId);
    assert('Customer GET /products?status=DRAFT CANNOT see DRAFT product', !foundInCustDraft);

    // 6. Customer cannot access DRAFT product by slug directly (returns 404)
    const customerSlugRes = await fetch(`${baseUrl}/products/${slugA}`, {
      headers: { Authorization: `Bearer ${customerUser.token}` }
    });
    assert('Customer GET /products/:draftSlug returns HTTP 404', customerSlugRes.status === 404);

    // 7. Admin CAN access DRAFT product by slug directly (returns 200)
    const adminSlugRes = await fetch(`${baseUrl}/products/${slugA}`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` }
    });
    assert('Admin GET /products/:draftSlug returns HTTP 200', adminSlugRes.status === 200);

    // -------------------------------------------------------------------------
    // TEST B: EDIT PRODUCT (DRAFT -> PUBLISHED)
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing EDIT PRODUCT (DRAFT -> PUBLISHED)...');
    const editResB = await fetch(`${baseUrl}/admin/products/${prodAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        status: 'PUBLISHED',
        basePrice: 1799.00
      })
    });
    const editDataB = await editResB.json();
    assert('PATCH /admin/products/:id (DRAFT -> PUBLISHED) returns HTTP 200', editResB.status === 200, JSON.stringify(editDataB));
    assert('Product status updated to PUBLISHED in response', editDataB.data?.status === 'PUBLISHED');
    assert('Product basePrice updated in response', Number(editDataB.data?.base_price) === 1799);

    // Verify in customer storefront
    const customerStorefrontRes2 = await fetch(`${baseUrl}/products?page=1&limit=50`);
    const customerStorefrontData2 = await customerStorefrontRes2.json();
    const foundInStorefront2 = (customerStorefrontData2.data || []).find(p => p.id === prodAId);
    assert('PUBLISHED product IS now listed on public customer storefront', Boolean(foundInStorefront2));

    // Verify customer can access by slug
    const customerSlugRes2 = await fetch(`${baseUrl}/products/${slugA}`);
    const customerSlugData2 = await customerSlugRes2.json();
    assert('Public GET /products/:slug for PUBLISHED product returns HTTP 200', customerSlugRes2.status === 200);
    assert('Public product details match updated price', customerSlugData2.data?.price?.basePrice === 1799);

    // -------------------------------------------------------------------------
    // TEST C: EDIT PRODUCT (PUBLISHED -> ARCHIVED)
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing EDIT PRODUCT (PUBLISHED -> ARCHIVED)...');
    const editResC = await fetch(`${baseUrl}/admin/products/${prodAId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        status: 'ARCHIVED'
      })
    });
    const editDataC = await editResC.json();
    assert('PATCH /admin/products/:id (PUBLISHED -> ARCHIVED) returns HTTP 200', editResC.status === 200);
    assert('Product status updated to ARCHIVED', editDataC.data?.status === 'ARCHIVED');

    // Verify Admin Catalog shows ARCHIVED
    const adminCatalogRes3 = await fetch(`${baseUrl}/products?status=ALL&page=1&limit=50`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` }
    });
    const adminCatalogData3 = await adminCatalogRes3.json();
    const foundInAdmin3 = (adminCatalogData3.data || []).find(p => p.id === prodAId);
    assert('ARCHIVED product appears in Admin Catalog (status=ALL)', Boolean(foundInAdmin3));
    assert('ARCHIVED product has ARCHIVED status', foundInAdmin3?.status === 'ARCHIVED');

    // Verify customer storefront does NOT show ARCHIVED
    const customerStorefrontRes3 = await fetch(`${baseUrl}/products?page=1&limit=50`);
    const customerStorefrontData3 = await customerStorefrontRes3.json();
    const foundInStorefront3 = (customerStorefrontData3.data || []).find(p => p.id === prodAId);
    assert('ARCHIVED product is NOT visible in public customer storefront', !foundInStorefront3);

    // Verify customer slug returns 404
    const customerSlugRes3 = await fetch(`${baseUrl}/products/${slugA}`);
    assert('Public GET /products/:slug for ARCHIVED product returns HTTP 404', customerSlugRes3.status === 404);

    // -------------------------------------------------------------------------
    // TEST D: INVENTORY MANAGER & STORE MANAGER CREATE & VARIANT FLOW
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Testing INVENTORY_MANAGER & STORE_MANAGER Creation...');
    const slugIM = `im-prod-${ts}`;
    const createResIM = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invManager.token}`
      },
      body: JSON.stringify({
        title: `IM Product ${ts}`,
        slug: slugIM,
        description: 'Created by Inventory Manager',
        categoryId: cat.id,
        subcategoryId: sub.id,
        brandId: brand.id,
        baseMrp: 1499.00,
        basePrice: 1199.00,
        status: 'PUBLISHED'
      })
    });
    const createDataIM = await createResIM.json();
    assert('INVENTORY_MANAGER creates product successfully (HTTP 201)', createResIM.status === 201, JSON.stringify(createDataIM));
    const prodIMId = createDataIM.data?.id;
    if (prodIMId) createdProductIds.push(prodIMId);

    // Add variant to this product
    const variantRes = await fetch(`${baseUrl}/admin/products/${prodIMId}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invManager.token}`
      },
      body: JSON.stringify({
        sizeId: size.id,
        colorId: color.id,
        sku: `SKU-${ts}-M-NAVY`,
        barcode: `BAR-${ts}-001`,
        mrp: 1499.00,
        sellingPrice: 1199.00,
        initialStock: 25
      })
    });
    const variantData = await variantRes.json();
    assert('INVENTORY_MANAGER creates variant with initial stock (HTTP 201)', variantRes.status === 201, JSON.stringify(variantData));

    // Verify stock movement and inventory count
    const { data: invItem } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available, quantity_reserved')
      .eq('variant_id', variantData.data?.id)
      .single();
    assert('Inventory item created with initialStock = 25', invItem?.quantity_available === 25 && invItem?.quantity_reserved === 0);

    // Test STORE_MANAGER can create product
    const slugSM = `sm-prod-${ts}`;
    const createResSM = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${storeManager.token}`
      },
      body: JSON.stringify({
        title: `SM Product ${ts}`,
        slug: slugSM,
        description: 'Created by Store Manager',
        categoryId: cat.id,
        subcategoryId: sub.id,
        brandId: brand.id,
        baseMrp: 1899.00,
        basePrice: 1499.00,
        status: 'PUBLISHED'
      })
    });
    assert('STORE_MANAGER creates product successfully (HTTP 201)', createResSM.status === 201);
    const prodSMData = await createResSM.json();
    if (prodSMData.data?.id) createdProductIds.push(prodSMData.data.id);

    // -------------------------------------------------------------------------
    // TEST E: UNAUTHORIZED ROLES ARE BLOCKED (RBAC & RLS)
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Testing Unauthorized Roles Blocked (CUSTOMER & Unauthenticated)...');
    const custCreateRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerUser.token}`
      },
      body: JSON.stringify({
        title: 'Customer Product Attempt',
        slug: `cust-prod-${ts}`,
        description: 'Should be blocked',
        categoryId: cat.id,
        subcategoryId: sub.id,
        baseMrp: 1000
      })
    });
    assert('CUSTOMER role attempting product creation is BLOCKED (HTTP 403)', custCreateRes.status === 403);

    const unauthCreateRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Product Attempt',
        slug: `unauth-prod-${ts}`,
        description: 'Should be blocked',
        categoryId: cat.id,
        subcategoryId: sub.id,
        baseMrp: 1000
      })
    });
    assert('Unauthenticated client attempting product creation is BLOCKED (HTTP 401)', unauthCreateRes.status === 401);

    // -------------------------------------------------------------------------
    // TEST F: VALIDATION ERROR HANDLING
    // -------------------------------------------------------------------------
    console.log('\n>>> 8. Testing Backend Validation & Clean Error Responses...');
    // Duplicate slug
    const dupSlugRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        title: 'Duplicate Slug Product',
        slug: slugIM,
        description: 'Should fail with 409 conflict',
        categoryId: cat.id,
        subcategoryId: sub.id,
        baseMrp: 1000
      })
    });
    assert('Duplicate slug creation returns HTTP 409 Conflict', dupSlugRes.status === 409);

    // Selling price > MRP
    const priceErrRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        title: 'Invalid Price Product',
        slug: `invalid-price-${ts}`,
        description: 'Should fail because price > MRP',
        categoryId: cat.id,
        subcategoryId: sub.id,
        baseMrp: 1000,
        basePrice: 1500
      })
    });
    assert('Selling price > MRP returns HTTP 400 Bad Request', priceErrRes.status === 400);

    // Invalid Status
    const statusErrRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        title: 'Invalid Status Product',
        slug: `invalid-status-${ts}`,
        description: 'Should fail because status is invalid',
        categoryId: cat.id,
        subcategoryId: sub.id,
        baseMrp: 1000,
        status: 'NON_EXISTENT_STATUS'
      })
    });
    assert('Invalid status value returns HTTP 400 Bad Request', statusErrRes.status === 400);

    // Inactive / non-existent category
    const catErrRes = await fetch(`${baseUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`
      },
      body: JSON.stringify({
        title: 'Invalid Cat Product',
        slug: `invalid-cat-${ts}`,
        description: 'Should fail with bad request',
        categoryId: '00000000-0000-0000-0000-000000000000',
        subcategoryId: sub.id,
        baseMrp: 1000
      })
    });
    assert('Non-existent category returns HTTP 400 Bad Request', catErrRes.status === 400);

  } finally {
    console.log('\n>>> Cleaning up test fixtures...');
    for (const pid of createdProductIds) {
      await supabaseAdmin.from('products').delete().eq('id', pid);
    }
    for (const uid of createdUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    console.log('\n✅ ALL PRODUCT STATUS & CATALOGUE FLOW TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runCompleteTestSuite().catch(err => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
