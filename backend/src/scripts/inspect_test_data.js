import { supabaseAdmin } from '../config/supabase.js';

async function inspectData() {
  const { data: categories, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: true });

  if (catErr) {
    console.error('Error fetching categories:', catErr);
    process.exit(1);
  }

  console.log('--- ALL CATEGORIES ---');
  console.table(categories);

  const testCategories = categories.filter(c => /-\d{10,}/.test(c.slug) || /-\d{10,}/.test(c.name) || c.name.startsWith('Apparel-'));
  console.log(`Found ${testCategories.length} test/fixture categories:`);
  console.table(testCategories);

  // Also check test products
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, title, slug, created_at')
    .order('created_at', { ascending: true });

  const testProducts = (products || []).filter(p => /-\d{10,}/.test(p.slug) || p.slug.startsWith('f4g-') || p.slug.startsWith('inv-') || p.slug.startsWith('cart-'));
  console.log(`Found ${testProducts.length} test/fixture products:`);
  console.table(testProducts);
}

inspectData().then(() => process.exit(0)).catch(console.error);
