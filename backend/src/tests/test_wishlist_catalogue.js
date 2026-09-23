import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failed++;
  }
}

async function runWishlistCatalogueTests() {
  console.log('================================================================');
  console.log('     MENX TEST SUITE: WISHLIST CATALOGUE INFORMATION RESOLUTION');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  const ts = Date.now();
  const testCleanup = {
    userIds: [],
    categoryIds: [],
    subcategoryIds: [],
    brandIds: [],
    productIds: [],
    variantIds: [],
    imageIds: []
  };

  try {
    // 1. Create Test Customers
    console.log('>>> 1. Setting Up Test Customers...');
    const cust1Email = `wish-cust1-${ts}@menx.test`;
    const cust2Email = `wish-cust2-${ts}@menx.test`;
    const password = 'Password123!';

    const { data: authCust1 } = await supabaseAdmin.auth.admin.createUser({
      email: cust1Email,
      password,
      email_confirm: true,
      user_metadata: { role: 'CUSTOMER', full_name: 'Wishlist Cust 1' }
    });
    testCleanup.userIds.push(authCust1.user.id);
    await supabaseAdmin.from('profiles').update({ role: 'CUSTOMER' }).eq('id', authCust1.user.id);

    const { data: authCust2 } = await supabaseAdmin.auth.admin.createUser({
      email: cust2Email,
      password,
      email_confirm: true,
      user_metadata: { role: 'CUSTOMER', full_name: 'Wishlist Cust 2' }
    });
    testCleanup.userIds.push(authCust2.user.id);
    await supabaseAdmin.from('profiles').update({ role: 'CUSTOMER' }).eq('id', authCust2.user.id);

    const client1 = createAuthClient();
    const { data: login1 } = await client1.auth.signInWithPassword({ email: cust1Email, password });
    const cust1Token = login1.session.access_token;

    const client2 = createAuthClient();
    const { data: login2 } = await client2.auth.signInWithPassword({ email: cust2Email, password });
    const cust2Token = login2.session.access_token;

    assert(cust1Token && cust2Token, 'Test customers authenticated');

    // 2. Create Catalogue Items (Brand, Category, Subcategory, Products, Images)
    console.log('\n>>> 2. Creating Catalogue Items with Brand, Category & Subcategory...');
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .insert({ name: `AeroFit Sport ${ts}`, slug: `aerofit-sport-${ts}`, is_active: true })
      .select().single();
    testCleanup.brandIds.push(brand.id);

    const { data: category } = await supabaseAdmin
      .from('categories')
      .insert({ name: `T-Shirts ${ts}`, slug: `t-shirts-${ts}`, is_active: true })
      .select().single();
    testCleanup.categoryIds.push(category.id);

    const { data: subcategory } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: category.id, name: `Round Neck ${ts}`, slug: `round-neck-${ts}`, is_active: true })
      .select().single();
    testCleanup.subcategoryIds.push(subcategory.id);

    const { data: product1 } = await supabaseAdmin
      .from('products')
      .insert({
        title: `AeroFit Essential Tee ${ts}`,
        slug: `aerofit-essential-tee-${ts}`,
        description: 'Premium organic cotton tee',
        category_id: category.id,
        subcategory_id: subcategory.id,
        brand_id: brand.id,
        status: 'PUBLISHED',
        base_mrp: 1299.00,
        base_price: 799.00
      })
      .select().single();
    testCleanup.productIds.push(product1.id);

    const { data: img1 } = await supabaseAdmin
      .from('product_images')
      .insert({
        product_id: product1.id,
        image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
        is_primary: true,
        display_order: 1
      })
      .select().single();
    testCleanup.imageIds.push(img1.id);

    const { data: product2 } = await supabaseAdmin
      .from('products')
      .insert({
        title: `AeroFit Heavyweight Tee ${ts}`,
        slug: `aerofit-heavyweight-tee-${ts}`,
        description: 'Heavyweight oversized tee',
        category_id: category.id,
        subcategory_id: subcategory.id,
        brand_id: brand.id,
        status: 'PUBLISHED',
        base_mrp: 1499.00,
        base_price: 999.00
      })
      .select().single();
    testCleanup.productIds.push(product2.id);

    const { data: img2 } = await supabaseAdmin
      .from('product_images')
      .insert({
        product_id: product2.id,
        image_url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=500',
        is_primary: true,
        display_order: 1
      })
      .select().single();
    testCleanup.imageIds.push(img2.id);

    // 3. Add to Wishlist
    console.log('\n>>> 3. Testing POST /api/v1/wishlist/items...');
    const addRes1 = await fetch(`${baseUrl}/wishlist/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`
      },
      body: JSON.stringify({ productId: product1.id })
    });
    const addData1 = await addRes1.json();
    assert(addRes1.status === 201, 'Product 1 successfully added to wishlist');
    assert(addData1.data?.product_id === product1.id, 'Response returns product_id');

    const addRes2 = await fetch(`${baseUrl}/wishlist/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cust1Token}`
      },
      body: JSON.stringify({ productId: product2.id })
    });
    assert(addRes2.status === 201, 'Product 2 successfully added to wishlist');

    // 4. Retrieve Wishlist & Verify Complete Catalogue Details
    console.log('\n>>> 4. Testing GET /api/v1/wishlist item details resolution...');
    const getWishRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const getWishData = await getWishRes.json();
    assert(getWishRes.status === 200, 'GET /wishlist returned HTTP 200');

    const items = getWishData.data || [];
    assert(items.length === 2, `Wishlist contains 2 items (got ${items.length})`);

    const wishItem1 = items.find(i => i.productId === product1.id || i.product_id === product1.id);
    assert(wishItem1 !== undefined, 'Product 1 found in wishlist items');
    assert(wishItem1.title === `AeroFit Essential Tee ${ts}`, 'Product 1 title correctly resolved');
    assert(wishItem1.slug === `aerofit-essential-tee-${ts}`, 'Product 1 slug correctly resolved');
    assert(wishItem1.thumbnailUrl === 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500', 'Product 1 primary image correctly resolved');
    assert(wishItem1.brand?.name === `AeroFit Sport ${ts}`, 'Product 1 brand name correctly resolved');
    assert(wishItem1.category?.name === `T-Shirts ${ts}`, 'Product 1 category name correctly resolved');
    assert(wishItem1.subcategory?.name === `Round Neck ${ts}`, 'Product 1 subcategory name correctly resolved');
    assert(Number(wishItem1.price?.sellingPrice) === 799.00, 'Product 1 selling price is ₹799');
    assert(Number(wishItem1.price?.mrp) === 1299.00, 'Product 1 MRP is ₹1299');
    assert(wishItem1.price?.discountPercent === 38, 'Product 1 discount percentage correctly calculated (38%)');

    // 5. Verify Customer Isolation
    console.log('\n>>> 5. Verifying Customer Isolation...');
    const cust2WishRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${cust2Token}` }
    });
    const cust2WishData = await cust2WishRes.json();
    assert(cust2WishData.data?.length === 0, 'Customer 2 receives empty wishlist (isolation verified)');

    // 6. Verify Wishlist Removal
    console.log('\n>>> 6. Verifying Wishlist Removal...');
    const delRes = await fetch(`${baseUrl}/wishlist/items/${product1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    assert(delRes.status === 200, 'DELETE /wishlist/items/:productId returned HTTP 200');

    const getWishAfterDel = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const dataAfterDel = await getWishAfterDel.json();
    assert(dataAfterDel.data?.length === 1, 'Wishlist count reduced to 1 after deletion');
    assert(dataAfterDel.data[0].productId === product2.id, 'Remaining item is Product 2');

  } catch (err) {
    console.error('[TEST ERROR]', err);
    failed++;
  } finally {
    console.log('\n>>> Cleaning up test fixtures...');
    try {
      if (testCleanup.imageIds.length > 0) {
        await supabaseAdmin.from('product_images').delete().in('id', testCleanup.imageIds);
      }
      if (testCleanup.productIds.length > 0) {
        await supabaseAdmin.from('products').delete().in('id', testCleanup.productIds);
      }
      if (testCleanup.subcategoryIds.length > 0) {
        await supabaseAdmin.from('subcategories').delete().in('id', testCleanup.subcategoryIds);
      }
      if (testCleanup.categoryIds.length > 0) {
        await supabaseAdmin.from('categories').delete().in('id', testCleanup.categoryIds);
      }
      if (testCleanup.brandIds.length > 0) {
        await supabaseAdmin.from('brands').delete().in('id', testCleanup.brandIds);
      }
      for (const uid of testCleanup.userIds) {
        try {
          await supabaseAdmin.from('wishlist_items').delete().eq('wishlist_id', uid);
          await supabaseAdmin.from('wishlists').delete().eq('user_id', uid);
          await supabaseAdmin.from('profiles').delete().eq('id', uid);
          await supabaseAdmin.auth.admin.deleteUser(uid);
        } catch (e) {}
      }
    } catch (cleanupErr) {
      console.warn('[CLEANUP WARNING]', cleanupErr.message);
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWishlistCatalogueTests();
