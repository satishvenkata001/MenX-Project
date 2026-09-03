import { pool } from '../config/db.js';

async function inspectColumns() {
  try {
    const tables = [
      'categories', 'subcategories', 'products', 'product_variants',
      'inventory_items', 'stock_movements', 'product_images',
      'cart_items', 'wishlist_items', 'reviews', 'outfit_items',
      'order_items', 'return_items', 'return_requests', 'return_status_history',
      'orders', 'order_status_history', 'purchase_order_items', 'purchase_orders'
    ];

    const res = await pool.query(`
      SELECT 
        table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position;
    `, [tables]);

    const tableMap = {};
    for (const row of res.rows) {
      if (!tableMap[row.table_name]) tableMap[row.table_name] = [];
      tableMap[row.table_name].push(`${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
    }

    console.log('--- TABLE SCHEMAS ---');
    for (const [t, cols] of Object.entries(tableMap)) {
      console.log(`\nTable: ${t}`);
      console.log('  ' + cols.join('\n  '));
    }

  } catch (err) {
    console.error('Error inspecting columns:', err);
  } finally {
    await pool.end();
  }
}

inspectColumns();
