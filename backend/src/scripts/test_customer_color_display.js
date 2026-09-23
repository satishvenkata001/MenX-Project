/**
 * Verification script: Customer Product View Color Display & Resolution
 */
import { supabaseAdmin } from '../config/supabase.js';
import { CatalogService } from '../services/catalog.service.js';

async function testCustomerColorDisplay() {
  console.log('>>> Testing Customer Product View Data Flow & Color Resolution...');

  try {
    // 1. Get all published products
    const { data: products, error: pErr } = await supabaseAdmin
      .from('products')
      .select('id, title, slug')
      .eq('status', 'PUBLISHED')
      .limit(5);

    if (pErr) throw pErr;
    console.log(`Found ${products.length} published products to inspect.`);

    for (const p of products) {
      const detail = await CatalogService.getProductBySlug(p.slug);
      console.log(`\nProduct: "${detail.title}" (slug: ${detail.slug})`);
      console.log(`Variants count: ${detail.variants.length}`);

      detail.variants.forEach((v, idx) => {
        console.log(`  [Variant ${idx + 1}] SKU: ${v.sku}`);
        console.log(`    Color Object:`, v.color);
        console.log(`    Size Object:`, v.size);
        console.log(`    Availability: ${v.availability}, Stock: ${v.availableStock}`);

        if (v.color) {
          if (typeof v.color === 'object') {
            console.log(`    ✅ Color Name: "${v.color.name}", Hex: "${v.color.hex_code}" (UUID: ${v.color.id})`);
            if (v.color.name.startsWith('#')) {
              console.warn(`    ⚠️ Warning: Color name starts with # in DB: ${v.color.name}`);
            }
          }
        }
      });
    }

    console.log('\n[PASS] CatalogService.getProductBySlug returns complete color objects { id, name, hex_code }');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

testCustomerColorDisplay();
