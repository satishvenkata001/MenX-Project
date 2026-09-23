import { pool } from '../config/db.js';
import { isSizeValidForCategory, getCategorySizeRule } from '../config/categorySizes.js';

async function auditVariants() {
  console.log('================================================================');
  console.log('       MENX: AUDIT OF EXISTING PRODUCTS & VARIANTS SIZES');
  console.log('================================================================\n');

  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        p.id as product_id,
        p.title as product_title,
        p.slug as product_slug,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        sc.id as subcategory_id,
        sc.name as subcategory_name,
        sc.slug as subcategory_slug,
        pv.id as variant_id,
        pv.sku,
        pv.is_active as variant_active,
        s.id as size_id,
        s.name as size_name,
        s.category_type as size_category_type,
        col.name as color_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN colors col ON pv.color_id = col.id
      ORDER BY p.title, s.name
    `);

    const report = [];
    const invalidVariants = [];

    for (const row of res.rows) {
      const categoryObj = { id: row.category_id, name: row.category_name, slug: row.category_slug };
      const rule = getCategorySizeRule(categoryObj);
      const isValid = isSizeValidForCategory(categoryObj, row.size_name, row.size_category_type);

      let reason = 'Valid';
      if (!isValid) {
        reason = `Category '${row.category_name}' (${rule.categoryType}) requires sizes [${rule.allowedSizes.join(', ')}], but variant has '${row.size_name}' (${row.size_category_type})`;
        invalidVariants.push({
          product: row.product_title,
          category: row.category_name,
          variantId: row.variant_id,
          sku: row.sku,
          currentSize: `${row.size_name} (${row.size_category_type})`,
          reason
        });
      }

      report.push({
        'Product': row.product_title,
        'Category': `${row.category_name} (${rule.categoryType})`,
        'Variant SKU': row.sku,
        'Current Size': `${row.size_name} (${row.size_category_type})`,
        'Valid?': isValid ? '✅ YES' : '❌ NO',
        'Reason': reason
      });
    }

    console.table(report);

    console.log('\n----------------------------------------------------------------');
    console.log(`TOTAL VARIANTS AUDITED: ${report.length}`);
    console.log(`VALID: ${report.length - invalidVariants.length}`);
    console.log(`INVALID: ${invalidVariants.length}`);
    console.log('----------------------------------------------------------------\n');

    if (invalidVariants.length > 0) {
      console.log('INVALID EXISTING VARIANTS DETAIL:');
      console.table(invalidVariants);
    }

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

auditVariants();
