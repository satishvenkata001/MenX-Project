import { supabaseAdmin } from '../config/supabase.js';

async function checkCatalogState() {
  const { data: stores } = await supabaseAdmin
    .from('stores')
    .select('id, name, code, type, is_active')
    .eq('is_active', true);
  console.log('ACTIVE STORES:');
  console.table(stores);

  const { data: products } = await supabaseAdmin
    .from('products')
    .select(`
      id, title, slug, status,
      variants:product_variants(
        id, sku, mrp, selling_price, is_active,
        size:sizes(name),
        color:colors(name)
      )
    `)
    .eq('status', 'PUBLISHED');

  console.log('\nPUBLISHED PRODUCTS & VARIANTS:');
  products.forEach(p => {
    console.log(`\nProduct: "${p.title}" (slug: ${p.slug}) - ${p.variants?.length || 0} variants`);
    console.table((p.variants || []).map(v => ({
      id: v.id,
      sku: v.sku,
      size: v.size?.name,
      color: v.color?.name,
      is_active: v.is_active,
      price: v.selling_price
    })));
  });
}

checkCatalogState().then(() => process.exit(0)).catch(console.error);
