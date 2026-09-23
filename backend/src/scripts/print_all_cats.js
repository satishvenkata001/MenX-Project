import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';

async function printAllCategories() {
  const client = await pool.connect();
  try {
    const cats = await client.query(`
      SELECT c.id, c.name, c.slug, c.display_order, c.is_active, c.created_at,
             (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id) AS subcat_count,
             (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS prod_count
      FROM categories c
      ORDER BY c.created_at ASC
    `);
    console.log(JSON.stringify(cats.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

printAllCategories().catch(console.error);
