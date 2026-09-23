import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function run() {
  const baseUrl = 'http://localhost:5000/api/v1';

  // 1. Create and authenticate Admin user
  const ts = Date.now();
  const adminEmail = `test.admin.${ts}@menxfashion.com`;
  const { data: createdAdmin } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { role: 'SUPER_ADMIN', full_name: 'Bulk Variant Admin Test' }
  });

  await supabaseAdmin
    .from('profiles')
    .update({ role: 'SUPER_ADMIN' })
    .eq('id', createdAdmin.user.id);

  const authClient = createAuthClient();
  const { data: adminLogin } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: 'Password123!'
  });
  const adminToken = adminLogin.session.access_token;

  console.log('=== TEST 1: SETUP TEST PRODUCT ===');
  // Get Category & Subcategory
  const catRes = await pool.query("SELECT id FROM categories WHERE slug = 't-shirts' LIMIT 1");
  const catId = catRes.rows[0].id;
  const subRes = await pool.query("SELECT id FROM subcategories WHERE category_id = $1 LIMIT 1", [catId]);
  const subId = subRes.rows[0].id;

  const testSlug = 'bulk-var-test-' + ts;
  const prodInsert = await pool.query(
    "INSERT INTO products (title, slug, description, category_id, subcategory_id, base_mrp, base_price, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PUBLISHED') RETURNING id, title, slug",
    ['Bulk Variant Test Shirt', testSlug, 'Test Description', catId, subId, 1999, 1499]
  );
  const testProduct = prodInsert.rows[0];
  console.log('Created test product:', testProduct.title, testProduct.id);

  // Get Colors
  const greenRes = await pool.query("SELECT id, name FROM colors WHERE name = 'Olive Green' OR hex_code = '#808000' LIMIT 1");
  const greenColor = greenRes.rows[0];
  const navyRes = await pool.query("SELECT id, name FROM colors WHERE name = 'Navy Blue' LIMIT 1");
  const navyColor = navyRes.rows[0];

  // Get Sizes for T-Shirts
  const sizeM = (await pool.query("SELECT id, name FROM sizes WHERE name = 'M' AND category_type = 'APPAREL' LIMIT 1")).rows[0];
  const sizeL = (await pool.query("SELECT id, name FROM sizes WHERE name = 'L' AND category_type = 'APPAREL' LIMIT 1")).rows[0];
  const sizeXL = (await pool.query("SELECT id, name FROM sizes WHERE name = 'XL' AND category_type = 'APPAREL' LIMIT 1")).rows[0];
  const sizeXXL = (await pool.query("SELECT id, name FROM sizes WHERE name = 'XXL' AND category_type = 'APPAREL' LIMIT 1")).rows[0];

  console.log('\n=== TEST 2: BULK CREATE COLOR GROUP 1 (GREEN: M=2, L=2, XL=5, XXL=3) ===');
  const group1 = [
    { sizeId: sizeM.id, sizeName: 'M', stock: 2 },
    { sizeId: sizeL.id, sizeName: 'L', stock: 2 },
    { sizeId: sizeXL.id, sizeName: 'XL', stock: 5 },
    { sizeId: sizeXXL.id, sizeName: 'XXL', stock: 3 }
  ];

  for (const item of group1) {
    const sku = `${testProduct.slug.slice(0, 8).toUpperCase()}-GRN-${item.sizeName}-${Math.floor(1000 + Math.random() * 9000)}`;
    const barcode = `890${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const res = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: item.sizeId,
        colorId: greenColor.id,
        sku,
        barcode,
        mrp: 1999,
        sellingPrice: 1499,
        weightGrams: 300,
        lowStockThreshold: 5,
        initialStock: item.stock
      })
    });
    console.log(`Created variant ${greenColor.name} + ${item.sizeName} (Stock: ${item.stock}) -> HTTP ${res.status}`);
  }

  console.log('\n=== TEST 3: BULK CREATE COLOR GROUP 2 (NAVY: M=4, L=6, XL=2) ===');
  const group2 = [
    { sizeId: sizeM.id, sizeName: 'M', stock: 4 },
    { sizeId: sizeL.id, sizeName: 'L', stock: 6 },
    { sizeId: sizeXL.id, sizeName: 'XL', stock: 2 }
  ];

  for (const item of group2) {
    const sku = `${testProduct.slug.slice(0, 8).toUpperCase()}-NAVY-${item.sizeName}-${Math.floor(1000 + Math.random() * 9000)}`;
    const barcode = `890${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const res = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        sizeId: item.sizeId,
        colorId: navyColor.id,
        sku,
        barcode,
        mrp: 1999,
        sellingPrice: 1499,
        weightGrams: 300,
        lowStockThreshold: 5,
        initialStock: item.stock
      })
    });
    console.log(`Created variant ${navyColor.name} + ${item.sizeName} (Stock: ${item.stock}) -> HTTP ${res.status}`);
  }

  console.log('\n=== TEST 4: VERIFY ACTIVE VARIANTS AND INVENTORY ===');
  const variantsRes = await fetch(`${baseUrl}/products/${testProduct.id}/variants`);
  const variantsData = await variantsRes.json();
  console.log('Total variants created:', variantsData.data?.length);

  for (const v of variantsData.data) {
    const invRes = await pool.query('SELECT * FROM inventory_items WHERE variant_id = $1', [v.id]);
    const inv = invRes.rows[0];
    console.log(`- ${v.color?.name} | Size: ${v.size?.name} | SKU: ${v.sku} | Price: ₹${v.selling_price} | Stock: ${v.quantity_available} (DB inventory_items: ${inv?.quantity_available})`);
  }

  console.log('\n=== TEST 5: DUPLICATE CREATION PREVENTION ===');
  const dupSku = `DUP-SKU-${Date.now()}`;
  const dupRes = await fetch(`${baseUrl}/admin/products/${testProduct.id}/variants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      sizeId: sizeM.id,
      colorId: greenColor.id,
      sku: dupSku,
      barcode: `890${Date.now().toString().slice(-6)}111`,
      mrp: 1999,
      sellingPrice: 1499,
      initialStock: 10
    })
  });
  console.log('Duplicate Green+M response status (expected 409):', dupRes.status);

  console.log('\n=== TEST 6: EDIT VARIANT SPECIFICATIONS ===');
  const firstVariant = variantsData.data[0];
  const editRes = await fetch(`${baseUrl}/admin/variants/${firstVariant.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      sellingPrice: 1299,
      lowStockThreshold: 3
    })
  });
  console.log('Edit variant sellingPrice to 1299 response status:', editRes.status);

  console.log('\n=== TEST 7: ADJUST STOCK ===');
  const adjustRes = await fetch(`${baseUrl}/admin/inventory/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      variantId: firstVariant.id,
      quantity: 10,
      movementType: 'PURCHASE_RECEIPT',
      reason: 'Batch stock replenishment'
    })
  });
  console.log('Adjust stock response status:', adjustRes.status);

  const updatedVarRes = await fetch(`${baseUrl}/products/${testProduct.id}/variants`);
  const updatedVarData = await updatedVarRes.json();
  const updatedFirst = updatedVarData.data.find(v => v.id === firstVariant.id);
  console.log(`Updated stock for ${updatedFirst.color?.name} ${updatedFirst.size?.name}: ${updatedFirst.quantity_available} (was ${firstVariant.quantity_available})`);

  // Cleanup test products and related data
  console.log('\n=== CLEANUP TEST PRODUCTS & USER ===');
  const allTestProds = await pool.query("SELECT id FROM products WHERE slug LIKE 'bulk-var-test-%'");
  for (const p of allTestProds.rows) {
    const vIdsRes = await pool.query("SELECT id FROM product_variants WHERE product_id = $1", [p.id]);
    const vIds = vIdsRes.rows.map(r => r.id);
    if (vIds.length > 0) {
      await pool.query("DELETE FROM stock_movements WHERE variant_id = ANY($1)", [vIds]);
      await pool.query("DELETE FROM inventory_items WHERE variant_id = ANY($1)", [vIds]);
      await pool.query("DELETE FROM product_variants WHERE product_id = $1", [p.id]);
    }
    await pool.query("DELETE FROM products WHERE id = $1", [p.id]);
  }
  await supabaseAdmin.auth.admin.deleteUser(createdAdmin.user.id);
  console.log('Test product and user deleted cleanly.');

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
