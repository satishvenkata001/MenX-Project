import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { CatalogService } from '../services/catalog.service.js';
import http from 'http';
import app from '../app.js';

async function testFlow() {
  console.log('=== Testing Complete Product Creation Flow ===');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // 1. Get tokens for SUPER_ADMIN, INVENTORY_MANAGER, STORE_MANAGER
  const ts = Date.now();
  
  async function createTestUser(email, role) {
    const password = 'Password123!Secure';
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Test', last_name: role }
    });
    if (error) throw error;
    const userId = data.user.id;
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

  const superAdmin = await createTestUser(`superadmin.${ts}@menx.com`, 'SUPER_ADMIN');
  const invManager = await createTestUser(`invmgr.${ts}@menx.com`, 'INVENTORY_MANAGER');
  const storeMgr = await createTestUser(`storemgr.${ts}@menx.com`, 'STORE_MANAGER');

  // Get active category, subcategory, brand
  const { data: cat } = await supabaseAdmin.from('categories').select('id, name, slug').eq('is_active', true).limit(1).single();
  const { data: sub } = await supabaseAdmin.from('subcategories').select('id, name, slug').eq('category_id', cat.id).eq('is_active', true).limit(1).single();
  const { data: brand } = await supabaseAdmin.from('brands').select('id, name, slug').eq('is_active', true).limit(1).single();

  console.log('Using fixtures:', { cat: cat.name, sub: sub.name, brand: brand.name });

  // Test 1: Super Admin creates product via API POST /api/v1/admin/products
  const payload1 = {
    title: `Test Product SA ${ts}`,
    slug: `test-product-sa-${ts}`,
    description: 'A test product created by Super Admin',
    categoryId: cat.id,
    subcategoryId: sub.id,
    brandId: brand.id,
    baseMrp: 1999.00,
    basePrice: 1499.00,
    material: '100% Cotton',
    careInstructions: 'Machine wash',
    tags: ['test', 'cotton'],
    isFeatured: false,
    status: 'DRAFT'
  };

  const res1 = await fetch(`${baseUrl}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdmin.token}`
    },
    body: JSON.stringify(payload1)
  });
  const data1 = await res1.json();
  console.log('Test 1 (SUPER_ADMIN): status =', res1.status, 'body =', data1);

  // Test 2: Inventory Manager creates product via API POST /api/v1/admin/products
  const payload2 = {
    title: `Test Product IM ${ts}`,
    slug: `test-product-im-${ts}`,
    description: 'A test product created by Inventory Manager',
    categoryId: cat.id,
    subcategoryId: sub.id,
    brandId: brand.id,
    baseMrp: 2999.00,
    basePrice: 2499.00,
    material: '100% Linen',
    careInstructions: 'Hand wash',
    tags: ['test', 'linen'],
    isFeatured: true,
    status: 'DRAFT'
  };

  const res2 = await fetch(`${baseUrl}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${invManager.token}`
    },
    body: JSON.stringify(payload2)
  });
  const data2 = await res2.json();
  console.log('Test 2 (INVENTORY_MANAGER): status =', res2.status, 'body =', data2);

  // Test 3: Product created without brandId (null)
  const payload3 = {
    title: `Test Product No Brand ${ts}`,
    slug: `test-product-nobrand-${ts}`,
    description: 'A test product with no brand',
    categoryId: cat.id,
    subcategoryId: sub.id,
    brandId: null,
    baseMrp: 999.00,
    basePrice: 799.00,
    material: null,
    careInstructions: null,
    tags: [],
    isFeatured: false,
    status: 'DRAFT'
  };

  const res3 = await fetch(`${baseUrl}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdmin.token}`
    },
    body: JSON.stringify(payload3)
  });
  const data3 = await res3.json();
  console.log('Test 3 (Null optional fields): status =', res3.status, 'body =', data3);

  // Test 4: Query listing products via GET /api/v1/products
  const resList = await fetch(`${baseUrl}/products?page=1&limit=10`);
  const dataList = await resList.json();
  console.log('Test 4 (Public GET /products): total items =', dataList.data?.length, 'meta =', dataList.meta);

  // Test 5: Query listing all products (including draft)
  const resListAll = await fetch(`${baseUrl}/products?status=ALL&page=1&limit=10`);
  const dataListAll = await resListAll.json();
  console.log('Test 5 (GET /products?status=ALL): status =', resListAll.status, 'body =', dataListAll);

  // Cleanup test products and users
  if (data1.data?.id) await supabaseAdmin.from('products').delete().eq('id', data1.data.id);
  if (data2.data?.id) await supabaseAdmin.from('products').delete().eq('id', data2.data.id);
  if (data3.data?.id) await supabaseAdmin.from('products').delete().eq('id', data3.data.id);

  await supabaseAdmin.auth.admin.deleteUser(superAdmin.userId);
  await supabaseAdmin.auth.admin.deleteUser(invManager.userId);
  await supabaseAdmin.auth.admin.deleteUser(storeMgr.userId);

  server.close();
  process.exit(0);
}

testFlow().catch(err => {
  console.error('Test Flow Error:', err);
  process.exit(1);
});
