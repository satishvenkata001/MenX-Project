import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

async function runAudit() {
  console.log('--- STARTING MENX PERFORMANCE AUDIT ---');
  console.log('Supabase URL:', env.SUPABASE_URL);
  console.log('Has Direct Pool:', !!pool);

  // 1. Raw HTTPS Ping / Round-trip to Supabase REST endpoint
  const t0 = Date.now();
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`
    }
  });
  const tPing = Date.now() - t0;
  console.log(`1. Raw HTTP round-trip to Supabase REST: ${tPing}ms (status: ${res.status})`);

  // 2. Auth getUser check (with a dummy token or lookup)
  const tAuth0 = Date.now();
  try {
    await supabaseAdmin.auth.getUser('dummy-invalid-token');
  } catch (e) {}
  const tAuth = Date.now() - tAuth0;
  console.log(`2. Supabase Auth getUser round-trip: ${tAuth}ms`);

  // 3. Simple PostgREST query: profiles table
  const tProf0 = Date.now();
  const { data: profs, error: profErr } = await supabaseAdmin.from('profiles').select('id, role').limit(1);
  const tProf = Date.now() - tProf0;
  console.log(`3. Supabase PostgREST query (profiles select): ${tProf}ms, found: ${profs?.length || 0}`);

  // 4. Direct Postgres query (if pool available)
  if (pool) {
    const tPg0 = Date.now();
    const pgRes = await pool.query('SELECT id, role FROM profiles LIMIT 1');
    const tPg = Date.now() - tPg0;
    console.log(`4. Direct PostgreSQL pool query (profiles select): ${tPg}ms, rows: ${pgRes.rows.length}`);
  }

  // 5. Test key backend queries through Supabase PostgREST
  console.log('\n--- MEASURING KEY BACKEND QUERIES ---');

  // Products query
  const tProd0 = Date.now();
  const { data: prods } = await supabaseAdmin
    .from('products')
    .select(`
      id, title, slug, description, base_mrp, base_price, status, is_featured,
      category:categories(id, name, slug),
      brand:brands(id, name, slug),
      variants:product_variants(id, sku, mrp, selling_price, is_active, stock:inventory_items(quantity, reserved_quantity))
    `)
    .limit(20);
  const tProd = Date.now() - tProd0;
  console.log(`- Products query (with joins): ${tProd}ms, count: ${prods?.length || 0}`);

  // Categories query
  const tCat0 = Date.now();
  const { data: cats } = await supabaseAdmin.from('categories').select('*').order('display_order', { ascending: true });
  const tCat = Date.now() - tCat0;
  console.log(`- Categories query: ${tCat}ms, count: ${cats?.length || 0}`);

  // Subcategories query
  const tSub0 = Date.now();
  const { data: subs } = await supabaseAdmin.from('subcategories').select('*');
  const tSub = Date.now() - tSub0;
  console.log(`- Subcategories query: ${tSub}ms, count: ${subs?.length || 0}`);

  // Brands query
  const tBrand0 = Date.now();
  const { data: brands } = await supabaseAdmin.from('brands').select('*');
  const tBrand = Date.now() - tBrand0;
  console.log(`- Brands query: ${tBrand}ms, count: ${brands?.length || 0}`);

  // Sizes query
  const tSize0 = Date.now();
  const { data: sizes } = await supabaseAdmin.from('sizes').select('*');
  const tSize = Date.now() - tSize0;
  console.log(`- Sizes query: ${tSize}ms, count: ${sizes?.length || 0}`);

  // Colors query
  const tColor0 = Date.now();
  const { data: colors } = await supabaseAdmin.from('colors').select('*');
  const tColor = Date.now() - tColor0;
  console.log(`- Colors query: ${tColor}ms, count: ${colors?.length || 0}`);

  // Orders query
  const tOrd0 = Date.now();
  const { data: ords } = await supabaseAdmin.from('orders').select('*').limit(8);
  const tOrd = Date.now() - tOrd0;
  console.log(`- Orders query: ${tOrd}ms, count: ${ords?.length || 0}`);

  // Returns query
  const tRet0 = Date.now();
  const { data: rets } = await supabaseAdmin.from('returns').select('*').limit(8);
  const tRet = Date.now() - tRet0;
  console.log(`- Returns query: ${tRet}ms, count: ${rets?.length || 0}`);

  // Low stock query
  const tLow0 = Date.now();
  const { data: lowStock } = await supabaseAdmin.from('inventory_items').select('*').limit(10);
  const tLow = Date.now() - tLow0;
  console.log(`- Low stock query: ${tLow}ms, count: ${lowStock?.length || 0}`);

  console.log('\n--- AUDIT COMPLETE ---');
  if (pool) await pool.end();
}

runAudit().catch(console.error);
