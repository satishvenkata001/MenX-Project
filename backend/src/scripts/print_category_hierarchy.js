import { pool } from '../config/db.js';

async function main() {
  const { rows: categories } = await pool.query(`
    SELECT id, name, slug FROM categories WHERE is_active = true ORDER BY display_order ASC;
  `);
  
  for (const c of categories) {
    const { rows: subs } = await pool.query(`
      SELECT id, name, slug FROM subcategories WHERE category_id = $1 AND is_active = true ORDER BY display_order ASC;
    `, [c.id]);
    console.log(`\nCATEGORY: "${c.name}" (slug: ${c.slug}, id: ${c.id})`);
    subs.forEach(s => {
      console.log(`  - SUBCATEGORY: "${s.name}" (slug: ${s.slug}, id: ${s.id})`);
    });
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
