import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { pool } from '../config/db.js';

let server;
let baseUrl;

// Fixtures tracked for cleanup
const createdBrandIds = [];
const createdCategoryIds = [];
const createdSubcategoryIds = [];
const createdProductIds = [];
const createdVariantIds = [];
const createdUserIds = [];

const ts = Date.now();
const adminEmail = `brand_crud_admin_${ts}@menx.com`;
const password = 'Password123!';
let adminToken;
let testColor;
let testSize;

function assert(condition, message) {
  if (!condition) {
    console.error(` [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(` [PASS] ${message}`);
}

async function apiRequest(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  console.log('================================================================');
  console.log('         MENX COMPLETE BRAND MANAGEMENT CRUD TEST SUITE');
  console.log('================================================================');

  // Start test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      console.log(`[TEST SERVER] Running on port ${port}`);
      resolve();
    });
  });

  try {
    // 1. Setup Admin Account
    console.log('\n>>> 1. Initializing Super Admin User & Master Fixtures...');
    const { data: adminAuthData, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Brand', last_name: 'Admin' }
    });
    if (adminAuthErr) throw new Error(`Failed to create admin user: ${adminAuthErr.message}`);
    const adminUserId = adminAuthData.user.id;
    createdUserIds.push(adminUserId);

    await supabaseAdmin
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', adminUserId);

    const authClient = createAuthClient();
    const { data: adminLogin, error: loginErr } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (loginErr) throw new Error(`Admin login failed: ${loginErr.message}`);
    adminToken = adminLogin.session.access_token;
    console.log(' [PASS] Super Admin authenticated successfully');

    // Load master color & size
    const { data: color } = await supabaseAdmin.from('colors').select('id, name').limit(1).single();
    testColor = color;
    const { data: size } = await supabaseAdmin.from('sizes').select('id, name, category_type').limit(1).single();
    testSize = size;

    // Verify baseline production brands exist
    console.log('\n>>> 2. Verifying Baseline Production Brands...');
    const baseListRes = await apiRequest('GET', '/admin/brands', null, adminToken);
    assert(baseListRes.status === 200, 'GET /admin/brands returned 200 OK');
    const baseBrands = baseListRes.data.data;
    assert(Array.isArray(baseBrands), 'Returned brands is an array');
    
    const aeroFit = baseBrands.find(b => b.name === 'AeroFit Sport');
    const luxClassics = baseBrands.find(b => b.name === 'Lux Classics');
    const menxSartorial = baseBrands.find(b => b.name === 'MenX Sartorial');
    assert(!!aeroFit, 'Production brand AeroFit Sport is present');
    assert(!!luxClassics, 'Production brand Lux Classics is present');
    assert(!!menxSartorial, 'Production brand MenX Sartorial is present');
    assert(aeroFit.product_count >= 1, `AeroFit Sport has valid product_count (${aeroFit.product_count})`);

    // Verify active brands first sorting
    for (let i = 0; i < baseBrands.length - 1; i++) {
      if (!baseBrands[i].is_active && baseBrands[i+1].is_active) {
        throw new Error('Sorting violation: inactive brand listed before active brand');
      }
    }
    console.log(' [PASS] Baseline brands verified and active-first sort confirmed');

    // 3. Create Brand
    console.log('\n>>> 3. Testing Create Brand (POST /admin/brands)...');
    const testBrandName = `Urban Edge Test ${ts}`;
    const testBrandSlug = `urban-edge-test-${ts}`;
    const testBrandDesc = 'Contemporary urban lifestyle brand';
    const createRes = await apiRequest('POST', '/admin/brands', {
      name: testBrandName,
      slug: testBrandSlug,
      description: testBrandDesc,
      isActive: true
    }, adminToken);

    assert(createRes.status === 201, `POST /admin/brands created brand (status ${createRes.status})`);
    const createdBrand = createRes.data.data;
    assert(createdBrand && createdBrand.id, 'Created brand has valid ID');
    assert(createdBrand.name === testBrandName, 'Created brand name matches');
    assert(createdBrand.slug === testBrandSlug, 'Created brand slug matches');
    assert(createdBrand.description === testBrandDesc, 'Created brand description matches');
    assert(createdBrand.is_active === true, 'Created brand is_active is true');
    createdBrandIds.push(createdBrand.id);

    // 4. Read / Verify Created Brand in Admin List
    console.log('\n>>> 4. Testing Read Brand in Admin List (GET /admin/brands)...');
    const listAfterCreate = await apiRequest('GET', '/admin/brands', null, adminToken);
    assert(listAfterCreate.status === 200, 'GET /admin/brands returned 200');
    const foundBrand = listAfterCreate.data.data.find(b => b.id === createdBrand.id);
    assert(!!foundBrand, 'Created brand found in admin list');
    assert(foundBrand.product_count === 0, `New brand has product_count === 0 (got ${foundBrand.product_count})`);

    // 5. Reject Duplicate Brand Name
    console.log('\n>>> 5. Testing Duplicate Brand Name Rejection...');
    const dupNameRes = await apiRequest('POST', '/admin/brands', {
      name: testBrandName.toUpperCase(), // case-insensitive check
      slug: `unique-slug-${ts}`,
      description: 'Another brand'
    }, adminToken);
    assert(dupNameRes.status === 409 || dupNameRes.status === 400, `Duplicate brand name rejected with status ${dupNameRes.status}`);

    // 6. Reject Duplicate Brand Slug
    console.log('\n>>> 6. Testing Duplicate Brand Slug Rejection...');
    const dupSlugRes = await apiRequest('POST', '/admin/brands', {
      name: `Different Name ${ts}`,
      slug: testBrandSlug,
      description: 'Another brand'
    }, adminToken);
    assert(dupSlugRes.status === 409 || dupSlugRes.status === 400, `Duplicate brand slug rejected with status ${dupSlugRes.status}`);

    // 7. Edit Brand
    console.log('\n>>> 7. Testing Edit Brand (PATCH /admin/brands/:id)...');
    const updatedBrandName = `Urban Edge Premium ${ts}`;
    const updatedBrandSlug = `urban-edge-premium-${ts}`;
    const updatedBrandDesc = 'Premium updated description';
    const editRes = await apiRequest('PATCH', `/admin/brands/${createdBrand.id}`, {
      name: updatedBrandName,
      slug: updatedBrandSlug,
      description: updatedBrandDesc,
      isActive: true
    }, adminToken);

    assert(editRes.status === 200, `PATCH /admin/brands/:id updated brand (status ${editRes.status})`);
    const updatedBrand = editRes.data.data;
    assert(updatedBrand.name === updatedBrandName, 'Brand name updated');
    assert(updatedBrand.slug === updatedBrandSlug, 'Brand slug updated');
    assert(updatedBrand.description === updatedBrandDesc, 'Brand description updated');

    // 8. Verify Edited Data Persists in Database & Admin List
    console.log('\n>>> 8. Verifying Edited Data Persistence...');
    const listAfterEdit = await apiRequest('GET', '/admin/brands', null, adminToken);
    const foundEdited = listAfterEdit.data.data.find(b => b.id === createdBrand.id);
    assert(foundEdited.name === updatedBrandName, 'Persisted name matches edit');
    assert(foundEdited.slug === updatedBrandSlug, 'Persisted slug matches edit');
    assert(foundEdited.description === updatedBrandDesc, 'Persisted description matches edit');

    // 9. Delete Unused Brand
    console.log('\n>>> 9. Testing Delete Unused Brand (DELETE /admin/brands/:id)...');
    const deleteUnusedRes = await apiRequest('DELETE', `/admin/brands/${createdBrand.id}`, null, adminToken);
    assert(deleteUnusedRes.status === 200, `DELETE /admin/brands/:id returned 200 for unused brand`);
    
    // Verify brand is gone
    const listAfterDelete = await apiRequest('GET', '/admin/brands', null, adminToken);
    const foundDeleted = listAfterDelete.data.data.find(b => b.id === createdBrand.id);
    assert(!foundDeleted, 'Unused brand successfully removed from database');
    // Remove from tracking since already deleted
    const brandIdx = createdBrandIds.indexOf(createdBrand.id);
    if (brandIdx > -1) createdBrandIds.splice(brandIdx, 1);

    // 10. Prevent Deletion of Brand Referenced by Products
    console.log('\n>>> 10. Testing Prevent Deletion of Brand Referenced by Products...');
    // Create new test brand
    const refBrandName = `Referenced Brand Test ${ts}`;
    const refBrandSlug = `referenced-brand-test-${ts}`;
    const refBrandRes = await apiRequest('POST', '/admin/brands', {
      name: refBrandName,
      slug: refBrandSlug,
      description: 'Brand referenced by products'
    }, adminToken);
    assert(refBrandRes.status === 201, 'Created referenced brand fixture');
    const refBrand = refBrandRes.data.data;
    createdBrandIds.push(refBrand.id);

    // Create test category and subcategory
    const catRes = await apiRequest('POST', '/admin/categories', {
      name: `Brand Test Cat ${ts}`,
      slug: `brand-test-cat-${ts}`,
      displayOrder: 99
    }, adminToken);
    const testCategory = catRes.data.data;
    createdCategoryIds.push(testCategory.id);

    const subRes = await apiRequest('POST', '/admin/subcategories', {
      categoryId: testCategory.id,
      name: `Brand Test Subcat ${ts}`,
      slug: `brand-test-subcat-${ts}`,
      displayOrder: 1
    }, adminToken);
    const testSubcategory = subRes.data.data;
    createdSubcategoryIds.push(testSubcategory.id);

    // Create test product linked to this brand
    const prodRes = await apiRequest('POST', '/admin/products', {
      title: `Brand Linked Product ${ts}`,
      slug: `brand-linked-prod-${ts}`,
      description: 'Product linked to brand',
      categoryId: testCategory.id,
      subcategoryId: testSubcategory.id,
      brandId: refBrand.id,
      baseMrp: 1999,
      basePrice: 1499,
      status: 'PUBLISHED'
    }, adminToken);
    assert(prodRes.status === 201, 'Created product linked to brand');
    const testProduct = prodRes.data.data;
    createdProductIds.push(testProduct.id);

    // Verify brand product_count is now 1
    const listWithProduct = await apiRequest('GET', '/admin/brands', null, adminToken);
    const refBrandInList = listWithProduct.data.data.find(b => b.id === refBrand.id);
    assert(refBrandInList.product_count === 1, `Brand product_count accurately reflects 1 product (got ${refBrandInList.product_count})`);

    // Attempt to DELETE referenced brand -> MUST BE REJECTED!
    const deleteRefRes = await apiRequest('DELETE', `/admin/brands/${refBrand.id}`, null, adminToken);
    assert(deleteRefRes.status === 400 || deleteRefRes.status === 409, `DELETE referenced brand rejected with status ${deleteRefRes.status}`);
    const errorMsg = deleteRefRes.data?.message || '';
    assert(
      errorMsg.toLowerCase().includes('cannot delete') && errorMsg.toLowerCase().includes('deactivate'),
      `Error message guides user to deactivate instead: "${errorMsg}"`
    );

    // Verify brand STILL EXISTS in database
    const verifyStillExists = await apiRequest('GET', '/admin/brands', null, adminToken);
    const brandStillThere = verifyStillExists.data.data.find(b => b.id === refBrand.id);
    assert(!!brandStillThere, 'Brand was safely protected from destructive deletion');

    // 11. Deactivate Referenced Brand
    console.log('\n>>> 11. Testing Deactivate Referenced Brand (PATCH /admin/brands/:id)...');
    const deactivateRes = await apiRequest('PATCH', `/admin/brands/${refBrand.id}`, {
      isActive: false
    }, adminToken);
    assert(deactivateRes.status === 200, `Deactivated brand successfully (status ${deactivateRes.status})`);
    assert(deactivateRes.data.data.is_active === false, 'Brand is_active is now false');

    // 12. Verify Product Catalog Brand Dropdown (Public vs Inactive)
    console.log('\n>>> 12. Verifying Public Brand Catalog (GET /brands)...');
    const publicBrandsRes = await apiRequest('GET', '/brands');
    assert(publicBrandsRes.status === 200, 'GET /brands returned 200 OK');
    const publicBrands = publicBrandsRes.data.data;
    const inactiveInPublic = publicBrands.find(b => b.id === refBrand.id);
    assert(!inactiveInPublic, 'Inactive brand is NOT present in public /brands endpoint');
    const aeroInPublic = publicBrands.find(b => b.name === 'AeroFit Sport');
    assert(!!aeroInPublic, 'Active brand AeroFit Sport IS present in public /brands');

    // 13. Verify Product Details for Existing Product using Inactive Brand
    console.log('\n>>> 13. Verifying Existing Product using Inactive Brand displays correctly...');
    const prodDetailRes = await apiRequest('GET', `/products/${testProduct.slug}`);
    assert(prodDetailRes.status === 200, 'GET /products/:slug returned 200');
    assert(
      prodDetailRes.data.data.brand_id === refBrand.id || prodDetailRes.data.data.brand?.name === refBrandName,
      'Product brand reference remains completely intact'
    );

    // 14. Verify Production Brands and Products Unchanged
    console.log('\n>>> 14. Verifying Production Brands and Catalog Preservation...');
    const finalBrandsRes = await apiRequest('GET', '/admin/brands', null, adminToken);
    const finalBrands = finalBrandsRes.data.data;
    assert(finalBrands.some(b => b.name === 'AeroFit Sport'), 'AeroFit Sport preserved');
    assert(finalBrands.some(b => b.name === 'Lux Classics'), 'Lux Classics preserved');
    assert(finalBrands.some(b => b.name === 'MenX Sartorial'), 'MenX Sartorial preserved');

    console.log('\n================================================================');
    console.log('  ALL BRAND MANAGEMENT CRUD TEST ASSERTIONS PASSED (14/14) ✅');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ BRAND CRUD TEST SUITE FAILED:', err);
    throw err;
  } finally {
    console.log('>>> Cleaning up test fixtures in finally block...');
    try {
      // 1. Delete created products
      if (createdProductIds.length > 0) {
        await pool.query('DELETE FROM product_images WHERE product_id = ANY($1)', [createdProductIds]);
        await pool.query('DELETE FROM product_variants WHERE product_id = ANY($1)', [createdProductIds]);
        await pool.query('DELETE FROM products WHERE id = ANY($1)', [createdProductIds]);
        console.log(` - Cleaned up ${createdProductIds.length} test products`);
      }

      // 2. Delete created subcategories
      if (createdSubcategoryIds.length > 0) {
        await pool.query('DELETE FROM subcategories WHERE id = ANY($1)', [createdSubcategoryIds]);
        console.log(` - Cleaned up ${createdSubcategoryIds.length} test subcategories`);
      }

      // 3. Delete created categories
      if (createdCategoryIds.length > 0) {
        await pool.query('DELETE FROM categories WHERE id = ANY($1)', [createdCategoryIds]);
        console.log(` - Cleaned up ${createdCategoryIds.length} test categories`);
      }

      // 4. Delete created brands
      if (createdBrandIds.length > 0) {
        await pool.query('DELETE FROM brands WHERE id = ANY($1)', [createdBrandIds]);
        console.log(` - Cleaned up ${createdBrandIds.length} test brands`);
      }

      // 5. Delete created users
      for (const uid of createdUserIds) {
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      if (createdUserIds.length > 0) {
        console.log(` - Cleaned up ${createdUserIds.length} test admin users`);
      }
    } catch (cleanupErr) {
      console.error('Warning during test fixture cleanup:', cleanupErr.message);
    }

    if (server) {
      server.close();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
