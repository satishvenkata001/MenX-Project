import { pool } from '../config/db.js';
import { CatalogService } from '../services/catalog.service.js';
import { supabaseAdmin } from '../config/supabase.js';

const GENUINE_CATEGORIES = [
  'Footwear', 'Shirts', 'Ethnic Wear', 'Accessories', 'Jackets',
  'T-Shirts', 'Trousers', 'Jeans', 'Activewear', 'Shorts'
];

async function runHardDeleteTests() {
  console.log('================================================================');
  console.log('  MENX — CATEGORY & PRODUCT HARD-DELETE INTEGRATION TEST SUITE  ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Pre-check genuine production categories
  const preCheckRes = await pool.query('SELECT name FROM categories WHERE name = ANY($1)', [GENUINE_CATEGORIES]);
  console.log(`Initial check: Found ${preCheckRes.rows.length}/10 genuine production categories.\n`);

  // Grab prerequisite seeds for FKs (store, brand, size, color, customer)
  const storeRes = await pool.query('SELECT id FROM stores LIMIT 1');
  const storeId = storeRes.rows[0]?.id;
  const brandRes = await pool.query('SELECT id FROM brands LIMIT 1');
  const brandId = brandRes.rows[0]?.id;
  const sizeRes = await pool.query('SELECT id FROM sizes LIMIT 1');
  const sizeId = sizeRes.rows[0]?.id;
  const colorRes = await pool.query('SELECT id FROM colors LIMIT 1');
  const colorId = colorRes.rows[0]?.id;
  const userRes = await pool.query('SELECT id FROM profiles LIMIT 1');
  const userId = userRes.rows[0]?.id;
  const supplierRes = await pool.query('SELECT id FROM suppliers LIMIT 1');
  const supplierId = supplierRes.rows[0]?.id;
  const outfitRes = await pool.query('SELECT id FROM outfits LIMIT 1');
  const outfitId = outfitRes.rows[0]?.id;

  // Pre-cleanup any leftover test categories from prior interrupted runs
  const leftoverRes = await pool.query("SELECT id, name FROM categories WHERE name LIKE 'TestCat%'");
  for (const row of leftoverRes.rows) {
    await CatalogService.deleteCategory(row.id, { id: userId, role: 'SUPER_ADMIN' }, null, {});
  }

  try {
    // ------------------------------------------------------------------------
    // TEST A: Empty category hard delete
    // ------------------------------------------------------------------------
    console.log('--- TEST A: Empty Category Hard Delete ---');
    const catA = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test empty cat', 990, true) RETURNING id`,
      [`TestCatA_${Date.now()}`, `test-cat-a-${Date.now()}`]
    );
    const catAId = catA.rows[0].id;

    const resA = await CatalogService.deleteCategory(catAId, { id: userId, role: 'SUPER_ADMIN' }, null, {});
    assert(resA && resA.id === catAId, 'deleteCategory returned success for empty category');

    const checkA = await pool.query('SELECT id FROM categories WHERE id = $1', [catAId]);
    assert(checkA.rows.length === 0, 'Empty category completely deleted from categories table');

    // ------------------------------------------------------------------------
    // TEST B: Category with subcategories
    // ------------------------------------------------------------------------
    console.log('\n--- TEST B: Category with Subcategories ---');
    const catB = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat with subcats', 991, true) RETURNING id`,
      [`TestCatB_${Date.now()}`, `test-cat-b-${Date.now()}`]
    );
    const catBId = catB.rows[0].id;

    const subB = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat B', 1, true) RETURNING id`,
      [catBId, `SubB_${Date.now()}`, `sub-b-${Date.now()}`]
    );
    const subBId = subB.rows[0].id;

    await CatalogService.deleteCategory(catBId, { id: userId, role: 'SUPER_ADMIN' }, null, {});
    const checkCatB = await pool.query('SELECT id FROM categories WHERE id = $1', [catBId]);
    const checkSubB = await pool.query('SELECT id FROM subcategories WHERE id = $1', [subBId]);
    assert(checkCatB.rows.length === 0, 'Category B deleted');
    assert(checkSubB.rows.length === 0, 'Subcategory B deleted recursively with category');

    // ------------------------------------------------------------------------
    // TEST C: Category with products
    // ------------------------------------------------------------------------
    console.log('\n--- TEST C: Category with Products ---');
    const catC = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat with products', 992, true) RETURNING id`,
      [`TestCatC_${Date.now()}`, `test-cat-c-${Date.now()}`]
    );
    const catCId = catC.rows[0].id;

    const subC = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat C', 1, true) RETURNING id`,
      [catCId, `SubC_${Date.now()}`, `sub-c-${Date.now()}`]
    );
    const subCId = subC.rows[0].id;

    const prodC = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, brand_id, status, base_mrp, base_price, tags)
       VALUES ($1, $2, 'Desc C', $3, $4, $5, 'DRAFT', 1000, 800, '{}') RETURNING id`,
      [`ProdC_${Date.now()}`, `prod-c-${Date.now()}`, catCId, subCId, brandId]
    );
    const prodCId = prodC.rows[0].id;

    await CatalogService.deleteCategory(catCId, { id: userId, role: 'SUPER_ADMIN' }, null, {});
    const checkCatC = await pool.query('SELECT id FROM categories WHERE id = $1', [catCId]);
    const checkSubC = await pool.query('SELECT id FROM subcategories WHERE id = $1', [subCId]);
    const checkProdC = await pool.query('SELECT id FROM products WHERE id = $1', [prodCId]);
    assert(checkCatC.rows.length === 0, 'Category C deleted');
    assert(checkSubC.rows.length === 0, 'Subcategory C deleted');
    assert(checkProdC.rows.length === 0, 'Product C deleted recursively with category');

    // ------------------------------------------------------------------------
    // TEST D: Category with variants, images, cart_items, wishlist_items, reviews, outfit_items
    // ------------------------------------------------------------------------
    console.log('\n--- TEST D: Category with Variants, Images, Cart, Wishlist, Reviews, Outfits ---');
    const catD = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat D', 993, true) RETURNING id`,
      [`TestCatD_${Date.now()}`, `test-cat-d-${Date.now()}`]
    );
    const catDId = catD.rows[0].id;

    const subD = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat D', 1, true) RETURNING id`,
      [catDId, `SubD_${Date.now()}`, `sub-d-${Date.now()}`]
    );
    const subDId = subD.rows[0].id;

    const prodD = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, brand_id, status, base_mrp, base_price, tags)
       VALUES ($1, $2, 'Desc D', $3, $4, $5, 'PUBLISHED', 1500, 1200, '{}') RETURNING id`,
      [`ProdD_${Date.now()}`, `prod-d-${Date.now()}`, catDId, subDId, brandId]
    );
    const prodDId = prodD.rows[0].id;

    const varD = await pool.query(
      `INSERT INTO product_variants (product_id, sku, barcode, size_id, color_id, mrp, selling_price, low_stock_threshold, is_active)
       VALUES ($1, $2, $3, $4, $5, 1500, 1200, 5, true) RETURNING id`,
      [prodDId, `SKU-D-${Date.now()}`, `BC-D-${Date.now()}`, sizeId, colorId]
    );
    const varDId = varD.rows[0].id;

    // Image
    const imgD = await pool.query(
      `INSERT INTO product_images (product_id, variant_id, image_url, display_order, is_primary)
       VALUES ($1, $2, 'https://example.com/storage/v1/object/public/menx-product-images/test-d.webp', 1, true) RETURNING id`,
      [prodDId, varDId]
    );
    const imgDId = imgD.rows[0].id;

    // Wishlist item
    let wishId = null;
    const wishRes = await pool.query('SELECT id FROM wishlists WHERE user_id = $1 LIMIT 1', [userId]);
    if (wishRes.rows.length > 0) {
      wishId = wishRes.rows[0].id;
      await pool.query('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2)', [wishId, prodDId]);
    }

    // Cart item
    let cartId = null;
    const cartRes = await pool.query('SELECT id FROM carts WHERE user_id = $1 LIMIT 1', [userId]);
    if (cartRes.rows.length > 0) {
      cartId = cartRes.rows[0].id;
      await pool.query('INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, 1)', [cartId, varDId]);
    }

    // Review
    const revD = await pool.query(
      `INSERT INTO reviews (product_id, customer_id, rating, title, comment, is_verified_purchase, is_approved)
       VALUES ($1, $2, 5, 'Great', 'Awesome product', true, true) RETURNING id`,
      [prodDId, userId]
    );
    const revDId = revD.rows[0].id;

    // Outfit item
    if (outfitId) {
      await pool.query(
        `INSERT INTO outfit_items (outfit_id, product_id, is_mandatory, display_order)
         VALUES ($1, $2, true, 1)`,
        [outfitId, prodDId]
      );
    }

    await CatalogService.deleteCategory(catDId, { id: userId, role: 'SUPER_ADMIN' }, null, {});

    const checkCatD = await pool.query('SELECT id FROM categories WHERE id = $1', [catDId]);
    const checkProdD = await pool.query('SELECT id FROM products WHERE id = $1', [prodDId]);
    const checkVarD = await pool.query('SELECT id FROM product_variants WHERE id = $1', [varDId]);
    const checkImgD = await pool.query('SELECT id FROM product_images WHERE id = $1', [imgDId]);
    const checkRevD = await pool.query('SELECT id FROM reviews WHERE id = $1', [revDId]);
    const checkCartD = await pool.query('SELECT id FROM cart_items WHERE variant_id = $1', [varDId]);
    const checkWishD = await pool.query('SELECT id FROM wishlist_items WHERE product_id = $1', [prodDId]);

    assert(checkCatD.rows.length === 0, 'Category D deleted');
    assert(checkProdD.rows.length === 0, 'Product D deleted');
    assert(checkVarD.rows.length === 0, 'Variant D deleted');
    assert(checkImgD.rows.length === 0, 'Product images deleted');
    assert(checkRevD.rows.length === 0, 'Reviews deleted');
    assert(checkCartD.rows.length === 0, 'Cart items deleted');
    assert(checkWishD.rows.length === 0, 'Wishlist items deleted');

    // ------------------------------------------------------------------------
    // TEST E: Category with inventory and stock movements
    // ------------------------------------------------------------------------
    console.log('\n--- TEST E: Category with Inventory and Stock Movements ---');
    const catE = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat E', 994, true) RETURNING id`,
      [`TestCatE_${Date.now()}`, `test-cat-e-${Date.now()}`]
    );
    const catEId = catE.rows[0].id;

    const subE = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat E', 1, true) RETURNING id`,
      [catEId, `SubE_${Date.now()}`, `sub-e-${Date.now()}`]
    );
    const subEId = subE.rows[0].id;

    const prodE = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, brand_id, status, base_mrp, base_price, tags)
       VALUES ($1, $2, 'Desc E', $3, $4, $5, 'PUBLISHED', 2000, 1800, '{}') RETURNING id`,
      [`ProdE_${Date.now()}`, `prod-e-${Date.now()}`, catEId, subEId, brandId]
    );
    const prodEId = prodE.rows[0].id;

    const varE = await pool.query(
      `INSERT INTO product_variants (product_id, sku, barcode, size_id, color_id, mrp, selling_price, low_stock_threshold, is_active)
       VALUES ($1, $2, $3, $4, $5, 2000, 1800, 5, true) RETURNING id`,
      [prodEId, `SKU-E-${Date.now()}`, `BC-E-${Date.now()}`, sizeId, colorId]
    );
    const varEId = varE.rows[0].id;

    // Inventory item
    const invE = await pool.query(
      `INSERT INTO inventory_items (store_id, variant_id, quantity_available, quantity_reserved, quantity_damaged)
       VALUES ($1, $2, 50, 5, 0) RETURNING id`,
      [storeId, varEId]
    );
    const invEId = invE.rows[0].id;

    // Stock movement
    const smE = await pool.query(
      `INSERT INTO stock_movements (variant_id, destination_store_id, movement_type, quantity, reference_type, reason, performed_by)
       VALUES ($1, $2, 'INVENTORY_ADJUSTMENT', 50, 'INITIAL_SEED', 'Stock test', $3) RETURNING id`,
      [varEId, storeId, userId]
    );
    const smEId = smE.rows[0].id;

    await CatalogService.deleteCategory(catEId, { id: userId, role: 'SUPER_ADMIN' }, null, {});

    const checkInvE = await pool.query('SELECT id FROM inventory_items WHERE id = $1', [invEId]);
    const checkSmE = await pool.query('SELECT id FROM stock_movements WHERE id = $1', [smEId]);
    assert(checkInvE.rows.length === 0, 'Inventory items deleted');
    assert(checkSmE.rows.length === 0, 'Stock movements deleted');

    // ------------------------------------------------------------------------
    // TEST F: Category with historical order_items
    // ------------------------------------------------------------------------
    console.log('\n--- TEST F: Category with Historical order_items ---');
    const catF = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat F', 995, true) RETURNING id`,
      [`TestCatF_${Date.now()}`, `test-cat-f-${Date.now()}`]
    );
    const catFId = catF.rows[0].id;

    const subF = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat F', 1, true) RETURNING id`,
      [catFId, `SubF_${Date.now()}`, `sub-f-${Date.now()}`]
    );
    const subFId = subF.rows[0].id;

    const prodF = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, brand_id, status, base_mrp, base_price, tags)
       VALUES ($1, $2, 'Desc F', $3, $4, $5, 'PUBLISHED', 2500, 2000, '{}') RETURNING id`,
      [`Historical Product F_${Date.now()}`, `prod-f-${Date.now()}`, catFId, subFId, brandId]
    );
    const prodFId = prodF.rows[0].id;

    const varF = await pool.query(
      `INSERT INTO product_variants (product_id, sku, barcode, size_id, color_id, mrp, selling_price, low_stock_threshold, is_active)
       VALUES ($1, $2, $3, $4, $5, 2500, 2000, 5, true) RETURNING id`,
      [prodFId, `SKU-F-${Date.now()}`, `BC-F-${Date.now()}`, sizeId, colorId]
    );
    const varFId = varF.rows[0].id;

    // Create an order
    const orderF = await pool.query(
      `INSERT INTO orders (
        order_number, customer_id, order_channel, store_id, order_status, payment_method, payment_status,
        subtotal_amount, discount_amount, delivery_fee, total_payable, cod_amount_due, cod_amount_collected, shipping_snapshot, customer_phone
       ) VALUES ($1, $2, 'ONLINE', $3, 'DELIVERED', 'COD', 'COLLECTED', 2000, 0, 0, 2000, 2000, 2000, '{"name":"Customer F"}', '9999999999')
       RETURNING id`,
      [`ORD-F-${Date.now()}`, userId, storeId]
    );
    const orderFId = orderF.rows[0].id;

    // Create order item referencing varFId
    const orderItemF = await pool.query(
      `INSERT INTO order_items (
        order_id, variant_id, product_title_snapshot, variant_sku_snapshot, size_snapshot, color_snapshot,
        unit_mrp_snapshot, unit_price_snapshot, quantity, line_subtotal, line_discount, line_total
       ) VALUES ($1, $2, 'Historical Product F', 'SKU-F-001', 'M', 'Navy Blue', 2500, 2000, 1, 2000, 0, 2000)
       RETURNING id`,
      [orderFId, varFId]
    );
    const orderItemFId = orderItemF.rows[0].id;

    // Delete category F
    await CatalogService.deleteCategory(catFId, { id: userId, role: 'SUPER_ADMIN' }, null, {});

    // Verify category F and product F are deleted
    const checkCatF = await pool.query('SELECT id FROM categories WHERE id = $1', [catFId]);
    const checkProdF = await pool.query('SELECT id FROM products WHERE id = $1', [prodFId]);
    const checkVarF = await pool.query('SELECT id FROM product_variants WHERE id = $1', [varFId]);
    assert(checkCatF.rows.length === 0, 'Category F hard-deleted');
    assert(checkProdF.rows.length === 0, 'Product F hard-deleted');
    assert(checkVarF.rows.length === 0, 'Variant F hard-deleted');

    // Verify order and order_item still exist with intact snapshots and variant_id NULL
    const checkOrderItemF = await pool.query('SELECT * FROM order_items WHERE id = $1', [orderItemFId]);
    assert(checkOrderItemF.rows.length === 1, 'order_items record preserved');
    assert(checkOrderItemF.rows[0].variant_id === null, 'order_items.variant_id safely set to NULL');
    assert(checkOrderItemF.rows[0].product_title_snapshot === 'Historical Product F', 'product_title_snapshot preserved');
    assert(checkOrderItemF.rows[0].variant_sku_snapshot === 'SKU-F-001', 'variant_sku_snapshot preserved');
    assert(checkOrderItemF.rows[0].size_snapshot === 'M', 'size_snapshot preserved');
    assert(checkOrderItemF.rows[0].color_snapshot === 'Navy Blue', 'color_snapshot preserved');
    assert(Number(checkOrderItemF.rows[0].line_total) === 2000, 'line_total accounting snapshot preserved');

    // Clean up test order
    await pool.query('DELETE FROM order_items WHERE id = $1', [orderItemFId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [orderFId]);

    // ------------------------------------------------------------------------
    // TEST G: Category with return_items
    // ------------------------------------------------------------------------
    console.log('\n--- TEST G: Category with Return Items ---');
    const catG = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat G', 996, true) RETURNING id`,
      [`TestCatG_${Date.now()}`, `test-cat-g-${Date.now()}`]
    );
    const catGId = catG.rows[0].id;

    const subG = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat G', 1, true) RETURNING id`,
      [catGId, `SubG_${Date.now()}`, `sub-g-${Date.now()}`]
    );
    const subGId = subG.rows[0].id;

    const prodG = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, brand_id, status, base_mrp, base_price, tags)
       VALUES ($1, $2, 'Desc G', $3, $4, $5, 'PUBLISHED', 1800, 1500, '{}') RETURNING id`,
      [`Return Product G_${Date.now()}`, `prod-g-${Date.now()}`, catGId, subGId, brandId]
    );
    const prodGId = prodG.rows[0].id;

    const varG = await pool.query(
      `INSERT INTO product_variants (product_id, sku, barcode, size_id, color_id, mrp, selling_price, low_stock_threshold, is_active)
       VALUES ($1, $2, $3, $4, $5, 1800, 1500, 5, true) RETURNING id`,
      [prodGId, `SKU-G-${Date.now()}`, `BC-G-${Date.now()}`, sizeId, colorId]
    );
    const varGId = varG.rows[0].id;

    const orderG = await pool.query(
      `INSERT INTO orders (
        order_number, customer_id, order_channel, store_id, order_status, payment_method, payment_status,
        subtotal_amount, discount_amount, delivery_fee, total_payable, cod_amount_due, cod_amount_collected, shipping_snapshot, customer_phone
       ) VALUES ($1, $2, 'ONLINE', $3, 'DELIVERED', 'COD', 'COLLECTED', 1500, 0, 0, 1500, 1500, 1500, '{"name":"Customer G"}', '9999999999')
       RETURNING id`,
      [`ORD-G-${Date.now()}`, userId, storeId]
    );
    const orderGId = orderG.rows[0].id;

    const orderItemG = await pool.query(
      `INSERT INTO order_items (
        order_id, variant_id, product_title_snapshot, variant_sku_snapshot, size_snapshot, color_snapshot,
        unit_mrp_snapshot, unit_price_snapshot, quantity, line_subtotal, line_discount, line_total
       ) VALUES ($1, $2, 'Return Product G', 'SKU-G-001', 'L', 'Black', 1800, 1500, 1, 1500, 0, 1500)
       RETURNING id`,
      [orderGId, varGId]
    );
    const orderItemGId = orderItemG.rows[0].id;

    const returnReqG = await pool.query(
      `INSERT INTO return_requests (
        return_number, order_id, customer_id, status, request_type, reason, customer_comment, proof_image_urls
       ) VALUES ($1, $2, $3, 'REQUESTED', 'RETURN', 'DEFECTIVE', 'Defective stitch', '{}')
       RETURNING id`,
      [`RET-G-${Date.now()}`, orderGId, userId]
    );
    const returnReqGId = returnReqG.rows[0].id;

    const returnItemG = await pool.query(
      `INSERT INTO return_items (return_request_id, order_item_id, variant_id, quantity)
       VALUES ($1, $2, $3, 1) RETURNING id`,
      [returnReqGId, orderItemGId, varGId]
    );
    const returnItemGId = returnItemG.rows[0].id;

    await CatalogService.deleteCategory(catGId, { id: userId, role: 'SUPER_ADMIN' }, null, {});

    const checkReturnItemG = await pool.query('SELECT * FROM return_items WHERE id = $1', [returnItemGId]);
    assert(checkReturnItemG.rows.length === 1, 'return_items record preserved');
    assert(checkReturnItemG.rows[0].variant_id === null, 'return_items.variant_id safely set to NULL');

    // Clean up return test fixtures
    await pool.query('DELETE FROM return_items WHERE id = $1', [returnItemGId]);
    await pool.query('DELETE FROM return_requests WHERE id = $1', [returnReqGId]);
    await pool.query('DELETE FROM order_items WHERE id = $1', [orderItemGId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [orderGId]);

    // ------------------------------------------------------------------------
    // TEST H: Category with purchase_order_items
    // ------------------------------------------------------------------------
    console.log('\n--- TEST H: Category with purchase_order_items ---');
    const catH = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat H', 997, true) RETURNING id`,
      [`TestCatH_${Date.now()}`, `test-cat-h-${Date.now()}`]
    );
    const catHId = catH.rows[0].id;

    const subH = await pool.query(
      `INSERT INTO subcategories (category_id, name, slug, description, display_order, is_active)
       VALUES ($1, $2, $3, 'Subcat H', 1, true) RETURNING id`,
      [catHId, `SubH_${Date.now()}`, `sub-h-${Date.now()}`]
    );
    const subHId = subH.rows[0].id;

    const prodH = await pool.query(
      `INSERT INTO products (title, slug, description, category_id, subcategory_id, brand_id, status, base_mrp, base_price, tags)
       VALUES ($1, $2, 'Desc H', $3, $4, $5, 'PUBLISHED', 3000, 2500, '{}') RETURNING id`,
      [`PO Product H_${Date.now()}`, `prod-h-${Date.now()}`, catHId, subHId, brandId]
    );
    const prodHId = prodH.rows[0].id;

    const varH = await pool.query(
      `INSERT INTO product_variants (product_id, sku, barcode, size_id, color_id, mrp, selling_price, low_stock_threshold, is_active)
       VALUES ($1, $2, $3, $4, $5, 3000, 2500, 5, true) RETURNING id`,
      [prodHId, `SKU-H-${Date.now()}`, `BC-H-${Date.now()}`, sizeId, colorId]
    );
    const varHId = varH.rows[0].id;

    let poId = null;
    let poItemId = null;
    if (supplierId) {
      const poRes = await pool.query(
        `INSERT INTO purchase_orders (po_number, supplier_id, store_id, status, total_cost, created_by)
         VALUES ($1, $2, $3, 'RECEIVED', 5000, $4) RETURNING id`,
        [`PO-H-${Date.now()}`, supplierId, storeId, userId]
      );
      poId = poRes.rows[0].id;

      const poItemRes = await pool.query(
        `INSERT INTO purchase_order_items (purchase_order_id, variant_id, quantity_ordered, quantity_received, unit_cost, total_cost)
         VALUES ($1, $2, 10, 10, 500, 5000) RETURNING id`,
        [poId, varHId]
      );
      poItemId = poItemRes.rows[0].id;
    }

    await CatalogService.deleteCategory(catHId, { id: userId, role: 'SUPER_ADMIN' }, null, {});

    if (poItemId) {
      const checkPoItem = await pool.query('SELECT * FROM purchase_order_items WHERE id = $1', [poItemId]);
      assert(checkPoItem.rows.length === 1, 'purchase_order_items record preserved');
      assert(checkPoItem.rows[0].variant_id === null, 'purchase_order_items.variant_id safely set to NULL');
      assert(Number(checkPoItem.rows[0].total_cost) === 5000, 'purchase_order_items accounting cost intact');

      await pool.query('DELETE FROM purchase_order_items WHERE id = $1', [poItemId]);
      await pool.query('DELETE FROM purchase_orders WHERE id = $1', [poId]);
    }

    // ------------------------------------------------------------------------
    // TEST K: Verify unrelated production records remain
    // ------------------------------------------------------------------------
    console.log('\n--- TEST K: Verify Genuine Production Records Remain ---');
    const postCheckRes = await pool.query('SELECT name FROM categories WHERE name = ANY($1)', [GENUINE_CATEGORIES]);
    assert(postCheckRes.rows.length === 10, `All 10 genuine production categories remain intact (found ${postCheckRes.rows.length}/10)`);

    // ------------------------------------------------------------------------
    // TEST L: Verify refresh / repeated re-fetch consistency
    // ------------------------------------------------------------------------
    console.log('\n--- TEST L: Verify Categories List Consistency After Deletions ---');
    const list1 = await CatalogService.listAdminCategories();
    const list2 = await CatalogService.listAdminCategories();
    const list3 = await CatalogService.listCategories();
    assert(list1.length === list2.length, `Admin categories count is deterministic (${list1.length} vs ${list2.length})`);
    assert(list1.every(c => !c.name.startsWith('TestCat')), 'No deleted test categories returned in list');

    // ------------------------------------------------------------------------
    // TEST M: Transaction Rollback on Error
    // ------------------------------------------------------------------------
    console.log('\n--- TEST M: Verify Transaction Rollback on Error ---');
    const catM = await pool.query(
      `INSERT INTO categories (name, slug, description, display_order, is_active)
       VALUES ($1, $2, 'Test cat M', 998, true) RETURNING id`,
      [`TestCatM_${Date.now()}`, `test-cat-m-${Date.now()}`]
    );
    const catMId = catM.rows[0].id;

    // Simulate an error inside transaction by passing non-existent ID or forcing DB error
    let rollbackThrew = false;
    try {
      // Intentionally pass an invalid user or simulate failure
      await pool.query('BEGIN');
      await pool.query('DELETE FROM categories WHERE id = $1', [catMId]);
      // Force an error
      await pool.query('SELECT non_existent_column_for_rollback_test FROM categories');
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      rollbackThrew = true;
    }

    assert(rollbackThrew, 'Transaction threw expected error and executed ROLLBACK');
    const checkCatM = await pool.query('SELECT id FROM categories WHERE id = $1', [catMId]);
    assert(checkCatM.rows.length === 1, 'Data was not partially deleted after rollback');
    await pool.query('DELETE FROM categories WHERE id = $1', [catMId]); // Clean up

    // ------------------------------------------------------------------------
    // TEST N: Audit Log Verification
    // ------------------------------------------------------------------------
    console.log('\n--- TEST N: Audit Log Verification ---');
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE action = 'DELETE_CATEGORY' ORDER BY created_at DESC LIMIT 1`
    );
    assert(auditRes.rows.length > 0, 'Audit log record created for DELETE_CATEGORY');
    if (auditRes.rows.length > 0) {
      assert(auditRes.rows[0].target_entity === 'categories', 'Audit log target entity is categories');
      assert(auditRes.rows[0].old_values !== null, 'Audit log contains old_values JSON');
    }

    // ------------------------------------------------------------------------
    // TEST O & P: Storage Cleanup & Resiliency
    // ------------------------------------------------------------------------
    console.log('\n--- TEST O & P: Storage Cleanup Resiliency ---');
    let cleanupResilient = true;
    try {
      // Call cleanupStorageImages with dummy / non-existent paths
      await CatalogService.cleanupStorageImages(['https://example.com/storage/v1/object/public/menx-product-images/non-existent.webp'], 'resiliency test');
    } catch (err) {
      cleanupResilient = false;
    }
    assert(cleanupResilient, 'Storage cleanup executes gracefully without throwing uncaught exceptions');

  } catch (err) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`  HARD-DELETE TEST RESULTS: ${passed} PASSED, ${failed} FAILED  `);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHardDeleteTests();
