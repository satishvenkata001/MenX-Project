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
const adminEmail = `cat_size_admin_${ts}@menx.com`;
const password = 'Password123!';
let adminToken;
let testColor;

function assert(condition, message) {
  if (!condition) {
    console.error(` [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(` [PASS] ${message}`);
}

async function main() {
  console.log('================================================================');
  console.log('  MENX CATEGORY-BASED PRODUCT VARIANT SIZE VALIDATION TEST SUITE');
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
    console.log('\n>>> 1. Initializing Admin User & Common Fixtures...');
    const { data: adminAuthData, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Size', last_name: 'Admin' }
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

    // 2. Load / Ensure Color
    const { data: color, error: colorErr } = await supabaseAdmin
      .from('colors')
      .select('id, name, hex_code')
      .limit(1)
      .single();
    if (colorErr || !color) throw new Error('Failed to load color fixture');
    testColor = color;

    // 3. Load / Ensure Brand
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .limit(1)
      .single();
    if (brandErr || !brand) throw new Error('Failed to load brand fixture');

    // Helper to fetch size by name & category_type
    async function getSize(name, categoryType) {
      const { data, error } = await supabaseAdmin
        .from('sizes')
        .select('id, name, category_type')
        .eq('name', name)
        .eq('category_type', categoryType)
        .single();
      if (error || !data) throw new Error(`Size '${name}' (${categoryType}) not found in DB`);
      return data;
    }

    // Helper to create product for a category
    async function createTestProduct(categorySlug, title) {
      // Find category
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('id, name, slug')
        .eq('slug', categorySlug)
        .single();
      if (!cat) throw new Error(`Category '${categorySlug}' not found`);

      // Find subcategory for category
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
            slug: `${cat.slug}-default-${Date.now()}`
          })
          .select('id')
          .single();
        subcat = newSub;
        if (newSub?.id) createdSubcategoryIds.push(newSub.id);
      }

      const pSlug = `test-cat-sz-${categorySlug}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
          baseMrp: 1999,
          basePrice: 1499,
          status: 'PUBLISHED'
        })
      });
      const prodData = await prodRes.json();
      if (prodRes.status !== 201) throw new Error(`Failed to create product: ${JSON.stringify(prodData)}`);
      createdProductIds.push(prodData.data.id);
      return prodData.data;
    }

    // Helper to attempt variant creation
    async function attemptCreateVariant(productId, sizeId, skuSuffix) {
      const uniqueSku = `SKU-${skuSuffix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const uniqueBarcode = `BC${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 16);
      const res = await fetch(`${baseUrl}/admin/products/${productId}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sizeId,
          colorId: testColor.id,
          sku: uniqueSku,
          barcode: uniqueBarcode,
          mrp: 1999,
          sellingPrice: 1499,
          weightGrams: 300,
          lowStockThreshold: 5,
          initialStock: 10
        })
      });
      const data = await res.json();
      if (res.status === 201 && data.data?.id) {
        createdVariantIds.push(data.data.id);
      }
      return { status: res.status, data };
    }

    console.log('\n>>> 2. Executing Category-Specific Size Tests...');

    // Load Size Fixtures
    const sizeM_Apparel = await getSize('M', 'APPAREL');
    const sizeXL_Apparel = await getSize('XL', 'APPAREL');
    const sizeXS_Apparel = await getSize('XS', 'APPAREL');
    const sizeL_Apparel = await getSize('L', 'APPAREL');
    const size32_Bottom = await getSize('32', 'BOTTOMWEAR');
    const size34_Bottom = await getSize('34', 'BOTTOMWEAR');
    const size36_Bottom = await getSize('36', 'BOTTOMWEAR');
    const size9_Footwear = await getSize('9', 'FOOTWEAR');
    const sizeOneSize_Accessory = await getSize('One Size', 'ACCESSORIES');

    // Test 1: T-Shirt variant creation with M -> PASS
    const tShirtProduct = await createTestProduct('t-shirts', 'Classic Crew Neck T-Shirt');
    const tShirtResM = await attemptCreateVariant(tShirtProduct.id, sizeM_Apparel.id, 'TSHIRT-M');
    assert(tShirtResM.status === 201, '1. T-Shirt variant creation with M -> PASS');

    // Test 2: Shirt variant creation with XL -> PASS
    const shirtProduct = await createTestProduct('shirts', 'Oxford Casual Shirt');
    const shirtResXL = await attemptCreateVariant(shirtProduct.id, sizeXL_Apparel.id, 'SHIRT-XL');
    assert(shirtResXL.status === 201, '2. Shirt variant creation with XL -> PASS');

    // Test 3: Jeans variant creation with 32 -> PASS
    const jeansProduct = await createTestProduct('jeans', 'Slim Fit Denim Jeans');
    const jeansRes32 = await attemptCreateVariant(jeansProduct.id, size32_Bottom.id, 'JEANS-32');
    assert(jeansRes32.status === 201, '3. Jeans variant creation with 32 -> PASS');

    // Test 4: Jeans variant creation with M -> MUST FAIL (HTTP 400)
    const jeansResM = await attemptCreateVariant(jeansProduct.id, sizeM_Apparel.id, 'JEANS-M-FAIL');
    assert(jeansResM.status === 400, '4. Jeans variant creation with M -> MUST FAIL (HTTP 400)');
    assert(
      jeansResM.data?.message?.toLowerCase().includes('not valid'),
      '4b. Error message explicitly states size is invalid for category'
    );

    // Test 5: Trousers variant creation with 34 -> PASS
    const trousersProduct = await createTestProduct('trousers', 'Formal Chino Trousers');
    const trousersRes34 = await attemptCreateVariant(trousersProduct.id, size34_Bottom.id, 'TROUSERS-34');
    assert(trousersRes34.status === 201, '5. Trousers variant creation with 34 -> PASS');

    // Test 6: Shorts variant creation with 36 -> PASS
    const shortsProduct = await createTestProduct('shorts', 'Casual Summer Shorts');
    const shortsRes36 = await attemptCreateVariant(shortsProduct.id, size36_Bottom.id, 'SHORTS-36');
    assert(shortsRes36.status === 201, '6. Shorts variant creation with 36 -> PASS');

    // Test 7: Footwear variant creation with 9 -> PASS
    const footwearProduct = await createTestProduct('footwear', 'Derby Leather Shoes');
    const footwearRes9 = await attemptCreateVariant(footwearProduct.id, size9_Footwear.id, 'FOOTWEAR-9');
    assert(footwearRes9.status === 201, '7. Footwear variant creation with 9 -> PASS');

    // Test 8: Footwear variant creation with M -> MUST FAIL (HTTP 400)
    const footwearResM = await attemptCreateVariant(footwearProduct.id, sizeM_Apparel.id, 'FOOTWEAR-M-FAIL');
    assert(footwearResM.status === 400, '8. Footwear variant creation with M -> MUST FAIL (HTTP 400)');

    // Test 9: Accessories with One Size -> PASS
    const accessoryProduct = await createTestProduct('accessories', 'Classic Leather Belt');
    const accResOneSize = await attemptCreateVariant(accessoryProduct.id, sizeOneSize_Accessory.id, 'ACC-ONESIZE');
    assert(accResOneSize.status === 201, '9. Accessories variant creation with One Size -> PASS');

    // Test 10: T-Shirt with waist size 32 -> MUST FAIL (HTTP 400)
    const tShirtRes32 = await attemptCreateVariant(tShirtProduct.id, size32_Bottom.id, 'TSHIRT-32-FAIL');
    assert(tShirtRes32.status === 400, '10. T-Shirt variant creation with waist size 32 -> MUST FAIL (HTTP 400)');

    // Test 11: Ethnic Wear with XS -> MUST FAIL (HTTP 400) (no XS for Ethnic Wear)
    const ethnicProduct = await createTestProduct('ethnic-wear', 'Silk Festive Kurta');
    const ethnicResXS = await attemptCreateVariant(ethnicProduct.id, sizeXS_Apparel.id, 'ETHNIC-XS-FAIL');
    assert(ethnicResXS.status === 400, '11. Ethnic Wear variant creation with XS -> MUST FAIL (HTTP 400)');

    // Test 12: Ethnic Wear with L -> PASS
    const ethnicResL = await attemptCreateVariant(ethnicProduct.id, sizeL_Apparel.id, 'ETHNIC-L');
    assert(ethnicResL.status === 201, '12. Ethnic Wear variant creation with L -> PASS');

    // Test 13: Jackets with XL -> PASS
    const jacketProduct = await createTestProduct('jackets', 'Bomber Leather Jacket');
    const jacketResXL = await attemptCreateVariant(jacketProduct.id, sizeXL_Apparel.id, 'JACKET-XL');
    assert(jacketResXL.status === 201, '13. Jackets variant creation with XL -> PASS');

    // Test 14: Activewear with XS -> PASS
    const activewearProduct = await createTestProduct('activewear', 'Performance Training Tee');
    const activewearResXS = await attemptCreateVariant(activewearProduct.id, sizeXS_Apparel.id, 'ACTIVE-XS');
    assert(activewearResXS.status === 201, '14. Activewear variant creation with XS -> PASS');

    // Test 15: Retrieve variant and verify size payload representation
    const getVarRes = await fetch(`${baseUrl}/products/${jeansProduct.id}/variants`);
    const varData = await getVarRes.json();
    assert(getVarRes.status === 200, '15. Public variants endpoint returns HTTP 200');
    assert(
      varData.data.some(v => v.size?.name === '32' || v.size === '32'),
      '15b. Jeans variant correctly reflects size "32"'
    );

    console.log('\n================================================================');
    console.log('  ALL CATEGORY-BASED SIZE VALIDATION TESTS PASSED (15 / 15)');
    console.log('================================================================\n');

  } finally {
    // Cleanup temporary test records
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
