import { supabaseAdmin } from '../config/supabase.js';

async function seedInventory() {
  console.log('Fetching stores and catalog products...');
  const { data: stores } = await supabaseAdmin
    .from('stores')
    .select('id, name, code, type')
    .eq('is_active', true);

  const { data: products } = await supabaseAdmin
    .from('products')
    .select(`
      id, title, slug, status,
      variants:product_variants(id, sku, is_active)
    `)
    .eq('status', 'PUBLISHED');

  const catalogProducts = (products || []).filter(p => !p.slug.includes('-1788') && !p.slug.startsWith('f4f-'));
  const allVariants = catalogProducts.flatMap(p => (p.variants || []).filter(v => v.is_active));
  const variantIds = allVariants.map(v => v.id);

  console.log(`Found ${stores.length} active stores and ${allVariants.length} active variants.`);

  // Delete existing inventory for these variants
  await supabaseAdmin.from('inventory_items').delete().in('variant_id', variantIds);

  // Prepare bulk rows
  const rows = [];
  for (const variant of allVariants) {
    for (const store of stores) {
      const seedQty = store.type === 'ONLINE_FULFILLMENT' ? 20 : 10;
      rows.push({
        store_id: store.id,
        variant_id: variant.id,
        quantity_available: seedQty,
        quantity_reserved: 0,
        quantity_damaged: 0
      });
    }
  }

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabaseAdmin.from('inventory_items').insert(batch);
    if (error) throw error;
  }

  console.log(`✅ Successfully bulk-seeded ${rows.length} inventory records for ${allVariants.length} catalog variants across ${stores.length} stores.`);
}

seedInventory().then(() => process.exit(0)).catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
