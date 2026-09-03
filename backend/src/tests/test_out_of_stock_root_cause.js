import { supabaseAdmin, createAuthClient } from '../config/supabase.js';
import { pool } from '../config/db.js';
import app from '../app.js';
import http from 'http';

/**
 * MENX COMPREHENSIVE OUT-OF-STOCK & INVENTORY SUITE (Cases A -> J)
 */
async function runTests() {
  console.log('================================================================');
  console.log('    MENX OUT-OF-STOCK ROOT CAUSE & INVENTORY VERIFICATION');
  console.log('================================================================\n');

  let server;
  let baseUrl;
  let passed = 0;
  let total = 0;

  async function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(` [PASS] ${desc}`);
      passed++;
    } else {
      console.error(` [FAIL] ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  async function makeRequest(url, method = 'GET', token = null, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, body: data };
  }

  // Tracking fixtures for scoped cleanup
  const createdUserIds = [];
  const createdVariantIds = [];
  let createdProductId = null;
  let createdCategoryId = null;
  let createdBrandId = null;
  let createdStoreId = null;
  let createdAddressId = null;

  try {
    const port = 60399;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(port, resolve));
    baseUrl = `http://localhost:${port}/api/v1`;

    const ts = Date.now();

    // 0. Setup store & address
    const { data: store } = await supabaseAdmin.from('stores').insert({
      name: `Test Warehouse ${ts}`,
      code: `STORE-OOS-${ts}`,
      type: 'ONLINE_FULFILLMENT',
      address_line1: '123 Test St',
      city: 'Hyderabad',
      state: 'Telangana',
      postal_code: '500081',
      phone: '+91 9900112233',
      is_active: true
    }).select().single();
    createdStoreId = store.id;

    // Fetch existing category, subcategory, and brand
    const { data: existingCats } = await supabaseAdmin.from('categories').select('*').limit(1);
    const category = existingCats[0];

    const { data: existingSubcats } = await supabaseAdmin.from('subcategories').select('*').limit(1);
    const subcategory = existingSubcats[0];

    const { data: existingBrands } = await supabaseAdmin.from('brands').select('*').limit(1);
    const brand = existingBrands[0];

    // Fetch existing sizes and colors
    const { data: sizes } = await supabaseAdmin.from('sizes').select('*').limit(3);
    const { data: colors } = await supabaseAdmin.from('colors').select('*').limit(2);

    // Create test product with multiple sizes & colors
    const { data: product, error: prodErr } = await supabaseAdmin.from('products').insert({
      title: `OOS Test Shirt ${ts}`,
      slug: `oos-test-shirt-${ts}`,
      description: 'OOS Test Product Description',
      status: 'PUBLISHED',
      category_id: category.id,
      subcategory_id: subcategory ? subcategory.id : null,
      brand_id: brand.id,
      base_price: 1000,
      base_mrp: 1200
    }).select().single();

    if (prodErr) throw prodErr;
    createdProductId = product.id;

    // Variant 1: Color 0, Size 0 (will have Stock = 0)
    // Variant 2: Color 0, Size 1 (will have Stock = 1)
    // Variant 3: Color 0, Size 2 (will have Stock = 5)
    // Variant 4: Color 1, Size 0 (will have Stock = 10)
    const { data: v1, error: v1Err } = await supabaseAdmin.from('product_variants').insert({
      product_id: product.id,
      sku: `SKU-V1-${ts}`,
      barcode: `BAR-V1-${ts}`,
      size_id: sizes[0].id,
      color_id: colors[0].id,
      selling_price: 999,
      mrp: 1200,
      is_active: true,
      low_stock_threshold: 5
    }).select().single();
    if (v1Err) throw new Error(`v1 insert error: ${JSON.stringify(v1Err)}`);
    createdVariantIds.push(v1.id);

    const { data: v2, error: v2Err } = await supabaseAdmin.from('product_variants').insert({
      product_id: product.id,
      sku: `SKU-V2-${ts}`,
      barcode: `BAR-V2-${ts}`,
      size_id: sizes[1].id,
      color_id: colors[0].id,
      selling_price: 999,
      mrp: 1200,
      is_active: true,
      low_stock_threshold: 5
    }).select().single();
    if (v2Err) throw new Error(`v2 insert error: ${JSON.stringify(v2Err)}`);
    createdVariantIds.push(v2.id);

    const { data: v3, error: v3Err } = await supabaseAdmin.from('product_variants').insert({
      product_id: product.id,
      sku: `SKU-V3-${ts}`,
      barcode: `BAR-V3-${ts}`,
      size_id: sizes[2].id,
      color_id: colors[0].id,
      selling_price: 999,
      mrp: 1200,
      is_active: true,
      low_stock_threshold: 5
    }).select().single();
    if (v3Err) throw new Error(`v3 insert error: ${JSON.stringify(v3Err)}`);
    createdVariantIds.push(v3.id);

    const { data: v4, error: v4Err } = await supabaseAdmin.from('product_variants').insert({
      product_id: product.id,
      sku: `SKU-V4-${ts}`,
      barcode: `BAR-V4-${ts}`,
      size_id: sizes[0].id,
      color_id: colors[1].id,
      selling_price: 999,
      mrp: 1200,
      is_active: true,
      low_stock_threshold: 5
    }).select().single();
    if (v4Err) throw new Error(`v4 insert error: ${JSON.stringify(v4Err)}`);
    createdVariantIds.push(v4.id);

    // Create Customers for Cart & Checkout testing
    const password = 'Password123!Secure';
    async function createCustomer(email, firstName) {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'Customer' }
      });
      if (authErr) throw new Error(`Customer ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 200));
      await supabaseAdmin.from('profiles').update({ role: 'CUSTOMER' }).eq('id', uid);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`Customer ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const c1 = await createCustomer(`oos_cust1_${ts}@menx.test`, 'OOSCustomerOne');
    const user1Id = c1.uid;
    const token1 = c1.token;

    const c2 = await createCustomer(`oos_cust2_${ts}@menx.test`, 'OOSCustomerTwo');
    const user2Id = c2.uid;
    const token2 = c2.token;

    // Create shipping address for user1 and user2
    const addrRes1 = await makeRequest(`${baseUrl}/addresses`, 'POST', token1, {
      recipientName: 'OOS Customer 1',
      phoneNumber: '+91 9900112233',
      addressLine1: 'Road 1',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500081',
      isDefault: true
    });
    createdAddressId = addrRes1.body.data.id;

    const addrRes2 = await makeRequest(`${baseUrl}/addresses`, 'POST', token2, {
      recipientName: 'OOS Customer 2',
      phoneNumber: '+91 9900112244',
      addressLine1: 'Road 2',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCode: '500081',
      isDefault: true
    });
    const createdAddress2Id = addrRes2.body.data.id;

    // Seed inventory_items specifically for these test variants:
    // v1: Stock = 0
    await supabaseAdmin.from('inventory_items').insert({
      store_id: store.id,
      variant_id: v1.id,
      quantity_available: 0,
      quantity_reserved: 0
    });

    // v2: Stock = 1
    await supabaseAdmin.from('inventory_items').insert({
      store_id: store.id,
      variant_id: v2.id,
      quantity_available: 1,
      quantity_reserved: 0
    });

    // v3: Stock = 5
    await supabaseAdmin.from('inventory_items').insert({
      store_id: store.id,
      variant_id: v3.id,
      quantity_available: 5,
      quantity_reserved: 0
    });

    // v4: Stock = 10
    await supabaseAdmin.from('inventory_items').insert({
      store_id: store.id,
      variant_id: v4.id,
      quantity_available: 10,
      quantity_reserved: 0
    });

    // -------------------------------------------------------------------------
    // TEST A: Stock = 0 -> Out of Stock
    // -------------------------------------------------------------------------
    console.log('>>> TEST A: Stock = 0 -> Out of Stock');
    const prodResA = await makeRequest(`${baseUrl}/products/${product.slug}`);
    await assert('Catalog API returns HTTP 200', prodResA.status === 200);
    const varA = prodResA.body.data.variants.find(v => v.id === v1.id);
    await assert('Variant with 0 stock has availability OUT_OF_STOCK', varA.availability === 'OUT_OF_STOCK');
    await assert('Variant with 0 stock has availableStock = 0', varA.availableStock === 0);

    const addCartA = await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v1.id,
      quantity: 1
    });
    await assert('Adding 0 stock variant to cart is rejected by backend (400)', addCartA.status === 400);

    // -------------------------------------------------------------------------
    // TEST B: Stock = 1 -> In Stock / Low Stock -> Can add 1, cannot add 2
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST B: Stock = 1 -> In Stock -> Can add 1');
    const varB = prodResA.body.data.variants.find(v => v.id === v2.id);
    await assert('Variant with 1 stock has availability LOW_STOCK', varB.availability === 'LOW_STOCK');
    await assert('Variant with 1 stock has availableStock = 1', varB.availableStock === 1);

    const addCartB1 = await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v2.id,
      quantity: 1
    });
    await assert('Adding 1 unit of 1-stock variant succeeds (200/201)', addCartB1.status === 200 || addCartB1.status === 201);

    const addCartB2 = await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v2.id,
      quantity: 1
    });
    await assert('Adding 2nd unit of 1-stock variant is rejected (400)', addCartB2.status === 400);

    // Clean cart for next test
    await supabaseAdmin.from('cart_items').delete().in('variant_id', createdVariantIds);

    // -------------------------------------------------------------------------
    // TEST C: Stock = 5 -> Can add up to 5, cannot add 6
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST C: Stock = 5 -> Can add up to 5, cannot add 6');
    const varC = prodResA.body.data.variants.find(v => v.id === v3.id);
    await assert('Variant with 5 stock has availableStock = 5', varC.availableStock === 5);

    const addCartC5 = await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v3.id,
      quantity: 5
    });
    await assert('Adding 5 units of 5-stock variant succeeds (200/201)', addCartC5.status === 200 || addCartC5.status === 201);

    const addCartC6 = await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v3.id,
      quantity: 1
    });
    await assert('Adding 6th unit of 5-stock variant is rejected (400)', addCartC6.status === 400);

    // Clean cart
    await supabaseAdmin.from('cart_items').delete().in('variant_id', createdVariantIds);

    // -------------------------------------------------------------------------
    // TEST D & E: Switch between in-stock and out-of-stock variants
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST D & E: Variant Availability Differentiation');
    const prodResDE = await makeRequest(`${baseUrl}/products/${product.slug}`);
    const variantsDE = prodResDE.body.data.variants;
    const oosVariant = variantsDE.find(v => v.id === v1.id);
    const inStockVariant = variantsDE.find(v => v.id === v4.id);
    await assert('Out of stock variant identified correctly', oosVariant.availability === 'OUT_OF_STOCK' && oosVariant.availableStock === 0);
    await assert('In stock variant identified correctly', inStockVariant.availability === 'IN_STOCK' && inStockVariant.availableStock === 10);

    // -------------------------------------------------------------------------
    // TEST F & G: Product has multiple sizes & colors with independent stock
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST F & G: Independent Variant Stock Verification');
    const vSize0Color0 = variantsDE.find(v => v.id === v1.id);
    const vSize1Color0 = variantsDE.find(v => v.id === v2.id);
    const vSize2Color0 = variantsDE.find(v => v.id === v3.id);
    const vSize0Color1 = variantsDE.find(v => v.id === v4.id);

    await assert('Size 0 / Color 0 has stock 0', vSize0Color0.availableStock === 0);
    await assert('Size 1 / Color 0 has stock 1', vSize1Color0.availableStock === 1);
    await assert('Size 2 / Color 0 has stock 5', vSize2Color0.availableStock === 5);
    await assert('Size 0 / Color 1 has stock 10', vSize0Color1.availableStock === 10);

    // -------------------------------------------------------------------------
    // TEST H: Refreshing page produces consistent stock
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST H: Stock Persistence on Repeat Fetch');
    const prodResH = await makeRequest(`${baseUrl}/products/${product.slug}`);
    const refreshedV4 = prodResH.body.data.variants.find(v => v.id === v4.id);
    await assert('Stock remains 10 on repeat page fetch', refreshedV4.availableStock === 10);

    // -------------------------------------------------------------------------
    // TEST I: Add item to cart, then reduce inventory -> Checkout must reject
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST I: Mid-session Inventory Depletion Checkout Rejection');
    // User1 adds 1 unit of v2 (stock currently 1)
    await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v2.id,
      quantity: 1
    });

    // Now inventory drops to 0 in database before checkout
    await supabaseAdmin
      .from('inventory_items')
      .update({ quantity_available: 0 })
      .eq('store_id', store.id)
      .eq('variant_id', v2.id);

    // User1 attempts checkout validation
    const checkoutValRes = await makeRequest(`${baseUrl}/checkout/validate`, 'POST', token1, {
      addressId: createdAddressId
    });
    await assert('Checkout validation rejects depleted inventory (400)', checkoutValRes.status === 400);

    // Clean cart
    await supabaseAdmin.from('cart_items').delete().in('variant_id', createdVariantIds);

    // -------------------------------------------------------------------------
    // TEST J: Two users attempt to buy final unit -> Only one order succeeds
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST J: Concurrency Lock Race Condition (Final Unit)');
    // Set stock of v2 to exactly 1
    await supabaseAdmin
      .from('inventory_items')
      .update({ quantity_available: 1, quantity_reserved: 0 })
      .eq('store_id', store.id)
      .eq('variant_id', v2.id);

    // Both users add 1 unit to their carts
    await makeRequest(`${baseUrl}/cart/items`, 'POST', token1, {
      variantId: v2.id,
      quantity: 1
    });
    await makeRequest(`${baseUrl}/cart/items`, 'POST', token2, {
      variantId: v2.id,
      quantity: 1
    });

    // Both fire checkout order creation concurrently
    const [orderRes1, orderRes2] = await Promise.all([
      makeRequest(`${baseUrl}/orders`, 'POST', token1, {
        addressId: createdAddressId,
        paymentMethod: 'COD'
      }),
      makeRequest(`${baseUrl}/orders`, 'POST', token2, {
        addressId: createdAddress2Id,
        paymentMethod: 'COD'
      })
    ]);

    const oneSucceeded = (orderRes1.status === 201 && orderRes2.status === 400) || (orderRes2.status === 201 && orderRes1.status === 400);
    await assert('Exactly one concurrent order succeeded and one failed with 400', oneSucceeded);

    // Verify DB inventory reserved exactly 1 and available is 0
    const { data: finalInv } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available, quantity_reserved')
      .eq('store_id', store.id)
      .eq('variant_id', v2.id)
      .single();

    await assert('Final inventory available is 0', finalInv.quantity_available === 0);
    await assert('Final inventory reserved is 1', finalInv.quantity_reserved === 1);

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('\n[TEST RUNTIME ERROR]', err);
    process.exit(1);
  } finally {
    console.log('\n>>> Cleaning up test fixtures...');
    try {
      if (createdUserIds.length > 0) {
        await supabaseAdmin.from('order_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabaseAdmin.from('order_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('orders').delete().in('customer_id', createdUserIds);
        await supabaseAdmin.from('cart_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('carts').delete().in('user_id', createdUserIds);
        await supabaseAdmin.from('addresses').delete().in('user_id', createdUserIds);
        await supabaseAdmin.from('user_roles').delete().in('user_id', createdUserIds);
        await supabaseAdmin.from('customer_profiles').delete().in('id', createdUserIds);
        await supabaseAdmin.from('users').delete().in('id', createdUserIds);
      }
      if (createdVariantIds.length > 0) {
        await supabaseAdmin.from('inventory_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
      }
      if (createdProductId) {
        await supabaseAdmin.from('products').delete().eq('id', createdProductId);
      }
      if (createdCategoryId) {
        await supabaseAdmin.from('categories').delete().eq('id', createdCategoryId);
      }
      if (createdBrandId) {
        await supabaseAdmin.from('brands').delete().eq('id', createdBrandId);
      }
      if (createdStoreId) {
        await supabaseAdmin.from('stores').delete().eq('id', createdStoreId);
      }
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    if (server) {
      await new Promise(r => server.close(r));
    }
    await pool.end();
  }
}

runTests().then(() => process.exit(0)).catch(console.error);
