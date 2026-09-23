import http from 'http';
import app from '../app.js';
import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
    results.push({ name: testName, status: 'PASS', details });
  } else {
    console.error(`  [FAIL] ${testName} - ${details}`);
    failed++;
    results.push({ name: testName, status: 'FAIL', details });
  }
}

async function runOrderDetailsItemsTests() {
  console.log('================================================================');
  console.log('     MENX TEST SUITE: ORDERED ITEMS IN ORDER DETAILS PAGE');
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
    addressIds: [],
    orderIds: [],
    imageIds: []
  };

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP TEST USERS (Customer 1, Customer 2, Super Admin)
    // -------------------------------------------------------------------------
    console.log('>>> 1. Creating Test Customers and Admin...');
    const cust1Email = `order-cust1-${ts}@menx.test`;
    const cust2Email = `order-cust2-${ts}@menx.test`;
    const password = 'Password123!';

    // Create Customer 1
    const { data: authCust1, error: cust1Err } = await supabaseAdmin.auth.admin.createUser({
      email: cust1Email,
      password,
      email_confirm: true,
      user_metadata: { role: 'CUSTOMER', full_name: 'Order Customer 1' }
    });
    if (cust1Err) throw new Error(`Failed to create Cust 1: ${cust1Err.message}`);
    const cust1Id = authCust1.user.id;
    testCleanup.userIds.push(cust1Id);
    await supabaseAdmin.from('profiles').update({ role: 'CUSTOMER', full_name: 'Order Customer 1' }).eq('id', cust1Id);

    const authClient1 = createAuthClient();
    const { data: loginCust1 } = await authClient1.auth.signInWithPassword({ email: cust1Email, password });
    const cust1Token = loginCust1.session.access_token;

    // Create Customer 2
    const { data: authCust2, error: cust2Err } = await supabaseAdmin.auth.admin.createUser({
      email: cust2Email,
      password,
      email_confirm: true,
      user_metadata: { role: 'CUSTOMER', full_name: 'Order Customer 2' }
    });
    if (cust2Err) throw new Error(`Failed to create Cust 2: ${cust2Err.message}`);
    const cust2Id = authCust2.user.id;
    testCleanup.userIds.push(cust2Id);
    await supabaseAdmin.from('profiles').update({ role: 'CUSTOMER', full_name: 'Order Customer 2' }).eq('id', cust2Id);

    const authClient2 = createAuthClient();
    const { data: loginCust2 } = await authClient2.auth.signInWithPassword({ email: cust2Email, password });
    const cust2Token = loginCust2.session.access_token;

    assert(cust1Token && cust2Token, 'Test customers created and authenticated');

    // -------------------------------------------------------------------------
    // 2. SETUP CATALOG DATA (Brand, Category, Subcategory, Products, Variants, Images)
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Creating Catalogue Taxonomy, Products & Images...');

    // Brand
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .insert({
        name: `AeroFit Sport ${ts}`,
        slug: `aerofit-sport-${ts}`,
        is_active: true
      })
      .select()
      .single();
    if (brandErr) throw new Error(`Failed to create brand: ${brandErr.message}`);
    testCleanup.brandIds.push(brand.id);

    // Category & Subcategory
    const { data: category, error: catErr } = await supabaseAdmin
      .from('categories')
      .insert({
        name: `T-Shirts ${ts}`,
        slug: `t-shirts-${ts}`,
        is_active: true
      })
      .select()
      .single();
    if (catErr) throw new Error(`Failed to create category: ${catErr.message}`);
    testCleanup.categoryIds.push(category.id);

    const { data: subcategory, error: subcatErr } = await supabaseAdmin
      .from('subcategories')
      .insert({
        category_id: category.id,
        name: `Round Neck ${ts}`,
        slug: `round-neck-${ts}`,
        is_active: true
      })
      .select()
      .single();
    if (subcatErr) throw new Error(`Failed to create subcategory: ${subcatErr.message}`);
    testCleanup.subcategoryIds.push(subcategory.id);

    // Sizes and Colors
    const { data: sizes } = await supabaseAdmin.from('sizes').select('*').limit(2);
    const { data: colors } = await supabaseAdmin.from('colors').select('*').limit(2);
    const size1 = sizes[0];
    const size2 = sizes[1] || sizes[0];
    const color1 = colors[0];
    const color2 = colors[1] || colors[0];

    // Product 1 (Active)
    const { data: prod1, error: prod1Err } = await supabaseAdmin
      .from('products')
      .insert({
        title: `Essential Crew Neck T-Shirt ${ts}`,
        slug: `essential-crew-neck-${ts}`,
        description: 'Premium combed cotton t-shirt',
        category_id: category.id,
        subcategory_id: subcategory.id,
        brand_id: brand.id,
        status: 'PUBLISHED',
        base_mrp: 999.00,
        base_price: 699.00
      })
      .select()
      .single();
    if (prod1Err) throw new Error(`Failed to create product 1: ${prod1Err.message}`);
    testCleanup.productIds.push(prod1.id);

    // Variant 1
    const { data: var1, error: var1Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod1.id,
        sku: `TSHIRT-M-BLK-${ts}`,
        barcode: `BC-TSHIRT-M-BLK-${ts}`,
        size_id: size1.id,
        color_id: color1.id,
        mrp: 999.00,
        selling_price: 699.00,
        is_active: true
      })
      .select()
      .single();
    if (var1Err) throw new Error(`Failed to create variant 1: ${var1Err.message}`);
    testCleanup.variantIds.push(var1.id);

    // Product 1 Image
    const { data: img1, error: img1Err } = await supabaseAdmin
      .from('product_images')
      .insert({
        product_id: prod1.id,
        image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
        is_primary: true,
        display_order: 1
      })
      .select()
      .single();
    if (img1Err) throw new Error(`Failed to create image 1: ${img1Err.message}`);
    testCleanup.imageIds.push(img1.id);

    // Product 2 (Active, second item)
    const { data: prod2, error: prod2Err } = await supabaseAdmin
      .from('products')
      .insert({
        title: `Pro Performance Joggers ${ts}`,
        slug: `pro-performance-joggers-${ts}`,
        description: 'Comfort stretch joggers',
        category_id: category.id,
        subcategory_id: subcategory.id,
        brand_id: brand.id,
        status: 'PUBLISHED',
        base_mrp: 1899.00,
        base_price: 1299.00
      })
      .select()
      .single();
    if (prod2Err) throw new Error(`Failed to create product 2: ${prod2Err.message}`);
    testCleanup.productIds.push(prod2.id);

    // Variant 2
    const { data: var2, error: var2Err } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prod2.id,
        sku: `JOGGER-L-GRY-${ts}`,
        barcode: `BC-JOGGER-L-GRY-${ts}`,
        size_id: size2.id,
        color_id: color2.id,
        mrp: 1899.00,
        selling_price: 1299.00,
        is_active: true
      })
      .select()
      .single();
    if (var2Err) throw new Error(`Failed to create variant 2: ${var2Err.message}`);
    testCleanup.variantIds.push(var2.id);

    // Product 2 Image
    const { data: img2, error: img2Err } = await supabaseAdmin
      .from('product_images')
      .insert({
        product_id: prod2.id,
        image_url: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=500',
        is_primary: true,
        display_order: 1
      })
      .select()
      .single();
    if (img2Err) throw new Error(`Failed to create image 2: ${img2Err.message}`);
    testCleanup.imageIds.push(img2.id);

    // -------------------------------------------------------------------------
    // 3. CREATE ORDER WITH MULTIPLE ORDER ITEMS
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Creating Multi-Item Customer Order...');
    
    // Create Shipping Address for Cust 1
    const { data: addr1, error: addrErr } = await supabaseAdmin
      .from('addresses')
      .insert({
        user_id: cust1Id,
        recipient_name: 'Order Customer 1',
        phone_number: '9876543210',
        address_line1: '123 Tech Park',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500081',
        address_type: 'HOME',
        is_default: true
      })
      .select()
      .single();
    if (addrErr) throw new Error(`Failed to create address: ${addrErr.message}`);
    testCleanup.addressIds.push(addr1.id);

    const orderNumber = `ORD-TEST-${ts}`;
    const item1Qty = 2;
    const item1Price = 699.00;
    const item1Mrp = 999.00;
    const item1Total = item1Price * item1Qty; // 1398.00

    const item2Qty = 1;
    const item2Price = 1299.00;
    const item2Mrp = 1899.00;
    const item2Total = item2Price * item2Qty; // 1299.00

    const subtotal = item1Total + item2Total; // 2697.00
    const deliveryFee = 0.00;
    const totalPayable = subtotal + deliveryFee;

    const { data: store } = await supabaseAdmin.from('stores').select('id').limit(1).single();
    const storeId = store?.id;

    const { data: order1, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: cust1Id,
        store_id: storeId,
        order_status: 'PENDING',
        payment_method: 'COD',
        subtotal_amount: subtotal,
        discount_amount: 0.00,
        delivery_fee: deliveryFee,
        total_payable: totalPayable,
        cod_amount_due: totalPayable,
        customer_phone: '9876543210',
        shipping_snapshot: {
          recipient_name: 'Order Customer 1',
          phone_number: '9876543210',
          address_line1: '123 Tech Park',
          city: 'Hyderabad',
          state: 'Telangana',
          postal_code: '500081'
        }
      })
      .select()
      .single();
    if (orderErr) throw new Error(`Failed to create order: ${orderErr.message}`);
    testCleanup.orderIds.push(order1.id);

    // Insert Order Items with exact snapshots
    const { data: orderItems, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert([
        {
          order_id: order1.id,
          variant_id: var1.id,
          product_title_snapshot: `Essential Crew Neck T-Shirt ${ts}`,
          variant_sku_snapshot: `TSHIRT-M-BLK-${ts}`,
          size_snapshot: size1.name || 'M',
          color_snapshot: color1.name || 'Black',
          unit_mrp_snapshot: item1Mrp,
          unit_price_snapshot: item1Price,
          quantity: item1Qty,
          line_subtotal: item1Total,
          line_discount: 0.00,
          line_total: item1Total
        },
        {
          order_id: order1.id,
          variant_id: var2.id,
          product_title_snapshot: `Pro Performance Joggers ${ts}`,
          variant_sku_snapshot: `JOGGER-L-GRY-${ts}`,
          size_snapshot: size2.name || 'L',
          color_snapshot: color2.name || 'Grey',
          unit_mrp_snapshot: item2Mrp,
          unit_price_snapshot: item2Price,
          quantity: item2Qty,
          line_subtotal: item2Total,
          line_discount: 0.00,
          line_total: item2Total
        }
      ])
      .select();
    if (itemsErr) throw new Error(`Failed to insert order items: ${itemsErr.message}`);

    // -------------------------------------------------------------------------
    // 4. TEST GET /api/v1/orders/:orderId (Customer 1 accessing own order)
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing GET /orders/:orderId for authenticated owner...');
    const orderRes = await fetch(`${baseUrl}/orders/${order1.id}`, {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const orderBody = await orderRes.json();
    assert(orderRes.status === 200, 'Customer successfully retrieves own order details');

    const fetchedOrder = orderBody.data;
    assert(fetchedOrder.id === order1.id, 'Order ID matches requested order');
    assert(fetchedOrder.order_items?.length === 2, 'Returns all 2 ordered items');

    const fetchedItem1 = fetchedOrder.order_items.find(i => i.variant_sku_snapshot === `TSHIRT-M-BLK-${ts}`);
    assert(fetchedItem1 !== undefined, 'Item 1 is present in ordered items');
    assert(fetchedItem1.product_title_snapshot === `Essential Crew Neck T-Shirt ${ts}`, 'Item 1 product title snapshot matches');
    assert(Number(fetchedItem1.unit_price_snapshot) === 699.00, 'Item 1 selling price snapshot matches');
    assert(Number(fetchedItem1.unit_mrp_snapshot) === 999.00, 'Item 1 MRP snapshot matches');
    assert(fetchedItem1.quantity === 2, 'Item 1 quantity matches');
    assert(Number(fetchedItem1.line_total) === 1398.00, 'Item 1 line total matches');
    assert(fetchedItem1.size_snapshot === (size1.name || 'M'), 'Item 1 size snapshot matches');
    assert(fetchedItem1.color_snapshot === (color1.name || 'Black'), 'Item 1 color snapshot matches');

    // Verify nested catalogue relationships
    const item1Prod = fetchedItem1.variant?.product;
    assert(item1Prod !== undefined && item1Prod !== null, 'Item 1 has nested product object');
    assert(item1Prod.slug === `essential-crew-neck-${ts}`, 'Item 1 product slug matches');
    assert(item1Prod.status === 'PUBLISHED', 'Item 1 product status is PUBLISHED');
    assert(item1Prod.brand?.name === `AeroFit Sport ${ts}`, 'Item 1 brand name matches');
    assert(item1Prod.category?.name === `T-Shirts ${ts}`, 'Item 1 category name matches');
    assert(item1Prod.subcategory?.name === `Round Neck ${ts}`, 'Item 1 subcategory name matches');
    assert(item1Prod.images?.length > 0 && item1Prod.images[0].image_url.includes('images.unsplash.com'), 'Item 1 has primary image URL');

    // -------------------------------------------------------------------------
    // 5. TEST CUSTOMER DATA ISOLATION (Customer 2 cannot view Customer 1's order)
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Customer Data Isolation...');
    const unauthOrderRes = await fetch(`${baseUrl}/orders/${order1.id}`, {
      headers: { Authorization: `Bearer ${cust2Token}` }
    });
    assert(unauthOrderRes.status === 404, 'Customer 2 receives HTTP 404 when accessing Customer 1 order');

    // -------------------------------------------------------------------------
    // 6. TEST HISTORICAL ORDER SAFETY ON CATALOG MODIFICATIONS
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Testing Historical Order Safety upon Catalog Product Price Change...');
    
    // Update live catalog price of Product 1 and Variant 1 to new higher values
    await supabaseAdmin
      .from('product_variants')
      .update({ selling_price: 1599.00, mrp: 2199.00 })
      .eq('id', var1.id);

    await supabaseAdmin
      .from('products')
      .update({ base_price: 1599.00, base_mrp: 2199.00, title: 'Modified Active Title' })
      .eq('id', prod1.id);

    // Re-fetch order details
    const orderResAfterMod = await fetch(`${baseUrl}/orders/${order1.id}`, {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const orderBodyAfterMod = await orderResAfterMod.json();
    const fetchedItem1AfterMod = orderBodyAfterMod.data.order_items.find(i => i.variant_sku_snapshot === `TSHIRT-M-BLK-${ts}`);

    assert(Number(fetchedItem1AfterMod.unit_price_snapshot) === 699.00, 'Original purchased price (699.00) remains frozen after catalog price increase');
    assert(Number(fetchedItem1AfterMod.unit_mrp_snapshot) === 999.00, 'Original MRP snapshot (999.00) remains frozen');
    assert(Number(fetchedItem1AfterMod.line_total) === 1398.00, 'Original line total (1398.00) remains frozen');
    assert(Number(orderBodyAfterMod.data.total_payable) === 2697.00, 'Order total payable remains frozen');

    // -------------------------------------------------------------------------
    // 7. TEST HISTORICAL ORDER SAFETY ON CATALOG DEACTIVATION / UNPUBLISH
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Testing Catalog Status Unpublish (DRAFT/INACTIVE)...');
    await supabaseAdmin
      .from('products')
      .update({ status: 'DRAFT' })
      .eq('id', prod2.id);

    const orderResAfterDraft = await fetch(`${baseUrl}/orders/${order1.id}`, {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const orderBodyAfterDraft = await orderResAfterDraft.json();
    assert(orderResAfterDraft.status === 200, 'Order Details endpoint succeeds even when a product is unlisted/DRAFT');

    const fetchedItem2Draft = orderBodyAfterDraft.data.order_items.find(i => i.variant_sku_snapshot === `JOGGER-L-GRY-${ts}`);
    assert(fetchedItem2Draft.product_title_snapshot === `Pro Performance Joggers ${ts}`, 'Item 2 snapshot title intact');
    assert(fetchedItem2Draft.variant?.product?.status === 'DRAFT', 'Product status correctly reflects DRAFT (allowing frontend to show unavailable)');

  } catch (err) {
    console.error('[TEST ERROR]', err);
    failed++;
  } finally {
    console.log('\n>>> Cleaning up test resources...');
    try {
      if (testCleanup.orderIds.length > 0) {
        await supabaseAdmin.from('order_items').delete().in('order_id', testCleanup.orderIds);
        await supabaseAdmin.from('orders').delete().in('id', testCleanup.orderIds);
      }
      if (testCleanup.addressIds.length > 0) {
        await supabaseAdmin.from('addresses').delete().in('id', testCleanup.addressIds);
      }
      if (testCleanup.imageIds.length > 0) {
        await supabaseAdmin.from('product_images').delete().in('id', testCleanup.imageIds);
      }
      if (testCleanup.variantIds.length > 0) {
        await supabaseAdmin.from('product_variants').delete().in('id', testCleanup.variantIds);
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

runOrderDetailsItemsTests();
