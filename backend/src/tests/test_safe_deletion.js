import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runSafeDeletionTests() {
  console.log('================================================================');
  console.log('       MENX SAFE ADMIN PRODUCT & CATEGORY DELETION TEST SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  console.log(`[TEST SERVER] Running test server on port ${port}\n`);

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

  // Scoped tracking for cleanup
  const createdUserIds = [];
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];
  const createdOrderIds = [];
  const createdPoIds = [];
  const createdReturnIds = [];
  const createdSupplierIds = [];

  let customerToken = null;
  let adminToken = null;
  let customerUserId = null;
  let adminUserId = null;

  let testStoreId = null;

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP: Test Users (Admin & Customer)
    // -------------------------------------------------------------------------
    console.log('>>> 1. Initializing Test Accounts & Fixtures...');
    const now = Date.now();
    const customerEmail = `del.cust.${now}@menxfashion.com`;
    const adminEmail = `del.admin.${now}@menxfashion.com`;
    const password = 'Password123!Secure';

    // Customer
    const { data: custAuth, error: custAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'DeleteCust', last_name: 'Tester' }
    });
    if (custAuthErr) throw new Error(`Customer creation failed: ${custAuthErr.message}`);
    customerUserId = custAuth.user.id;
    createdUserIds.push(customerUserId);

    const custClient = createAuthClient();
    const { data: custLogin, error: custLoginErr } = await custClient.auth.signInWithPassword({
      email: customerEmail,
      password
    });
    if (custLoginErr) throw new Error(`Customer login failed: ${custLoginErr.message}`);
    customerToken = custLogin.session.access_token;

    // Admin
    const { data: adminAuth, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'DeleteAdmin', last_name: 'Tester' }
    });
    if (adminAuthErr) throw new Error(`Admin creation failed: ${adminAuthErr.message}`);
    adminUserId = adminAuth.user.id;
    createdUserIds.push(adminUserId);

    await new Promise(r => setTimeout(r, 300));
    await supabaseAdmin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', adminUserId);

    const adminClient = createAuthClient();
    const { data: adminLogin, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    if (adminLoginErr) throw new Error(`Admin login failed: ${adminLoginErr.message}`);
    adminToken = adminLogin.session.access_token;

    // Store for inventory / orders
    const { data: stores } = await supabaseAdmin.from('stores').select('id').limit(1);
    testStoreId = stores && stores.length > 0 ? stores[0].id : null;

    // Create a base test category, subcategory, brand, size, color
    const { data: testCat } = await supabaseAdmin.from('categories').insert({
      name: `Del-Test-Cat-${now}`,
      slug: `del-test-cat-${now}`,
      description: 'Category for deletion tests',
      is_active: true
    }).select().single();
    createdCategoryIds.push(testCat.id);

    const { data: testSub } = await supabaseAdmin.from('subcategories').insert({
      category_id: testCat.id,
      name: `Del-Test-Sub-${now}`,
      slug: `del-test-sub-${now}`,
      is_active: true
    }).select().single();
    createdSubcategoryIds.push(testSub.id);

    const { data: testBrand } = await supabaseAdmin.from('brands').insert({
      name: `Del-Test-Brand-${now}`,
      slug: `del-test-brand-${now}`,
      is_active: true
    }).select().single();
    createdBrandIds.push(testBrand.id);

    const { data: testSize } = await supabaseAdmin.from('sizes').insert({
      name: `DelSize-${now}`,
      category_type: 'DEL_TEST',
      sort_order: 1
    }).select().single();
    createdSizeIds.push(testSize.id);

    const { data: testColor } = await supabaseAdmin.from('colors').insert({
      name: `DelColor-${now}`,
      hex_code: '#123456'
    }).select().single();
    createdColorIds.push(testColor.id);

    // -------------------------------------------------------------------------
    // 2. TEST: Admin Deletes Unreferenced Product (with variants, inventory, images)
    // -------------------------------------------------------------------------
    console.log('\n>>> 2. Testing Unreferenced Product Deletion...');
    const { data: prod1 } = await supabaseAdmin.from('products').insert({
      title: `Del-Prod-1-${now}`,
      slug: `del-prod-1-${now}`,
      description: 'Product 1 to be cleanly deleted',
      category_id: testCat.id,
      subcategory_id: testSub.id,
      brand_id: testBrand.id,
      status: 'PUBLISHED',
      base_mrp: 1200,
      base_price: 999
    }).select().single();
    createdProductIds.push(prod1.id);

    const { data: var1 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prod1.id,
      sku: `DEL-SKU-1-${now}`,
      barcode: `DEL-BAR-1-${now}`,
      size_id: testSize.id,
      color_id: testColor.id,
      mrp: 1200,
      selling_price: 999
    }).select().single();
    createdVariantIds.push(var1.id);

    if (testStoreId) {
      await supabaseAdmin.from('inventory_items').insert({
        store_id: testStoreId,
        variant_id: var1.id,
        quantity_available: 50
      });
    }

    const { data: img1 } = await supabaseAdmin.from('product_images').insert({
      product_id: prod1.id,
      variant_id: var1.id,
      image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800',
      display_order: 0,
      is_primary: true
    }).select().single();

    // Call DELETE /api/v1/admin/products/:id
    const delProd1Res = await fetch(`${baseUrl}/admin/products/${prod1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const delProd1Data = await delProd1Res.json();

    await assert('Admin DELETE /api/v1/admin/products/:id returns HTTP 200', delProd1Res.status === 200);
    await assert('Response contains success status', delProd1Data.status === 'success');

    // Verify product is gone from DB
    const { data: checkProd1 } = await supabaseAdmin.from('products').select('id').eq('id', prod1.id).single();
    await assert('Product record removed from database', checkProd1 === null);

    // Verify variants and inventory items are gone
    const { data: checkVar1 } = await supabaseAdmin.from('product_variants').select('id').eq('id', var1.id).single();
    await assert('Variant record removed from database', checkVar1 === null);

    if (testStoreId) {
      const { data: checkInv1 } = await supabaseAdmin.from('inventory_items').select('id').eq('variant_id', var1.id);
      await assert('Inventory record removed from database', (checkInv1 || []).length === 0);
    }

    // -------------------------------------------------------------------------
    // 3. TEST: Product with order_items Hard Deletion & Snapshot Preservation
    // -------------------------------------------------------------------------
    console.log('\n>>> 3. Testing Historical Order Preservation (order_items)...');
    const { data: prod2 } = await supabaseAdmin.from('products').insert({
      title: `Del-Prod-Order-${now}`,
      slug: `del-prod-order-${now}`,
      description: 'Product referenced by customer order',
      category_id: testCat.id,
      subcategory_id: testSub.id,
      brand_id: testBrand.id,
      status: 'PUBLISHED',
      base_mrp: 1500,
      base_price: 1200
    }).select().single();
    createdProductIds.push(prod2.id);

    const { data: var2 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prod2.id,
      sku: `DEL-SKU-ORD-${now}`,
      barcode: `DEL-BAR-ORD-${now}`,
      size_id: testSize.id,
      color_id: testColor.id,
      mrp: 1500,
      selling_price: 1200
    }).select().single();
    createdVariantIds.push(var2.id);

    // Create an order referencing var2
    const { data: order1 } = await supabaseAdmin.from('orders').insert({
      order_number: `ORD-DEL-${now}`,
      customer_id: customerUserId,
      store_id: testStoreId,
      order_status: 'CONFIRMED',
      payment_method: 'COD',
      payment_status: 'PENDING',
      subtotal_amount: 1200,
      total_payable: 1200,
      cod_amount_due: 1200,
      customer_phone: '9876543210',
      shipping_snapshot: { name: 'Test User', address: '123 Test St' }
    }).select().single();
    createdOrderIds.push(order1.id);

    const { data: orderItem1 } = await supabaseAdmin.from('order_items').insert({
      order_id: order1.id,
      variant_id: var2.id,
      product_title_snapshot: prod2.title,
      variant_sku_snapshot: var2.sku,
      size_snapshot: 'DelSize',
      color_snapshot: 'DelColor',
      unit_mrp_snapshot: 1500,
      unit_price_snapshot: 1200,
      quantity: 1,
      line_subtotal: 1200,
      line_total: 1200
    }).select().single();

    const delProd2Res = await fetch(`${baseUrl}/admin/products/${prod2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const delProd2Data = await delProd2Res.json();

    await assert('Product with order_items permanently deleted with HTTP 200', delProd2Res.status === 200);
    await assert('Response contains success status', delProd2Data.status === 'success');

    // Verify product and variant are deleted
    const { data: checkProd2 } = await supabaseAdmin.from('products').select('id').eq('id', prod2.id).single();
    await assert('Product permanently deleted from database', checkProd2 === null);
    const { data: checkVar2 } = await supabaseAdmin.from('product_variants').select('id').eq('id', var2.id).single();
    await assert('Variant permanently deleted from database', checkVar2 === null);

    // Verify order_items record preserved with variant_id set to NULL and snapshot intact
    const { data: checkOrderItem1 } = await supabaseAdmin.from('order_items').select('*').eq('id', orderItem1.id).single();
    await assert('order_items record preserved', checkOrderItem1 !== null);
    await assert('order_items.variant_id set to NULL', checkOrderItem1 && checkOrderItem1.variant_id === null);
    await assert('order_items title snapshot preserved', checkOrderItem1 && checkOrderItem1.product_title_snapshot === prod2.title);
    await assert('order_items sku snapshot preserved', checkOrderItem1 && checkOrderItem1.variant_sku_snapshot === var2.sku);
    await assert('order_items line total intact', checkOrderItem1 && Number(checkOrderItem1.line_total) === 1200);

    // -------------------------------------------------------------------------
    // 4. TEST: Product with purchase_order_items Hard Deletion
    // -------------------------------------------------------------------------
    console.log('\n>>> 4. Testing Purchase Order Preservation (purchase_order_items)...');
    const { data: prod3 } = await supabaseAdmin.from('products').insert({
      title: `Del-Prod-PO-${now}`,
      slug: `del-prod-po-${now}`,
      description: 'Product referenced by purchase order',
      category_id: testCat.id,
      subcategory_id: testSub.id,
      brand_id: testBrand.id,
      status: 'PUBLISHED',
      base_mrp: 1800,
      base_price: 1500
    }).select().single();
    createdProductIds.push(prod3.id);

    const { data: var3 } = await supabaseAdmin.from('product_variants').insert({
      product_id: prod3.id,
      sku: `DEL-SKU-PO-${now}`,
      barcode: `DEL-BAR-PO-${now}`,
      size_id: testSize.id,
      color_id: testColor.id,
      mrp: 1800,
      selling_price: 1500
    }).select().single();
    createdVariantIds.push(var3.id);

    // Create supplier & purchase order
    const { data: supplier } = await supabaseAdmin.from('suppliers').insert({
      name: `Del-Supplier-${now}`,
      phone: '9876543211'
    }).select().single();
    createdSupplierIds.push(supplier.id);

    const { data: po } = await supabaseAdmin.from('purchase_orders').insert({
      po_number: `PO-DEL-${now}`,
      supplier_id: supplier.id,
      store_id: testStoreId,
      status: 'DRAFT',
      total_cost: 1000
    }).select().single();
    createdPoIds.push(po.id);

    const { data: poItem1 } = await supabaseAdmin.from('purchase_order_items').insert({
      purchase_order_id: po.id,
      variant_id: var3.id,
      quantity_ordered: 10,
      unit_cost: 100,
      total_cost: 1000
    }).select().single();

    const delProd3Res = await fetch(`${baseUrl}/admin/products/${prod3.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const delProd3Data = await delProd3Res.json();

    await assert('Product with purchase_order_items permanently deleted with HTTP 200', delProd3Res.status === 200);
    await assert('Response contains success status', delProd3Data.status === 'success');

    const { data: checkPoItem1 } = await supabaseAdmin.from('purchase_order_items').select('*').eq('id', poItem1.id).single();
    await assert('purchase_order_items record preserved', checkPoItem1 !== null);
    await assert('purchase_order_items.variant_id set to NULL', checkPoItem1 && checkPoItem1.variant_id === null);
    await assert('purchase_order_items cost preserved', checkPoItem1 && Number(checkPoItem1.total_cost) === 1000);

    // -------------------------------------------------------------------------
    // 5. TEST: Auth & RBAC Security Checks
    // -------------------------------------------------------------------------
    console.log('\n>>> 5. Testing Authentication & RBAC Security...');
    // Create a throwaway product for auth tests
    const { data: prodAuth } = await supabaseAdmin.from('products').insert({
      title: `Del-Prod-Auth-${now}`,
      slug: `del-prod-auth-${now}`,
      description: 'Product for auth tests',
      category_id: testCat.id,
      subcategory_id: testSub.id,
      brand_id: testBrand.id,
      status: 'PUBLISHED',
      base_mrp: 1000,
      base_price: 800
    }).select().single();
    createdProductIds.push(prodAuth.id);

    // Unauthenticated
    const unauthRes = await fetch(`${baseUrl}/admin/products/${prodAuth.id}`, {
      method: 'DELETE'
    });
    await assert('Unauthenticated product delete returns HTTP 401', unauthRes.status === 401);

    // Customer / non-admin
    const custRes = await fetch(`${baseUrl}/admin/products/${prodAuth.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    await assert('Non-admin product delete returns HTTP 403', custRes.status === 403);

    // Non-existent product
    const notFoundRes = await fetch(`${baseUrl}/admin/products/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    await assert('Deleting non-existent product returns HTTP 404', notFoundRes.status === 404);

    // -------------------------------------------------------------------------
    // 6. TEST: Category Hard Deletion (Recursively Deletes Products & Subcats)
    // -------------------------------------------------------------------------
    console.log('\n>>> 6. Testing Category Hard Deletion...');
    // Category containing products & subcategories (testCat has prodAuth and testSub)
    const delCatRes = await fetch(`${baseUrl}/admin/categories/${testCat.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const delCatData = await delCatRes.json();

    await assert('Category with subcategories & products permanently deleted with HTTP 200', delCatRes.status === 200);
    await assert('Response contains success status', delCatData.status === 'success');

    const { data: checkCatAfter } = await supabaseAdmin.from('categories').select('id').eq('id', testCat.id).single();
    await assert('Category record removed from database', checkCatAfter === null);

    const { data: checkSubAfter } = await supabaseAdmin.from('subcategories').select('id').eq('id', testSub.id).single();
    await assert('Subcategory recursively removed from database', checkSubAfter === null);

    const { data: checkProdAfter } = await supabaseAdmin.from('products').select('id').eq('id', prodAuth.id).single();
    await assert('Product recursively removed from database', checkProdAfter === null);

    // Top-level route DELETE /api/v1/categories/:id test
    const { data: emptyCat2 } = await supabaseAdmin.from('categories').insert({
      name: `Del-Empty-Cat-2-${now}`,
      slug: `del-empty-cat-2-${now}`,
      description: 'Second empty category'
    }).select().single();
    createdCategoryIds.push(emptyCat2.id);

    const delTopLevelRes = await fetch(`${baseUrl}/categories/${emptyCat2.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    await assert('Top-level DELETE /api/v1/categories/:id works with HTTP 200', delTopLevelRes.status === 200);

    // -------------------------------------------------------------------------
    // 7. TEST: Audit Logging Verification
    // -------------------------------------------------------------------------
    console.log('\n>>> 7. Testing Audit Logging...');
    const { data: auditLogs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('actor_id', adminUserId)
      .order('created_at', { ascending: false });

    const prodDelAudit = (auditLogs || []).find(l => l.action === 'DELETE_PRODUCT' && l.target_id === prod1.id);
    await assert('Audit log recorded for product deletion', prodDelAudit !== undefined);
    if (prodDelAudit) {
      await assert('Audit log contains actor_role', prodDelAudit.actor_role === 'SUPER_ADMIN');
      await assert('Audit log contains target_entity products', prodDelAudit.target_entity === 'products');
      await assert('Audit log contains old_values', prodDelAudit.old_values && prodDelAudit.old_values.title === prod1.title);
    }

    const catDelAudit = (auditLogs || []).find(l => l.action === 'DELETE_CATEGORY' && l.target_id === testCat.id);
    await assert('Audit log recorded for category deletion', catDelAudit !== undefined);

  } catch (err) {
    console.error('[TEST SUITE ERROR]', err);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Strictly scoped to created fixtures
    // -------------------------------------------------------------------------
    console.log('\n>>> Cleaning up test fixtures created during this run...');
    try {
      if (createdPoIds.length > 0) {
        await supabaseAdmin.from('purchase_order_items').delete().in('purchase_order_id', createdPoIds);
        await supabaseAdmin.from('purchase_orders').delete().in('id', createdPoIds);
      }
      if (createdSupplierIds.length > 0) {
        await supabaseAdmin.from('suppliers').delete().in('id', createdSupplierIds);
      }
      if (createdOrderIds.length > 0) {
        await supabaseAdmin.from('order_items').delete().in('order_id', createdOrderIds);
        await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
      }
      if (createdVariantIds.length > 0) {
        await supabaseAdmin.from('inventory_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
      }
      if (createdProductIds.length > 0) {
        await supabaseAdmin.from('product_images').delete().in('product_id', createdProductIds);
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
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      console.log(' [PASS] All test-scoped fixtures cleanly purged.');
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

runSafeDeletionTests();
