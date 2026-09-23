import { pool } from '../config/db.js';

async function check() {
  const activeSizes = await pool.query(`
    SELECT DISTINCT s.id, s.name, s.category_type, s.sort_order, COUNT(pv.id)::int as variant_count
    FROM sizes s
    JOIN product_variants pv ON pv.size_id = s.id
    JOIN products p ON p.id = pv.product_id
    WHERE p.status = 'PUBLISHED' AND pv.is_active = true
    GROUP BY s.id, s.name, s.category_type, s.sort_order
    ORDER BY s.category_type ASC, s.sort_order ASC, s.name ASC
  `);
  console.log('ACTIVE PUBLISHED SIZES:');
  console.table(activeSizes.rows);

  const allSizes = await pool.query(`
    SELECT s.id, s.name, s.category_type, s.sort_order, COUNT(pv.id)::int as variant_count
    FROM sizes s
    LEFT JOIN product_variants pv ON pv.size_id = s.id
    GROUP BY s.id, s.name, s.category_type, s.sort_order
    ORDER BY s.category_type ASC, s.sort_order ASC, s.name ASC
  `);
  console.log('ALL SIZES IN DB:');
  console.table(allSizes.rows);

  const activeColors = await pool.query(`
    SELECT DISTINCT c.id, c.name, c.hex_code, COUNT(pv.id)::int as variant_count
    FROM colors c
    JOIN product_variants pv ON pv.color_id = c.id
    JOIN products p ON p.id = pv.product_id
    WHERE p.status = 'PUBLISHED' AND pv.is_active = true
    GROUP BY c.id, c.name, c.hex_code
    ORDER BY c.name ASC
  `);
  console.log('ACTIVE PUBLISHED COLORS:');
  console.table(activeColors.rows);

  const allColors = await pool.query(`
    SELECT c.id, c.name, c.hex_code, COUNT(pv.id)::int as variant_count
    FROM colors c
    LEFT JOIN product_variants pv ON pv.color_id = c.id
    GROUP BY c.id, c.name, c.hex_code
    ORDER BY c.name ASC
  `);
  console.log('ALL COLORS IN DB:');
  console.table(allColors.rows);

  await pool.end();
}

check().catch(console.error);
