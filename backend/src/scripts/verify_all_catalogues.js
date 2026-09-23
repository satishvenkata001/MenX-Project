import { pool } from '../config/db.js';

async function main() {
  const { rows: prods } = await pool.query(`
    SELECT p.id, p.title, p.slug, p.status, p.base_mrp, p.base_price,
           c.name as category, sc.name as subcategory, b.name as brand,
           COUNT(pv.id)::int as variant_count,
           SUM(ii.quantity_available)::int as total_stock
    FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN subcategories sc ON sc.id = p.subcategory_id
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
    GROUP BY p.id, c.name, sc.name, b.name
    ORDER BY p.created_at ASC;
  `);

  console.log('=== FULL CATALOGUES STATE ===');
  console.table(prods);

  const { rows: totalVariants } = await pool.query('SELECT COUNT(*)::int as count FROM product_variants');
  const { rows: totalInventory } = await pool.query('SELECT COUNT(*)::int as count, SUM(quantity_available)::int as total_qty FROM inventory_items');
  const { rows: totalMovements } = await pool.query('SELECT COUNT(*)::int as count FROM stock_movements');

  console.log(`Total Variants: ${totalVariants[0].count}`);
  console.log(`Total Inventory Items: ${totalInventory[0].count} (Sum Qty: ${totalInventory[0].total_qty})`);
  console.log(`Total Stock Movements: ${totalMovements[0].count}`);
}

main().then(() => process.exit(0)).catch(console.error);
