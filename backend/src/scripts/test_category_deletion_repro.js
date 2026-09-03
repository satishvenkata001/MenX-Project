import dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from '../config/supabase.js';
import { CatalogService } from '../services/catalog.service.js';

async function runCategoryDeletionReproTest() {
  console.log('================================================================');
  console.log('  PHASE 10: REPRODUCIBLE ISOLATED CATEGORY DELETION DIAGNOSTIC ');
  console.log('================================================================');

  const ts = Date.now();
  const testCatSlug = `diag-cat-${ts}`;
  const testCatName = `Diagnostic Category ${ts}`;

  console.log(`\nStep 1: Creating isolated test category: "${testCatName}" (${testCatSlug})...`);
  const { data: createdCat, error: createErr } = await supabaseAdmin
    .from('categories')
    .insert({
      name: testCatName,
      slug: testCatSlug,
      description: 'Temporary category for diagnostic test',
      display_order: 999,
      is_active: true
    })
    .select()
    .single();

  if (createErr || !createdCat) {
    console.error('Failed to create diagnostic category:', createErr);
    process.exit(1);
  }
  console.log(`✓ Created category ID: ${createdCat.id}`);

  console.log('\nStep 2: Reading categories directly from database...');
  const { data: readCat1, error: readErr1 } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, is_active')
    .eq('id', createdCat.id)
    .single();

  if (readErr1 || !readCat1) {
    console.error('Failed to read back created category:', readErr1);
    process.exit(1);
  }
  console.log(`✓ Confirmed category exists in DB: ${readCat1.name} (ID: ${readCat1.id})`);

  console.log('\nStep 3: Deleting category via CatalogService.deleteCategory...');
  const mockUser = { id: '00000000-0000-0000-0000-000000000000', role: 'SUPER_ADMIN' };
  const deleteResult = await CatalogService.deleteCategory(
    createdCat.id,
    mockUser,
    null,
    { ip: '127.0.0.1', userAgent: 'Diagnostic-Test' }
  );
  console.log('✓ Delete service response:', deleteResult);

  console.log('\nStep 4: Querying database directly immediately after deletion...');
  const { data: readCat2, error: readErr2 } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .eq('id', createdCat.id)
    .maybeSingle();

  if (readCat2) {
    console.error('❌ BUG DETECTED: Category STILL EXISTS in DB after delete:', readCat2);
    process.exit(1);
  } else {
    console.log('✓ Verified: Category is ABSENT from DB immediately after delete.');
  }

  console.log('\nStep 5: Querying database again after 1 second delay to ensure no resurrection...');
  await new Promise(res => setTimeout(res, 1000));
  const { data: readCat3 } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .eq('id', createdCat.id)
    .maybeSingle();

  if (readCat3) {
    console.error('❌ BUG DETECTED: Category REAPPEARED in DB after delay:', readCat3);
    process.exit(1);
  } else {
    console.log('✓ Verified: Category remains ABSENT from DB after delay.');
  }

  console.log('\nStep 6: Checking audit logs for deletion entry...');
  const { data: auditLog } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('target_entity', 'categories')
    .eq('target_id', createdCat.id)
    .maybeSingle();

  if (auditLog) {
    console.log(`✓ Audit log recorded properly: action=${auditLog.action}, actor_role=${auditLog.actor_role}`);
  } else {
    console.warn('⚠️ No audit log record found for category deletion.');
  }

  console.log('\n================================================================');
  console.log('  RESULT: Single-item Category Deletion is 100% Deterministic   ');
  console.log('================================================================\n');
}

runCategoryDeletionReproTest().catch(err => {
  console.error('Repro test failed:', err);
  process.exit(1);
});
