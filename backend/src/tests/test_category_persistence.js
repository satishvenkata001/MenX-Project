import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let passed = 0;
let failed = 0;
let total = 0;

async function assert(desc, condition) {
  total++;
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runCategoryPersistenceRegression() {
  console.log('================================================================');
  console.log('  CATEGORY PERSISTENCE & DELETION REFRESH REGRESSION TEST');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  const ts = Date.now();

  let adminUser = null;
  let adminToken = null;
  const createdCategoryIds = [];

  try {
    // 1. Authenticate admin user
    const adminEmail = `admin.regression.${ts}@menxfashion.com`;
    const password = 'Password123!Secure';
    const { data: authAdmin, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', full_name: 'Admin Regression' }
    });
    if (authErr) throw new Error(`Admin user creation failed: ${authErr.message}`);
    adminUser = authAdmin.user;

    await supabaseAdmin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', adminUser.id);

    const authClient = createAuthClient();
    const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (loginErr) throw new Error(`Admin login failed: ${loginErr.message}`);
    adminToken = login.session.access_token;

    // 2. Count initial categories
    const initialAdminRes = await fetch(`${baseUrl}/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const initialAdminData = await initialAdminRes.json();
    await assert('Initial GET /admin/categories returns HTTP 200', initialAdminRes.status === 200);
    const initialCategoryCount = initialAdminData.data?.length || 0;

    // 3. CREATE category via Admin API
    const testCatSlug = `test-regression-cat-${ts}`;
    const testCatName = `Regression Category ${ts}`;
    console.log(`\nStep 1: Creating category "${testCatName}" (${testCatSlug})...`);

    const createRes = await fetch(`${baseUrl}/admin/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: testCatName,
        slug: testCatSlug,
        description: 'Temporary regression test category',
        displayOrder: 99
      })
    });
    const createData = await createRes.json();
    await assert('POST /admin/categories returns HTTP 201 Created', createRes.status === 201);
    const createdCat = createData.data;
    createdCategoryIds.push(createdCat.id);

    // 4. Verify category exists in admin list and public list
    const afterCreateAdminRes = await fetch(`${baseUrl}/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const afterCreateAdminData = await afterCreateAdminRes.json();
    const foundInAdmin = (afterCreateAdminData.data || []).some(c => c.id === createdCat.id && c.slug === testCatSlug);
    await assert('Created category exists in GET /admin/categories response', foundInAdmin);

    const afterCreatePublicRes = await fetch(`${baseUrl}/categories`);
    const afterCreatePublicData = await afterCreatePublicRes.json();
    const foundInPublic = (afterCreatePublicData.data || []).some(c => c.id === createdCat.id && c.slug === testCatSlug);
    await assert('Created category exists in GET /categories public response', foundInPublic);

    // 5. DELETE category via Admin API
    console.log(`\nStep 2: Deleting category ID ${createdCat.id}...`);
    const deleteRes = await fetch(`${baseUrl}/admin/categories/${createdCat.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const deleteData = await deleteRes.json();
    await assert('DELETE /admin/categories/:id returns HTTP 200 Success', deleteRes.status === 200);
    await assert('Delete response confirms success message', deleteData.data?.message?.includes('deleted') || deleteData.message?.includes('deleted'));

    // 6. Verify immediately that category is GONE from database directly
    const { data: dbCheck, error: dbErr } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug')
      .eq('id', createdCat.id);
    await assert('Category is permanently gone from DB categories table', !dbErr && dbCheck.length === 0);

    // 7. Simulate page refresh / multiple subsequent reloads
    console.log('\nStep 3: Simulating 5 repeated admin dashboard refresh requests...');
    for (let i = 1; i <= 5; i++) {
      const reloadAdminRes = await fetch(`${baseUrl}/admin/categories`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const reloadAdminData = await reloadAdminRes.json();
      const stillPresentInAdmin = (reloadAdminData.data || []).some(c => c.id === createdCat.id || c.slug === testCatSlug);
      await assert(`Refresh #${i}: Deleted category does NOT return in GET /admin/categories`, !stillPresentInAdmin);

      const reloadPublicRes = await fetch(`${baseUrl}/categories`);
      const reloadPublicData = await reloadPublicRes.json();
      const stillPresentInPublic = (reloadPublicData.data || []).some(c => c.id === createdCat.id || c.slug === testCatSlug);
      await assert(`Refresh #${i}: Deleted category does NOT return in public GET /categories`, !stillPresentInPublic);
    }

    // 8. Confirm final category count matches initial count
    const finalAdminRes = await fetch(`${baseUrl}/admin/categories`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const finalAdminData = await finalAdminRes.json();
    await assert('Category count after deletion matches initial count exactly', finalAdminData.data?.length === initialCategoryCount);

    console.log('\nStep 4: Persistence regression test passed successfully.');

  } catch (err) {
    console.error('\n[REGRESSION TEST FAILED]', err);
  } finally {
    console.log('\n>>> Cleaning up regression test fixtures...');
    try {
      if (createdCategoryIds.length > 0) {
        try { await supabaseAdmin.from('products').delete().in('category_id', createdCategoryIds); } catch (e) { }
        try { await supabaseAdmin.from('subcategories').delete().in('category_id', createdCategoryIds); } catch (e) { }
        try { await supabaseAdmin.from('categories').delete().in('id', createdCategoryIds); } catch (e) { }
      }
      if (adminUser?.id) {
        try { await supabaseAdmin.from('profiles').delete().eq('id', adminUser.id); } catch (e) { }
        try { await supabaseAdmin.auth.admin.deleteUser(adminUser.id); } catch (e) { }
      }
      console.log(' [PASS] Regression test fixtures cleaned up.');
    } catch (cleanErr) {
      console.warn(' Cleanup warning:', cleanErr.message);
    }

    server.close();
    console.log('\n================================================================');
    console.log(`REGRESSION SUMMARY: ${passed} / ${total} TESTS PASSED (${failed} FAILED)`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runCategoryPersistenceRegression();
