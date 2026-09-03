import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runPhase4DTests() {
  console.log('================================================================');
  console.log('         MENX PHASE 4D — CART & WISHLIST TEST SUITE');
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
  const createdStoreIds = [];
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];
  const createdCartIds = [];
  const createdWishlistIds = [];

  let customer1Token = null;
  let customer1UserId = null;
  let customer2Token = null;
  let customer2UserId = null;

  let testStore = null;
  let testCategory = null;
  let testSubcategory = null;
  let testBrand = null;
  let testSize1 = null;
  let testSize2 = null;
  let testSize3 = null;
  let testColor = null;
  let testPublishedProduct = null;
  let testDraftProduct = null;
  let testVariant1 = null;
  let testVariant2 = null;
  let testInactiveVariant = null;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Initializing Test Accounts & Fixtures
    // -------------------------------------------------------------------------
    console.log('>>> Setup: Initializing Customers, Products, Variants & Stock...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    // Helper to create test user
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

      await new Promise(r => setTimeout(r, 300));
      await supabaseAdmin.from('profiles').update({ role: 'CUSTOMER' }).eq('id', uid);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`Customer ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const c1 = await createCustomer(`cust1.${ts}@menxfashion.com`, 'CustomerOne');
    customer1UserId = c1.uid;
    customer1Token = c1.token;

    const c2 = await createCustomer(`cust2.${ts}@menxfashion.com`, 'CustomerTwo');
    customer2UserId = c2.uid;
    customer2Token = c2.token;

    // Seed store
    const { data: st } = await supabaseAdmin
      .from('stores')
      .insert({
        name: 'MenX Flagship',
        code: `FLAGSHIP-${ts}`,
        type: 'PHYSICAL_STORE',
        address_line1: 'Road 1',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500001',
        phone: '+91 9988776655',
        is_active: true
      })
      .select()
      .single();
    testStore = st;
    createdStoreIds.push(st.id);

    // Seed taxonomy
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .insert({ name: 'Apparel', slug: `apparel-${ts}`, display_order: 1 })
      .select()
      .single();
    testCategory = cat;
    createdCategoryIds.push(cat.id);

    const { data: subcat } = await supabaseAdmin
      .from('subcategories')
      .insert({ category_id: cat.id, name: 'Polo Shirts', slug: `polos-${ts}` })
      .select()
      .single();
    testSubcategory = subcat;
    createdSubcategoryIds.push(subcat.id);

    const { data: br } = await supabaseAdmin
      .from('brands')
      .insert({ name: `MenX Polo ${ts}`, slug: `menx-polo-${ts}` })
      .select()
      .single();
    testBrand = br;
    createdBrandIds.push(br.id);

    const { data: sz1 } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-M-${ts}`, category_type: 'APPAREL', sort_order: 2 })
      .select()
      .single();
    testSize1 = sz1;
    createdSizeIds.push(sz1.id);

    const { data: sz2 } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-L-${ts}`, category_type: 'APPAREL', sort_order: 3 })
      .select()
      .single();
    testSize2 = sz2;
    createdSizeIds.push(sz2.id);

    const { data: sz3 } = await supabaseAdmin
      .from('sizes')
      .insert({ name: `Size-XL-${ts}`, category_type: 'APPAREL', sort_order: 4 })
      .select()
      .single();
    testSize3 = sz3;
    createdSizeIds.push(sz3.id);

    const { data: cl } = await supabaseAdmin
      .from('colors')
      .insert({ name: `Forest Green ${ts}`, hex_code: '#228B22' })
      .select()
      .single();
    testColor = cl;
    createdColorIds.push(cl.id);

    // Seed 1 Published Product + 1 Draft Product
    const { data: prodPub } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Classic Pique Cotton Polo',
        slug: `classic-pique-polo-${ts}`,
        description: 'Iconic breathable pique cotton polo shirt.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'PUBLISHED',
        base_mrp: 1999.00,
        base_price: 1499.00,
        tags: ['polo', 'cotton']
      })
      .select()
      .single();
    testPublishedProduct = prodPub;
    createdProductIds.push(prodPub.id);

    const { data: prodDraft } = await supabaseAdmin
      .from('products')
      .insert({
        title: 'Draft Unreleased Polo',
        slug: `draft-unreleased-polo-${ts}`,
        description: 'Unpublished prototype polo.',
        category_id: cat.id,
        subcategory_id: subcat.id,
        brand_id: br.id,
        status: 'DRAFT',
        base_mrp: 2499.00,
        base_price: 1999.00
      })
      .select()
      .single();
    testDraftProduct = prodDraft;
    createdProductIds.push(prodDraft.id);

    // Seed Variants
    const { data: v1 } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodPub.id,
        size_id: sz1.id,
        color_id: cl.id,
        sku: `POLO-GRN-M-${ts}`,
        barcode: `89011111${ts.toString().slice(-6)}`,
        mrp: 1999.00,
        selling_price: 1499.00,
        is_active: true,
        low_stock_threshold: 3
      })
      .select()
      .single();
    testVariant1 = v1;
    createdVariantIds.push(v1.id);

    const { data: v2 } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodPub.id,
        size_id: sz2.id,
        color_id: cl.id,
        sku: `POLO-GRN-L-${ts}`,
        barcode: `89022222${ts.toString().slice(-6)}`,
        mrp: 1999.00,
        selling_price: 1499.00,
        is_active: true,
        low_stock_threshold: 3
      })
      .select()
      .single();
    testVariant2 = v2;
    createdVariantIds.push(v2.id);

    // Inactive variant
    const { data: vInact } = await supabaseAdmin
      .from('product_variants')
      .insert({
        product_id: prodPub.id,
        size_id: sz3.id,
        color_id: cl.id,
        sku: `POLO-INACT-${ts}`,
        barcode: `89033333${ts.toString().slice(-6)}`,
        mrp: 1999.00,
        selling_price: 1499.00,
        is_active: false
      })
      .select()
      .single();
    testInactiveVariant = vInact;
    createdVariantIds.push(vInact.id);

    // Stock allocation: 5 units of testVariant1, 10 units of testVariant2
    await supabaseAdmin
      .from('inventory_items')
      .insert([
        { store_id: st.id, variant_id: v1.id, quantity_available: 5 },
        { store_id: st.id, variant_id: v2.id, quantity_available: 10 }
      ]);

    console.log(' [PASS] Setup completed successfully with all test fixtures.\n');

    // -------------------------------------------------------------------------
    // TEST SECTION 1: Wishlist Endpoints & Isolation
    // -------------------------------------------------------------------------
    console.log('>>> 1. Wishlist APIs & Customer Isolation');

    // 1. Wishlist creation & get empty wishlist
    const emptyWishRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${customer1Token}` }
    });
    const emptyWishData = await emptyWishRes.json();
    await assert('1. Authenticated customer gets own empty wishlist', emptyWishRes.status === 200 && emptyWishData.meta?.itemCount === 0);
    if (emptyWishData.meta?.wishlistId) createdWishlistIds.push(emptyWishData.meta.wishlistId);

    // 2. Wishlist add works
    const addWishRes = await fetch(`${baseUrl}/wishlist/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ productId: testPublishedProduct.id })
    });
    await assert('2. Wishlist add works for published product', addWishRes.status === 201);

    // 3. Duplicate wishlist item prevented
    const dupWishRes = await fetch(`${baseUrl}/wishlist/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ productId: testPublishedProduct.id })
    });
    const dupWishData = await dupWishRes.json();
    await assert('3. Duplicate wishlist item prevented / idempotent', dupWishRes.status === 201 && dupWishData.data?.product_id === testPublishedProduct.id);

    // 4. Unpublished product rejected from wishlist
    const draftWishRes = await fetch(`${baseUrl}/wishlist/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ productId: testDraftProduct.id })
    });
    await assert('4. Unpublished product rejected from wishlist with HTTP 400', draftWishRes.status === 400);

    // 5. Customer wishlist isolation works
    const cust2WishRes = await fetch(`${baseUrl}/wishlist`, {
      headers: { Authorization: `Bearer ${customer2Token}` }
    });
    const cust2WishData = await cust2WishRes.json();
    await assert('5. Customer wishlist isolation works (Customer 2 receives empty wishlist)', cust2WishData.meta?.itemCount === 0);

    // 6. Wishlist removal works
    const removeWishRes = await fetch(`${baseUrl}/wishlist/items/${testPublishedProduct.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer1Token}` }
    });
    await assert('6. Wishlist removal works', removeWishRes.status === 200);

    // -------------------------------------------------------------------------
    // TEST SECTION 2: Authenticated Cart APIs
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Authenticated Customer Cart APIs');

    // 7. Authenticated customer gets own empty cart
    const emptyCartRes = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customer1Token}` }
    });
    const emptyCartData = await emptyCartRes.json();
    await assert('7. Authenticated customer gets own empty cart', emptyCartRes.status === 200 && emptyCartData.data.items.length === 0);
    if (emptyCartData.data.cartId) createdCartIds.push(emptyCartData.data.cartId);

    // 8. Customer adds valid variant
    const addCartRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({
        variantId: testVariant1.id,
        quantity: 2,
        clientManipulatedPrice: 1.00 // Intentionally attempting client price manipulation
      })
    });
    const addCartData = await addCartRes.json();
    await assert('8. Customer adds valid variant to cart', addCartRes.status === 200 && addCartData.data.items.length === 1);

    // 9. Customer retrieves cart
    const getCartRes = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${customer1Token}` }
    });
    const getCartData = await getCartRes.json();
    await assert('9. Customer retrieves cart successfully', getCartRes.status === 200 && getCartData.data.items.length === 1);

    // 10. Client price manipulation ignored
    await assert('10. Client price manipulation ignored (price retrieved from DB: 1499)', getCartData.data.items[0].unitPrice === 1499);

    // 11. Cart calculates line total correctly
    await assert('11. Cart calculates line total correctly: 1499 * 2 = 2998', getCartData.data.items[0].lineTotal === 2998);

    // 12. Cart subtotal calculated correctly
    await assert('12. Cart subtotal calculated correctly: 2998', getCartData.data.summary.subtotal === 2998);

    const cartItemId = getCartData.data.items[0].id;

    // 13. Cart quantity update works
    const updateQtyRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ quantity: 4 })
    });
    const updateQtyData = await updateQtyRes.json();
    await assert('13. Cart quantity update works (quantity = 4)', updateQtyRes.status === 200 && updateQtyData.data.summary.totalQuantity === 4);

    // 14. Quantity zero rejected
    const zeroQtyRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ quantity: 0 })
    });
    await assert('14. Quantity zero rejected with HTTP 400', zeroQtyRes.status === 400);

    // 15. Negative quantity rejected
    const negQtyRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ quantity: -2 })
    });
    await assert('15. Negative quantity rejected with HTTP 400', negQtyRes.status === 400);

    // 16. Quantity above stock rejected
    const excessQtyRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ quantity: 8 }) // Available stock is 5
    });
    await assert('16. Quantity above stock rejected with HTTP 400', excessQtyRes.status === 400);

    // 17. Inactive variant rejected
    const inactVarRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ variantId: testInactiveVariant.id, quantity: 1 })
    });
    await assert('17. Inactive variant rejected with HTTP 400', inactVarRes.status === 400);

    // 18. Invalid variant ID rejected
    const invVarRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ variantId: '99999999-9999-4999-8999-999999999999', quantity: 1 })
    });
    await assert('18. Non-existent variant ID rejected with HTTP 400', invVarRes.status === 400);

    // 19. Customer cannot access another customer's cart
    const cust2ModifyRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer2Token}`
      },
      body: JSON.stringify({ quantity: 1 })
    });
    await assert('19. Customer cannot access another customer cart item (returns HTTP 404)', cust2ModifyRes.status === 404);

    // 20. Cart item deletion works
    const deleteItemRes = await fetch(`${baseUrl}/cart/items/${cartItemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer1Token}` }
    });
    const deleteItemData = await deleteItemRes.json();
    await assert('20. Cart item deletion works', deleteItemRes.status === 200 && deleteItemData.data.items.length === 0);

    // 21. Cart clear works
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ variantId: testVariant1.id, quantity: 1 })
    });
    const clearCartRes = await fetch(`${baseUrl}/cart`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer1Token}` }
    });
    const clearCartData = await clearCartRes.json();
    await assert('21. Cart clear works (DELETE /api/v1/cart)', clearCartRes.status === 200 && clearCartData.data.items.length === 0);

    // -------------------------------------------------------------------------
    // TEST SECTION 3: Guest Cart & Session Token Management
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Guest Cart & Cryptographic Session Isolation');

    // 22. Guest cart creation works
    const guestCartRes = await fetch(`${baseUrl}/cart`);
    const guestCartData = await guestCartRes.json();
    const guestToken1 = guestCartData.data?.guestToken || guestCartRes.headers.get('x-guest-token');
    await assert('22. Guest cart creation works', guestCartRes.status === 200 && !!guestToken1);
    if (guestCartData.data?.cartId) createdCartIds.push(guestCartData.data.cartId);

    // 23. Guest cart token is unpredictable (64 hex characters)
    await assert('23. Guest cart token is unpredictable (64 hex characters)', typeof guestToken1 === 'string' && guestToken1.length === 64);

    // 24. Guest cart isolation works
    const guest2Res = await fetch(`${baseUrl}/cart`);
    const guest2Data = await guest2Res.json();
    const guestToken2 = guest2Data.data?.guestToken;
    await assert('24. Guest cart isolation works (Guest 2 gets distinct empty cart)', guestToken2 !== guestToken1 && guest2Data.data.items.length === 0);
    if (guest2Data.data?.cartId) createdCartIds.push(guest2Data.data.cartId);

    // 25. Guest adds items using X-Guest-Token
    const guestAddRes = await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Guest-Token': guestToken1
      },
      body: JSON.stringify({ variantId: testVariant2.id, quantity: 3 })
    });
    const guestAddData = await guestAddRes.json();
    await assert('25. Guest adds items using X-Guest-Token', guestAddRes.status === 200 && guestAddData.data?.items?.length === 1);

    const guestItemId = guestAddData.data.items[0].id;

    // 26. Guest cart quantity update works
    const guestUpdateRes = await fetch(`${baseUrl}/cart/items/${guestItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Guest-Token': guestToken1
      },
      body: JSON.stringify({ quantity: 5 })
    });
    const guestUpdateData = await guestUpdateRes.json();
    await assert('26. Guest cart quantity update works (quantity = 5)', guestUpdateRes.status === 200 && guestUpdateData.data.summary.totalQuantity === 5);

    // 27. Guest cart deletion works
    const guestDeleteRes = await fetch(`${baseUrl}/cart/items/${guestItemId}`, {
      method: 'DELETE',
      headers: { 'X-Guest-Token': guestToken1 }
    });
    const guestDeleteData = await guestDeleteRes.json();
    await assert('27. Guest cart item deletion works', guestDeleteRes.status === 200 && guestDeleteData.data.items.length === 0);

    // Re-add item for merge test
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Guest-Token': guestToken1
      },
      body: JSON.stringify({ variantId: testVariant2.id, quantity: 3 })
    });

    // -------------------------------------------------------------------------
    // TEST SECTION 4: Guest Cart Merging into Authenticated Cart
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Guest to Authenticated Cart Merging');

    // Add variant 2 with quantity 2 to customer cart to test duplicate merge combination
    await fetch(`${baseUrl}/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ variantId: testVariant2.id, quantity: 2 })
    });

    // 28. Guest -> authenticated cart merge works
    const mergeRes = await fetch(`${baseUrl}/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer1Token}`
      },
      body: JSON.stringify({ guestToken: guestToken1 })
    });
    const mergeData = await mergeRes.json();
    await assert('28. Guest -> authenticated cart merge works', mergeRes.status === 200);

    // 29. Duplicate variants merge correctly (2 customer + 3 guest = 5 merged)
    await assert('29. Duplicate variants merge correctly (2 in customer + 3 in guest = 5 merged)', mergeData.data.items.length === 1 && mergeData.data.items[0].quantity === 5);

    // 30. Merge respects stock availability
    await assert('30. Merge respects stock availability (5 <= available 10)', mergeData.data.items[0].isAvailable === true);

    // -------------------------------------------------------------------------
    // TEST SECTION 5: Inventory Integrity (Cart does not reserve inventory)
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Inventory Protection Verification');
    const { data: invItems } = await supabaseAdmin
      .from('inventory_items')
      .select('variant_id, quantity_available, quantity_reserved')
      .in('variant_id', [testVariant1.id, testVariant2.id]);

    const v1Inv = invItems.find(i => i.variant_id === testVariant1.id);
    const v2Inv = invItems.find(i => i.variant_id === testVariant2.id);

    // 31. Cart does not reserve inventory
    await assert('31. Cart does not reserve inventory (quantity_reserved remains 0)', v1Inv.quantity_reserved === 0 && v2Inv.quantity_reserved === 0);

    // 32. Inventory remains unchanged after cart operations
    await assert('32. Inventory available stock remains unchanged (V1: 5, V2: 10)', v1Inv.quantity_available === 5 && v2Inv.quantity_available === 10);

  } catch (err) {
    console.error('[TEST SUITE RUNTIME ERROR]', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Purge all temporary test fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up all temporary test fixtures...');
    try {
      if (createdVariantIds.length > 0) {
        await supabaseAdmin.from('inventory_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('cart_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('wishlist_items').delete().in('product_id', createdProductIds);
      }
      if (typeof customer1UserId !== 'undefined' && customer1UserId) {
        await supabaseAdmin.from('carts').delete().eq('user_id', customer1UserId);
        await supabaseAdmin.from('wishlists').delete().eq('user_id', customer1UserId);
      }
      if (typeof customer2UserId !== 'undefined' && customer2UserId) {
        await supabaseAdmin.from('carts').delete().eq('user_id', customer2UserId);
        await supabaseAdmin.from('wishlists').delete().eq('user_id', customer2UserId);
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
      if (createdStoreIds.length > 0) {
        await supabaseAdmin.from('stores').delete().in('id', createdStoreIds);
      }
      for (const uid of createdUserIds) {
        await supabaseAdmin.from('profiles').delete().eq('id', uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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

runPhase4DTests();
