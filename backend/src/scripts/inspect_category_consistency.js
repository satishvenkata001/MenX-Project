import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../config/supabase.js';

async function inspectCategoryConsistency() {
  console.log('================================================================');
  console.log('       MENX CATEGORY CONSISTENCY & DIAGNOSTIC INSPECTION        ');
  console.log('================================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Safe Environment Info
  const supabaseUrl = process.env.SUPABASE_URL || 'NOT_SET';
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  console.log(`Target Supabase Project Ref: ${projectRef}`);
  console.log(`Database URL Host: ${process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://')).host : 'N/A'}`);
  console.log('----------------------------------------------------------------');

  // Query all categories sorted deterministically by created_at ASC, id ASC
  const { data: categories, error: catErr } = await supabaseAdmin
    .from('categories')
    .select(`
      id,
      name,
      slug,
      description,
      image_url,
      display_order,
      is_active,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (catErr) {
    console.error('Error fetching categories from Supabase:', catErr);
    process.exit(1);
  }

  // Get product counts per category
  const { data: products, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, category_id, title, slug, status');

  const productCountMap = {};
  if (!prodErr && products) {
    for (const p of products) {
      if (p.category_id) {
        productCountMap[p.category_id] = (productCountMap[p.category_id] || 0) + 1;
      }
    }
  }

  // Check subcategories as well
  const { data: subcategories, error: subErr } = await supabaseAdmin
    .from('subcategories')
    .select('id, category_id, name, slug');

  const subcategoryCountMap = {};
  if (!subErr && subcategories) {
    for (const sub of subcategories) {
      if (sub.category_id) {
        subcategoryCountMap[sub.category_id] = (subcategoryCountMap[sub.category_id] || 0) + 1;
      }
    }
  }

  console.log(`Total Categories in DB: ${categories.length}\n`);

  let testFixtureCount = 0;
  const testFixtureRegex = /(apparel-\d+|\btest\b|fixture|\d{10,})/i;

  console.log(
    '#'.padEnd(4) +
    'ID'.padEnd(38) +
    'NAME'.padEnd(30) +
    'SLUG'.padEnd(30) +
    'ACTIVE'.padEnd(8) +
    'PRODS'.padEnd(7) +
    'SUBS'.padEnd(6) +
    'CREATED_AT'.padEnd(25) +
    'TYPE'
  );
  console.log('-'.repeat(160));

  categories.forEach((c, idx) => {
    const isTestFixture = testFixtureRegex.test(c.slug) || testFixtureRegex.test(c.name);
    if (isTestFixture) {
      testFixtureCount++;
    }

    const typeLabel = isTestFixture ? '⚠️ TEST FIXTURE' : '✅ PRODUCTION';
    const prodCount = productCountMap[c.id] || 0;
    const subCount = subcategoryCountMap[c.id] || 0;

    console.log(
      String(idx + 1).padEnd(4) +
      String(c.id).padEnd(38) +
      String(c.name).padEnd(30) +
      String(c.slug).padEnd(30) +
      String(c.is_active).padEnd(8) +
      String(prodCount).padEnd(7) +
      String(subCount).padEnd(6) +
      String(c.created_at).padEnd(25) +
      typeLabel
    );
  });

  console.log('-'.repeat(160));
  console.log(`SUMMARY:`);
  console.log(`- Total Categories: ${categories.length}`);
  console.log(`- Real / Production Categories: ${categories.length - testFixtureCount}`);
  console.log(`- Test Fixture Categories: ${testFixtureCount}`);
  console.log('================================================================\n');
}

inspectCategoryConsistency().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
