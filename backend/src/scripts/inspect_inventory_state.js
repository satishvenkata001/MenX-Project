import { supabaseAdmin } from '../config/supabase.js';

async function inspectInventory() {
  console.log('=== STORES ===');
  const { data: stores, error: sErr } = await supabaseAdmin.from('stores').select('*');
  if (sErr) console.error('Store error:', sErr);
  console.table(stores);

  console.log('=== INVENTORY ITEMS ===');
  const { data: inv, error: invErr } = await supabaseAdmin
    .from('inventory_items')
    .select('id, store_id, variant_id, quantity_available, quantity_reserved, quantity_damaged');
  if (invErr) console.error('Inventory error:', invErr);
  console.log(`Total inventory items count: ${inv?.length}`);
  console.table(inv);

  console.log('=== CATALOG PRODUCTS ===');
  const { data: catalogProds, error: pErr } = await supabaseAdmin
    .from('products')
    .select('id, title, slug, status')
    .eq('status', 'PUBLISHED');
  console.table(catalogProds);
}

inspectInventory().then(() => process.exit(0)).catch(console.error);
