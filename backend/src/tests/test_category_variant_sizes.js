import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

let server;
let baseUrl;
const createdCategoryIds = [];
const createdSubcategoryIds = [];
const createdProductIds = [];
const createdVariantIds = [];
const createdUserIds = [];

const ts = Date.now();
const adminEmail = `cat_var_admin_${ts}@menx.com`;
const customerEmail = `customer_${ts}@menx.com`;
const password = 'Password123!';
let adminToken;
let customerToken;
let testColor1;
let testColor2;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

async function main() {
  console.log('================================================================');
  console.log('  MENX COMPREHENSIVE CATEGORY-DRIVEN VARIANT SIZES TEST SUITE');
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
    // 1. Setup Admin & Customer Accounts
    console.log('\n>>> 1. Initializing Admin & Customer Accounts...');
    const { data: adminAuthData, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'CatSize', last_name: 'Admin' }
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
    console.log(' [PASS] Super Admin authenticated');

    // Customer setup
    const { data: custAuthData, error: custAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Normal', last_name: 'Customer' }
    });
    if (custAuthErr) throw new Error(`Failed to create customer user: ${custAuthErr.message}`);
    const customerUserId = custAuthData.user.id;
    createdUserIds.push(customerUserId);

    const { data: custLogin, error: custLoginErr } = await authClient.auth.signInWithPassword({
      email: customerEmail,
      password
    });
    if (custLoginErr) throw new Error(`Customer login failed: ${custLoginErr.message}`);
    customerToken = custLogin.session.access_token;
    console.log(' [PASS] Customer authenticated');

    // 2. Load Colors
    const { data: colors, error: colorErr } = await supabaseAdmin
      .from('colors')
      .select('id, name, hex_code')
      .limit(2);
    if (colorErr || !colors || colors.length < 2) throw new Error('Failed to load color fixtures');
    testColor1 = colors[0];
    testColor2 = colors[1];

    // 3. Load Brand
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .limit(1)
      .single();
    if (brandErr || !brand) throw new Error('Failed to load brand fixture');

    // Helper to get size by name and category_type
    async function getSize(name, categoryType) {
      const { data, error } = await supabaseAdmin
        .from('sizes')
        .select('id, name, category_type, sort_order')
        .eq('name', name)
        .eq('category_type', categoryType)
        .single();
      if (error || !data) throw new Error(`Size '${name}' (${categoryType}) not found in DB: ${error?.message}`);
      return data;
    }

    // Helper to create test product
    async function createTestProduct(categorySlug, title) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id, name, slug')
        .eq('slug', categorySlug)
        .single();
      if (!cat) throw new Error(`Category '${categorySlug}' not found`);

      let { data: subcat } = await supabaseAdmin
        .from('subcategories')
        .select('id')
        .eq('category_id', cat.id)
        .limit(1)
        .single();

      if (!subcat) {
        const { data: newSub } = await supabaseAdmin
          .from('subcategories')
          .insert({
            category_id: cat.id,
            name: `${cat.name} Default Sub`,
            slug: `${cat.slug}-sub-${Date.now()}`
          })
          .select('id')
          .single();
        subcat = newSub;
        if (newSub?.id) createdSubcategoryIds.push(newSub.id);
      }

      const pSlug = `test-sz-${categorySlug}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const prodRes = await fetch(`${baseUrl}/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          title: `${title} ${Date.now()}`,
          slug: pSlug,
          description: `Testing sizes for ${categorySlug}`,
          categoryId: cat.id,
          subcategoryId: subcat.id,
          brandId: brand.id,
          baseMrp: 2999,
          basePrice: 1999,
          status: 'PUBLISHED'
        })
      });
      const prodData = await prodRes.json();
      if (prodRes.status !== 201) throw new Error(`Failed to create product: ${JSON.stringify(prodData)}`);
      createdProductIds.push(prodData.data.id);
      return prodData.data;
    }

    // Helper to create variant
    async function attemptCreateVariant(productId, sizeId, colorId = testColor1.id, skuSuffix = 'SKU', token = adminToken, stock = 10) {
      const uniqueSku = `SKU-${skuSuffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const uniqueBarcode = `BC${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 16);
      const res = await fetch(`${baseUrl}/admin/products/${productId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sizeId,
          colorId,
          sku: uniqueSku,
          barcode: uniqueBarcode,
          mrp: 2999,
          sellingPrice: 1999,
          weightGrams: 300,
          lowStockThreshold: 5,
          initialStock: stock
        })
      });
      const data = await res.json();
      if (res.status === 201 && data.data?.id) {
        createdVariantIds.push(data.data.id);
      }
      return { status: res.status, data };
    }

    console.log('\n>>> 2. Loading All Size Fixtures...');
    const apparelSizes = {
      XS: await getSize('XS', 'APPAREL'),
      S: await getSize('S', 'APPAREL'),
      M: await getSize('M', 'APPAREL'),
      L: await getSize('L', 'APPAREL'),
      XL: await getSize('XL', 'APPAREL'),
      XXL: await getSize('XXL', 'APPAREL'),
      XXXL: await getSize('XXXL', 'APPAREL')
    };

    const bottomSizes = {
      28: await getSize('28', 'BOTTOMWEAR'),
      30: await getSize('30', 'BOTTOMWEAR'),
      32: await getSize('32', 'BOTTOMWEAR'),
      34: await getSize('34', 'BOTTOMWEAR'),
      36: await getSize('36', 'BOTTOMWEAR'),
      38: await getSize('38', 'BOTTOMWEAR'),
      40: await getSize('40', 'BOTTOMWEAR'),
      42: await getSize('42', 'BOTTOMWEAR'),
      44: await getSize('44', 'BOTTOMWEAR')
    };

    const footwearSizes = {
      6: await getSize('6', 'FOOTWEAR'),
      7: await getSize('7', 'FOOTWEAR'),
      8: await getSize('8', 'FOOTWEAR'),
      9: await getSize('9', 'FOOTWEAR'),
      10: await getSize('10', 'FOOTWEAR'),
      11: await getSize('11', 'FOOTWEAR'),
      12: await getSize('12', 'FOOTWEAR')
    };

    const accessorySize = await getSize('One Size', 'ACCESSORIES');

    console.log('\n>>> 3. Testing APPAREL Categories (T-Shirts, Shirts, Jackets, Activewear)...');
    const tShirtProduct = await createTestProduct('t-shirts', 'Premium Cotton T-Shirt');
    
    // Test all apparel sizes accepted for T-Shirts
    for (const [name, sz] of Object.entries(apparelSizes)) {
      const res = await attemptCreateVariant(tShirtProduct.id, sz.id, testColor1.id, `TSHIRT-${name}`);
      assert(res.status === 201, `APPAREL (T-Shirts) accepts ${name} -> PASS`);
    }

    // Test waist size 28 rejected for APPAREL
    const tShirtRes28 = await attemptCreateVariant(tShirtProduct.id, bottomSizes['28'].id, testColor1.id, 'TSHIRT-28-FAIL');
    assert(tShirtRes28.status === 400, 'APPAREL rejects waist size 28 -> PASS (HTTP 400)');

    console.log('\n>>> 4. Testing BOTTOMWEAR Categories (Jeans, Trousers, Shorts)...');
    const jeansProduct = await createTestProduct('jeans', 'Stretch Slim Jeans');

    // Test all bottomwear sizes accepted for Jeans (28-44)
    for (const [name, sz] of Object.entries(bottomSizes)) {
      const res = await attemptCreateVariant(jeansProduct.id, sz.id, testColor1.id, `JEANS-${name}`);
      assert(res.status === 201, `BOTTOMWEAR (Jeans) accepts waist size ${name} -> PASS`);
    }

    // Test apparel sizes XS, S, M, L, XL rejected for BOTTOMWEAR
    for (const sName of ['XS', 'S', 'M', 'L', 'XL']) {
      const res = await attemptCreateVariant(jeansProduct.id, apparelSizes[sName].id, testColor1.id, `JEANS-${sName}-FAIL`);
      assert(res.status === 400, `BOTTOMWEAR rejects ${sName} -> PASS (HTTP 400)`);
      assert(res.data?.message?.toLowerCase().includes('not valid'), `Rejection message clearly indicates size incompatible for category: "${res.data?.message}"`);
    }

    console.log('\n>>> 5. Testing FOOTWEAR Categories...');
    const footwearProduct = await createTestProduct('footwear', 'Classic Leather Loafers');

    // Test footwear sizes 6-12 accepted
    for (const [name, sz] of Object.entries(footwearSizes)) {
      const res = await attemptCreateVariant(footwearProduct.id, sz.id, testColor1.id, `SHOE-${name}`);
      assert(res.status === 201, `FOOTWEAR accepts shoe size ${name} -> PASS`);
    }

    // Test M rejected for FOOTWEAR
    const shoeResM = await attemptCreateVariant(footwearProduct.id, apparelSizes['M'].id, testColor1.id, 'SHOE-M-FAIL');
    assert(shoeResM.status === 400, 'FOOTWEAR rejects size M -> PASS (HTTP 400)');

    console.log('\n>>> 6. Testing ACCESSORIES Categories...');
    const accessoryProduct = await createTestProduct('accessories', 'Braided Leather Belt');
    const accRes = await attemptCreateVariant(accessoryProduct.id, accessorySize.id, testColor1.id, 'ACC-ONESIZE');
    assert(accRes.status === 201, 'ACCESSORIES accepts "One Size" -> PASS');

    // Test M rejected for ACCESSORIES
    const accResM = await attemptCreateVariant(accessoryProduct.id, apparelSizes['M'].id, testColor1.id, 'ACC-M-FAIL');
    assert(accResM.status === 400, 'ACCESSORIES rejects size M -> PASS (HTTP 400)');

    console.log('\n>>> 7. Testing ETHNIC WEAR Categories (S-XXXL allowed, XS rejected)...');
    const ethnicProduct = await createTestProduct('ethnic-wear', 'Royal Silk Kurta');
    const ethnicResL = await attemptCreateVariant(ethnicProduct.id, apparelSizes['L'].id, testColor1.id, 'ETHNIC-L');
    assert(ethnicResL.status === 201, 'ETHNIC WEAR accepts size L -> PASS');

    const ethnicResXS = await attemptCreateVariant(ethnicProduct.id, apparelSizes['XS'].id, testColor1.id, 'ETHNIC-XS-FAIL');
    assert(ethnicResXS.status === 400, 'ETHNIC WEAR rejects size XS -> PASS (HTTP 400)');

    console.log('\n>>> 8. Testing Duplicate Size + Color Prevention...');
    // Create first variant (Jeans + Size 30 + Color 2)
    const dupTestProduct = await createTestProduct('jeans', 'Duplicate Prevention Test Jeans');
    const firstRes = await attemptCreateVariant(dupTestProduct.id, bottomSizes['30'].id, testColor2.id, 'DUP-1');
    assert(firstRes.status === 201, 'Initial variant created -> PASS');

    // Attempt duplicate with same size and color
    const secondRes = await attemptCreateVariant(dupTestProduct.id, bottomSizes['30'].id, testColor2.id, 'DUP-2');
    assert(secondRes.status === 409 || secondRes.status === 400, 'Duplicate size + color rejected -> PASS');
    assert(
      secondRes.data?.message?.toLowerCase().includes('already exists'),
      `Error message mentions duplicate: "${secondRes.data?.message}"`
    );

    console.log('\n>>> 9. Testing Editing Existing Variant...');
    const variantToEdit = firstRes.data.data.id;
    const editRes = await fetch(`${baseUrl}/admin/variants/${variantToEdit}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sellingPrice: 1799,
        mrp: 2799,
        weightGrams: 350
      })
    });
    const editData = await editRes.json();
    assert(editRes.status === 200, 'Edit variant succeeds -> PASS');
    assert(editData.data.selling_price === 1799 || editData.data.sellingPrice === 1799, 'Variant updated correctly');

    console.log('\n>>> 10. Testing Stock and Inventory Record Creation...');
    // Verify inventory_items record exists and stock is recorded
    const { data: invItem, error: invErr } = await supabaseAdmin
      .from('inventory_items')
      .select('*')
      .eq('variant_id', variantToEdit)
      .single();
    assert(!invErr && invItem, 'Single-inventory item created for variant -> PASS');
    assert(invItem.quantity_available === 10, 'Initial quantity matches 10 -> PASS');

    // Test Stock Adjustment via API
    const adjRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        variantId: variantToEdit,
        quantity: 5,
        movementType: 'PURCHASE_RECEIPT',
        reason: 'Test stock increase'
      })
    });
    const adjData = await adjRes.json();
    assert(adjRes.status === 200 || adjRes.status === 201, 'Stock adjustment succeeds -> PASS');

    const { data: updatedInv } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity_available')
      .eq('variant_id', variantToEdit)
      .single();
    assert(updatedInv.quantity_available === 15, 'Updated inventory quantity available is 15 -> PASS');

    console.log('\n>>> 11. Testing Invalid Backend Requests & Missing Data...');
    // Non-existent size UUID
    const invalidSizeRes = await attemptCreateVariant(tShirtProduct.id, '00000000-0000-0000-0000-000000000000', testColor1.id, 'INVAL-SIZE');
    assert(invalidSizeRes.status === 400, 'Non-existent size ID is rejected -> PASS (HTTP 400)');

    // Missing required fields (no colorId)
    const missingColorRes = await fetch(`${baseUrl}/admin/products/${tShirtProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: apparelSizes['M'].id,
        sku: `SKU-MISSING-${Date.now()}`,
        mrp: 1999,
        sellingPrice: 1499
      })
    });
    assert(missingColorRes.status === 400, 'Missing required colorId is rejected -> PASS (HTTP 400)');

    console.log('\n>>> 12. Testing Unauthorized User Protection...');
    const unauthRes = await attemptCreateVariant(tShirtProduct.id, apparelSizes['L'].id, testColor2.id, 'UNAUTH-FAIL', customerToken);
    assert(unauthRes.status === 403 || unauthRes.status === 401, 'Customer forbidden from creating variants -> PASS (HTTP 403/401)');

    console.log('\n================================================================');
    console.log('  ALL 12 TEST SUITE SECTIONS PASSED SUCCESSFULLY! ✅');
    console.log('================================================================\n');

  } finally {
    console.log('>>> Cleaning up test fixtures...');
    try {
      if (createdVariantIds.length > 0) {
        await supabaseAdmin.from('stock_movements').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('inventory_items').delete().in('variant_id', createdVariantIds);
        await supabaseAdmin.from('product_variants').delete().in('id', createdVariantIds);
      }
      if (createdProductIds.length > 0) {
        await supabaseAdmin.from('products').delete().in('id', createdProductIds);
      }
      if (createdSubcategoryIds.length > 0) {
        await supabaseAdmin.from('subcategories').delete().in('id', createdSubcategoryIds);
      }
      if (createdUserIds.length > 0) {
        for (const uid of createdUserIds) {
          await supabaseAdmin.auth.admin.deleteUser(uid);
        }
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    if (server) {
      server.close();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
  });
