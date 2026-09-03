import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set in backend .env file.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('=== RUNNING MENX PERFORMANCE OPTIMIZATION PHASE 1 MIGRATION ===');
  const client = await pool.connect();
  try {
    // Helper function to check if index exists
    const checkIndexExists = async (indexName) => {
      const res = await client.query(
        'SELECT 1 FROM pg_indexes WHERE schemaname = \'public\' AND indexname = $1',
        [indexName]
      );
      return res.rows.length > 0;
    };

    // 1. orders(shipping_address_id)
    const idxOrdersAddress = 'idx_orders_shipping_address_id';
    if (await checkIndexExists(idxOrdersAddress)) {
      console.log(`[SKIP] Index "${idxOrdersAddress}" already exists.`);
    } else {
      console.log(`[CREATE] Creating index "${idxOrdersAddress}" on orders(shipping_address_id)...`);
      await client.query(`
        CREATE INDEX idx_orders_shipping_address_id 
        ON orders(shipping_address_id)
      `);
      console.log(`[SUCCESS] Created index "${idxOrdersAddress}".`);
    }

    // 2. subcategories(category_id)
    const idxSubcatCategory = 'idx_subcategories_category_id';
    if (await checkIndexExists(idxSubcatCategory)) {
      console.log(`[SKIP] Index "${idxSubcatCategory}" already exists.`);
    } else {
      console.log(`[CREATE] Creating index "${idxSubcatCategory}" on subcategories(category_id)...`);
      await client.query(`
        CREATE INDEX idx_subcategories_category_id 
        ON subcategories(category_id)
      `);
      console.log(`[SUCCESS] Created index "${idxSubcatCategory}".`);
    }

    // 3. products(status, base_price) WHERE status = 'PUBLISHED'
    const idxProductsPrice = 'idx_products_status_price';
    if (await checkIndexExists(idxProductsPrice)) {
      console.log(`[SKIP] Index "${idxProductsPrice}" already exists.`);
    } else {
      console.log(`[CREATE] Creating partial index "${idxProductsPrice}" on products(status, base_price)...`);
      await client.query(`
        CREATE INDEX idx_products_status_price 
        ON products(status, base_price) 
        WHERE status = 'PUBLISHED'
      `);
      console.log(`[SUCCESS] Created index "${idxProductsPrice}".`);
    }

    // 4. Verify indexes
    console.log('\n--- VERIFYING INDEXES ---');
    const verifyRes = await client.query(`
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN ($1, $2, $3)
      ORDER BY tablename, indexname
    `, [idxOrdersAddress, idxSubcatCategory, idxProductsPrice]);
    
    console.table(verifyRes.rows);
    console.log('Migration Phase 1 completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
