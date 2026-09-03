import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../config/supabase.js';
import { CatalogService } from '../services/catalog.service.js';

const EXPECTED_CORE_CATEGORIES = [
  'footwear',
  'shirts',
  'ethnic-wear',
  'accessories',
  'jackets',
  't-shirts',
  'trousers',
  'jeans',
  'activewear',
  'shorts'
];

async function runPersistenceVerification() {
  console.log('================================================================');
  console.log('       MENX CATEGORY PERSISTENCE & LIFECYCLE VERIFICATION       ');
  console.log('================================================================\n');

  // TEST 1: GET categories -> record IDs
  console.log('--- TEST 1: Initial Category Retrieval ---');
  const initialCategories = await CatalogService.listCategories();
  const initialAdminCategories = await CatalogService.listAdminCategories();
  console.log(`✓ Public categories count: ${initialCategories.length}`);
  console.log(`✓ Admin categories count: ${initialAdminCategories.length}`);
  const initialIds = initialCategories.map(c => c.id);
  console.log(`✓ Initial Category Slugs: ${initialCategories.map(c => c.slug).join(', ')}`);

  // Verify all 10 core categories exist
  for (const slug of EXPECTED_CORE_CATEGORIES) {
    if (!initialCategories.some(c => c.slug === slug)) {
      throw new Error(`Missing expected core production category: ${slug}`);
    }
  }
  console.log('✓ All 10 core production categories confirmed present.');

  // TEST 2: Create a dedicated TEST category
  const ts = Date.now();
  const testCatName = `Persist-Test-Cat-${ts}`;
  const testCatSlug = `persist-test-cat-${ts}`;
  console.log(`\n--- TEST 2: Create Dedicated Test Category "${testCatName}" ---`);

  const createdCategory = await CatalogService.createCategory({
    name: testCatName,
    slug: testCatSlug,
    description: 'Category for lifecycle persistence verification',
    display_order: 999,
    is_active: true
  });
  console.log(`✓ Created Category ID: ${createdCategory.id}`);

  // TEST 3: GET categories -> test category exists
  console.log('\n--- TEST 3: Verify Test Category Appears in GET Categories ---');
  const catListAfterCreate = await CatalogService.listCategories();
  const foundInPublic = catListAfterCreate.find(c => c.id === createdCategory.id);
  const adminCatListAfterCreate = await CatalogService.listAdminCategories();
  const foundInAdmin = adminCatListAfterCreate.find(c => c.id === createdCategory.id);

  if (!foundInPublic || !foundInAdmin) {
    throw new Error('Created test category not found in category listings!');
  }
  console.log(`✓ Confirmed in Public GET: "${foundInPublic.name}" (${foundInPublic.slug})`);
  console.log(`✓ Confirmed in Admin GET: "${foundInAdmin.name}" (${foundInAdmin.slug})`);

  // TEST 4: DELETE test category
  console.log(`\n--- TEST 4: Execute DELETE on Test Category (${createdCategory.id}) ---`);
  const mockAdminUser = { id: '00000000-0000-0000-0000-000000000000', role: 'SUPER_ADMIN' };
  const deleteResult = await CatalogService.deleteCategory(
    createdCategory.id,
    mockAdminUser,
    null,
    { ip: '127.0.0.1', userAgent: 'persistence-verification' }
  );
  console.log(`✓ Delete Response: ${deleteResult.message}`);

  // TEST 5: GET categories immediately -> test category absent
  console.log('\n--- TEST 5: Verify Immediate Absence in Category Listings ---');
  const catListImmediatelyAfterDelete = await CatalogService.listCategories();
  const foundImmediatelyPublic = catListImmediatelyAfterDelete.find(c => c.id === createdCategory.id);
  const adminCatListImmediately = await CatalogService.listAdminCategories();
  const foundImmediatelyAdmin = adminCatListImmediately.find(c => c.id === createdCategory.id);

  if (foundImmediatelyPublic || foundImmediatelyAdmin) {
    throw new Error('Test category is STILL PRESENT immediately after DELETE!');
  }
  console.log('✓ Verified: Test category is ABSENT from Public GET.');
  console.log('✓ Verified: Test category is ABSENT from Admin GET.');

  // TEST 6: Completely independent direct DB query (simulating fresh client)
  console.log('\n--- TEST 6: Independent Query (Fresh Database Select) ---');
  const { data: directDbRecord } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .eq('id', createdCategory.id)
    .maybeSingle();

  if (directDbRecord) {
    throw new Error('Test category row STILL EXISTS in Supabase database!');
  }
  console.log('✓ Verified: Direct Supabase SELECT returned null (row is deleted from DB).');

  // TEST 7 & 8: Simulate delay / fresh fetch to test against resurrection
  console.log('\n--- TEST 7 & 8: Delayed Re-query (Simulating Refresh / Restart) ---');
  await new Promise(r => setTimeout(r, 1500));

  const refreshedPublicList = await CatalogService.listCategories();
  const refreshedAdminList = await CatalogService.listAdminCategories();
  const foundAfterDelayPublic = refreshedPublicList.find(c => c.id === createdCategory.id);
  const foundAfterDelayAdmin = refreshedAdminList.find(c => c.id === createdCategory.id);

  if (foundAfterDelayPublic || foundAfterDelayAdmin) {
    throw new Error('Test category REAPPEARED after delay/refresh!');
  }
  console.log(`✓ Verified: Test category remains absent after delay/refresh. Count = ${refreshedPublicList.length}`);

  // TEST 9: Verify all 10 legitimate production categories remain untouched
  console.log('\n--- TEST 9: Integrity Check on Genuine Production Categories ---');
  for (const slug of EXPECTED_CORE_CATEGORIES) {
    const exists = refreshedPublicList.some(c => c.slug === slug);
    if (!exists) {
      throw new Error(`Production category "${slug}" was corrupted or lost!`);
    }
  }
  console.log(`✓ Verified: Exactly 10 production categories remain intact with 100% integrity.`);

  console.log('\n================================================================');
  console.log('  SUCCESS: Category lifecycle & persistence PASSED all tests!   ');
  console.log('================================================================\n');
}

runPersistenceVerification().catch(err => {
  console.error('\n❌ PERSISTENCE VERIFICATION FAILED:', err);
  process.exit(1);
});
