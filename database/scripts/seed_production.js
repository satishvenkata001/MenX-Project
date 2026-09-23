import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(path.join(__dirname, '..', '..', 'backend', 'package.json'));
const pg = require('pg');
const dotenv = require('dotenv');

// Load environment variables from the backend folder
dotenv.config({ path: path.join(__dirname, '..', '..', 'backend', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set in environment variables.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const manifestPath = path.join(__dirname, '..', 'seeds', 'seed_manifest.json');
const dataPath = path.join(__dirname, '..', 'seeds', 'production_data.json');

const tables = [
  'stock_movements', 'inventory_items', 'product_images', 'product_variants', 'products',
  'colors', 'sizes', 'brands', 'subcategories', 'categories',
  'suppliers', 'stores', 'delivery_zones'
];

// Helper to initialize clean manifest structure
function initManifest() {
  const m = { created: {}, existing: {} };
  for (const t of tables) {
    m.created[t] = [];
    m.existing[t] = [];
  }
  return m;
}

async function getAdminId(client) {
  try {
    const res = await client.query("SELECT id FROM profiles WHERE role = 'SUPER_ADMIN' LIMIT 1");
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
  } catch (err) {
    console.warn('Could not query SUPER_ADMIN profile:', err.message);
  }
  return null;
}

async function seed() {
  console.log('Starting Phase 4H database seeding...');
  
  if (!fs.existsSync(dataPath)) {
    console.error(`Production seed data file not found at: ${dataPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const manifest = initManifest();
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Resolve standard system actor
    const adminId = await getAdminId(client);
    console.log(`Resolved system actor (performed_by): ${adminId || 'NULL'}`);

    // 1. Seed Stores
    console.log('Seeding stores...');
    const storeCodeToId = {};
    for (const store of data.stores) {
      const existing = await client.query('SELECT id FROM stores WHERE code = $1', [store.code]);
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        storeCodeToId[store.code] = id;
        manifest.existing.stores.push(id);
      } else {
        const res = await client.query(`
          INSERT INTO stores (code, name, type, address_line1, city, state, postal_code, phone, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [store.code, store.name, store.type, store.address_line1, store.city, store.state, store.postal_code, store.phone, store.is_active]);
        const id = res.rows[0].id;
        storeCodeToId[store.code] = id;
        manifest.created.stores.push(id);
      }
    }

    // 2. Seed Brands
    console.log('Seeding brands...');
    const brandNameToId = {};
    for (const brand of data.brands) {
      const existing = await client.query('SELECT id FROM brands WHERE slug = $1', [brand.slug]);
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        brandNameToId[brand.name] = id;
        manifest.existing.brands.push(id);
      } else {
        const res = await client.query(`
          INSERT INTO brands (name, slug)
          VALUES ($1, $2)
          RETURNING id
        `, [brand.name, brand.slug]);
        const id = res.rows[0].id;
        brandNameToId[brand.name] = id;
        manifest.created.brands.push(id);
      }
    }

    // 3. Seed Categories & Subcategories
    console.log('Seeding categories and subcategories...');
    const catSlugToId = {};
    const subcatSlugToId = {};
    for (const cat of data.categories) {
      let catId;
      const existingCat = await client.query('SELECT id FROM categories WHERE slug = $1', [cat.slug]);
      if (existingCat.rows.length > 0) {
        catId = existingCat.rows[0].id;
        catSlugToId[cat.slug] = catId;
        manifest.existing.categories.push(catId);
      } else {
        const resCat = await client.query(`
          INSERT INTO categories (name, slug, display_order)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [cat.name, cat.slug, cat.display_order]);
        catId = resCat.rows[0].id;
        catSlugToId[cat.slug] = catId;
        manifest.created.categories.push(catId);
      }

      for (const sub of cat.subcategories) {
        const existingSub = await client.query('SELECT id FROM subcategories WHERE slug = $1', [sub.slug]);
        if (existingSub.rows.length > 0) {
          const subId = existingSub.rows[0].id;
          subcatSlugToId[sub.slug] = subId;
          manifest.existing.subcategories.push(subId);
        } else {
          const resSub = await client.query(`
            INSERT INTO subcategories (category_id, name, slug, display_order)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [catId, sub.name, sub.slug, sub.display_order]);
          const subId = resSub.rows[0].id;
          subcatSlugToId[sub.slug] = subId;
          manifest.created.subcategories.push(subId);
        }
      }
    }

    // 4. Seed Sizes
    console.log('Seeding sizes...');
    const sizeNameToId = {};
    for (const size of data.sizes) {
      const existing = await client.query('SELECT id FROM sizes WHERE name = $1 AND category_type = $2', [size.name, size.category_type]);
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        sizeNameToId[size.name] = id;
        manifest.existing.sizes.push(id);
      } else {
        const res = await client.query(`
          INSERT INTO sizes (name, category_type, sort_order)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [size.name, size.category_type, size.sort_order]);
        const id = res.rows[0].id;
        sizeNameToId[size.name] = id;
        manifest.created.sizes.push(id);
      }
    }

    // 5. Seed Colors
    console.log('Seeding colors...');
    const colorNameToId = {};
    for (const color of data.colors) {
      const existing = await client.query('SELECT id FROM colors WHERE name = $1', [color.name]);
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        colorNameToId[color.name] = id;
        manifest.existing.colors.push(id);
      } else {
        const res = await client.query(`
          INSERT INTO colors (name, hex_code)
          VALUES ($1, $2)
          RETURNING id
        `, [color.name, color.hex_code]);
        const id = res.rows[0].id;
        colorNameToId[color.name] = id;
        manifest.created.colors.push(id);
      }
    }

    // 6. Seed Suppliers
    console.log('Seeding suppliers...');
    const supplierNameToId = {};
    for (const supplier of data.suppliers) {
      const existing = await client.query('SELECT id FROM suppliers WHERE name = $1', [supplier.name]);
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        supplierNameToId[supplier.name] = id;
        manifest.existing.suppliers.push(id);
      } else {
        const res = await client.query(`
          INSERT INTO suppliers (name, contact_person, email, phone, is_active)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [supplier.name, supplier.contact_name, supplier.email, supplier.phone, supplier.is_active]);
        const id = res.rows[0].id;
        supplierNameToId[supplier.name] = id;
        manifest.created.suppliers.push(id);
      }
    }

    // 7. Seed Delivery Zones
    console.log('Seeding delivery zones...');
    for (const zone of data.delivery_zones) {
      const existing = await client.query('SELECT id FROM delivery_zones WHERE pincode_pattern = $1', [zone.pincode_pattern]);
      if (existing.rows.length > 0) {
        manifest.existing.delivery_zones.push(existing.rows[0].id);
      } else {
        const res = await client.query(`
          INSERT INTO delivery_zones (name, pincode_pattern, base_delivery_charge, free_delivery_threshold, estimated_days_min, estimated_days_max, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [zone.name, zone.pincode_pattern, zone.base_delivery_charge, zone.free_delivery_threshold, zone.estimated_days_min, zone.estimated_days_max, zone.is_active]);
        manifest.created.delivery_zones.push(res.rows[0].id);
      }
    }

    // 8. Seed Products, Variants & Inventory
    console.log('Seeding products, variants and inventory...');
    for (const prod of data.products) {
      const brandId = brandNameToId[prod.brand_name];
      const catId = catSlugToId[prod.category_slug];
      const subcatId = subcatSlugToId[prod.subcategory_slug];
      
      let productId;
      const existingProd = await client.query('SELECT id FROM products WHERE slug = $1', [prod.slug]);
      if (existingProd.rows.length > 0) {
        productId = existingProd.rows[0].id;
        manifest.existing.products.push(productId);
      } else {
        const resProd = await client.query(`
          INSERT INTO products (brand_id, category_id, subcategory_id, title, slug, description, status, base_mrp, base_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [brandId, catId, subcatId, prod.title, prod.slug, prod.description, prod.status, prod.base_mrp, prod.base_price]);
        productId = resProd.rows[0].id;
        manifest.created.products.push(productId);
      }

      for (const variant of prod.variants) {
        const sizeId = sizeNameToId[variant.size_name];
        const colorId = colorNameToId[variant.color_name];

        let variantId;
        const existingVar = await client.query('SELECT id FROM product_variants WHERE sku = $1', [variant.sku]);
        if (existingVar.rows.length > 0) {
          variantId = existingVar.rows[0].id;
          manifest.existing.product_variants.push(variantId);
        } else {
          const resVar = await client.query(`
            INSERT INTO product_variants (product_id, size_id, color_id, sku, barcode, mrp, selling_price, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            RETURNING id
          `, [productId, sizeId, colorId, variant.sku, variant.barcode, variant.mrp, variant.selling_price]);
          variantId = resVar.rows[0].id;
          manifest.created.product_variants.push(variantId);
        }

        // Inventory
        for (const [storeCode, qty] of Object.entries(variant.inventory)) {
          const storeId = storeCodeToId[storeCode];
          if (!storeId) continue;

          // Check if inventory record already exists (strict duplicate protection)
          const existingInv = await client.query('SELECT id FROM inventory_items WHERE store_id = $1 AND variant_id = $2', [storeId, variantId]);
          if (existingInv.rows.length > 0) {
            manifest.existing.inventory_items.push(existingInv.rows[0].id);
          } else {
            // Insert inventory item
            const resInv = await client.query(`
              INSERT INTO inventory_items (store_id, variant_id, quantity_available, quantity_reserved, quantity_damaged)
              VALUES ($1, $2, $3, 0, 0)
              RETURNING id
            `, [storeId, variantId, qty]);
            const invId = resInv.rows[0].id;
            manifest.created.inventory_items.push(invId);

            // Log INITIAL_STOCK stock movement referencing supplier
            const supplierId = supplierNameToId[prod.brand_name === 'AeroFit Sport' ? 'Apex Textiles Ltd.' : 'Regal Leather Works'];
            const resMov = await client.query(`
              INSERT INTO stock_movements (variant_id, source_store_id, destination_store_id, movement_type, quantity, reference_type, reference_id, reason, performed_by)
              VALUES ($1, NULL, $2, 'INITIAL_STOCK', $3, 'SUPPLIER', $4, 'Initial database production seed loading', $5)
              RETURNING id
            `, [variantId, storeId, qty, supplierId, adminId]);
            manifest.created.stock_movements.push(resMov.rows[0].id);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');

    // Save manifest file
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Seeding completed! Manifest saved to: ${manifestPath}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding transaction failed and rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

async function clean() {
  console.log('Starting Phase 4H data cleanup...');
  
  if (!fs.existsSync(manifestPath)) {
    console.warn(`No manifest file found at: ${manifestPath}. Nothing to cleanup.`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const client = pool.connect();
  
  try {
    const dbClient = await client;
    await dbClient.query('BEGIN');

    // Delete in reverse order of foreign key constraints
    for (const table of tables) {
      const ids = manifest.created[table] || [];
      if (ids.length > 0) {
        console.log(`Deleting ${ids.length} created records from table '${table}'...`);
        await dbClient.query(`DELETE FROM "${table}" WHERE id = ANY($1::uuid[])`, [ids]);
      }
    }

    await dbClient.query('COMMIT');
    console.log('Cleanup committed successfully.');

    // Remove manifest file
    fs.unlinkSync(manifestPath);
    console.log('Manifest file removed.');
  } catch (err) {
    const dbClient = await client;
    await dbClient.query('ROLLBACK');
    console.error('Cleanup transaction failed and rolled back:', err);
    process.exit(1);
  } finally {
    (await client).release();
  }
}

const arg = process.argv[2];
if (arg === '--seed') {
  seed().then(() => pool.end());
} else if (arg === '--clean') {
  clean().then(() => pool.end());
} else {
  console.log('Usage: node seed_production.js [--seed | --clean]');
  pool.end();
}
