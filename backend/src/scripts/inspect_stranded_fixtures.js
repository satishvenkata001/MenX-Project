import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../config/supabase.js';

async function checkStrandedFixtures() {
  const targetIds = [
    'e05d21ec-408c-43cb-a9fe-4a55e8fcf4a5',
    'dd63a864-5368-4c45-b166-ccb48dbc5cea',
    '9b14be2c-bb92-4b81-b211-7fb66cc65f6d'
  ];

  console.log('Inspecting 3 stranded test categories...');
  const { data: cats } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .in('id', targetIds);

  console.log('Found categories:', cats);

  const { data: subcats } = await supabaseAdmin
    .from('subcategories')
    .select('id, name, slug, category_id')
    .in('category_id', targetIds);

  console.log('Found child subcategories:', subcats);

  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, title, slug, category_id, subcategory_id')
    .in('category_id', targetIds);

  console.log('Found child products:', products);

  if (products && products.length > 0) {
    const prodIds = products.map(p => p.id);
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('id, sku, product_id')
      .in('product_id', prodIds);

    console.log('Found child variants:', variants);

    if (variants && variants.length > 0) {
      const varIds = variants.map(v => v.id);
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select('id, order_id, variant_id')
        .in('variant_id', varIds);
      console.log('Found order items referencing variants:', orderItems);
    }
  }
}

checkStrandedFixtures();
