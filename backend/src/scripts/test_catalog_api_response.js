import { CatalogService } from '../services/catalog.service.js';
import { pool } from '../config/db.js';

async function testCatalog() {
  try {
    const slugs = ['royal', 'signature-oxford-cotton-shirt', 'premium-leather-chelsea-boots'];
    for (const slug of slugs) {
      const prod = await CatalogService.getProductBySlug(slug);
      console.log(`\n======================================================`);
      console.log(`PRODUCT: ${prod.title} (Slug: ${prod.slug})`);
      console.log(`Total Variants: ${prod.variants.length}`);
      for (const v of prod.variants) {
        console.log(`  - SKU: ${v.sku} | Size: ${v.size?.name || 'N/A'} | Color: ${v.color?.name || 'N/A'} | Availability: ${v.availability} | availableStock: ${v.availableStock} | quantityAvailable: ${v.quantityAvailable}`);
      }
    }
  } catch (err) {
    console.error('Error fetching catalog:', err);
  } finally {
    await pool.end();
  }
}

testCatalog();
