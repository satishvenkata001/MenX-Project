import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/db.js';

async function inspectTestDependencies() {
  const client = await pool.connect();
  try {
    const testCatIds = [
      '3323bd60-fe95-485f-80b2-38b38a83b95f',
      'd044603c-f33b-4fff-9dfd-5cf48cb69589',
      'd30d8019-94ff-4253-9223-2068bb3da516',
      'dd2c87bb-61e3-4ba1-bbe0-d97a571cbfc0'
    ];

    for (const catId of testCatIds) {
      const cat = (await client.query('SELECT * FROM categories WHERE id = $1', [catId])).rows[0];
      const subcats = (await client.query('SELECT * FROM subcategories WHERE category_id = $1', [catId])).rows;
      const prods = (await client.query('SELECT * FROM products WHERE category_id = $1', [catId])).rows;
      const prodIds = prods.map(p => p.id);
      
      let variants = [];
      let images = [];
      let invItems = [];
      let orderItems = [];

      if (prodIds.length > 0) {
        variants = (await client.query('SELECT * FROM product_variants WHERE product_id = ANY($1)', [prodIds])).rows;
        images = (await client.query('SELECT * FROM product_images WHERE product_id = ANY($1)', [prodIds])).rows;
        const varIds = variants.map(v => v.id);
        if (varIds.length > 0) {
          invItems = (await client.query('SELECT * FROM inventory_items WHERE variant_id = ANY($1)', [varIds])).rows;
          orderItems = (await client.query('SELECT * FROM order_items WHERE variant_id = ANY($1)', [varIds])).rows;
        }
      }

      console.log(`\n========================================`);
      console.log(`Category: ${cat.name} (${cat.slug}) [ID: ${cat.id}]`);
      console.log(`Subcategories: ${subcats.length} ->`, subcats.map(s => `${s.name} (${s.slug})`));
      console.log(`Products: ${prods.length} ->`, prods.map(p => `${p.title} (${p.slug})`));
      console.log(`Variants: ${variants.length} ->`, variants.map(v => `${v.sku}`));
      console.log(`Inventory Items: ${invItems.length}`);
      console.log(`Product Images: ${images.length}`);
      console.log(`Order Items: ${orderItems.length}`);
      console.log(`Safe to delete: ${orderItems.length === 0 ? 'YES' : 'NO'}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

inspectTestDependencies().catch(console.error);
