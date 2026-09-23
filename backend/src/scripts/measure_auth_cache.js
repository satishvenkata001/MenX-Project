import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';

// Auth cache implementation
const authCache = new Map();
const AUTH_CACHE_TTL_MS = 60 * 1000; // 60s

async function cachedRequireAuth(token) {
  const cached = authCache.get(token);
  if (cached && (Date.now() - cached.timestamp < AUTH_CACHE_TTL_MS)) {
    return cached.data;
  }

  // Verify token with Supabase Auth
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid token');

  // Fetch profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const authResult = { user: data.user, profile };
  authCache.set(token, { data: authResult, timestamp: Date.now() });
  return authResult;
}

async function testSpeedup() {
  console.log('Testing Auth cache speedup...');
  // Create test user
  const email = `test.cache.${Date.now()}@menx.com`;
  const password = 'Password123!Secure';
  const { data: authData } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  await pool.query(`
    INSERT INTO profiles (id, email, first_name, last_name, phone, role, is_active)
    VALUES ($1, $2, 'Test', 'User', '+919999999999', 'SUPER_ADMIN', true)
    ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', is_active = true
  `, [authData.user.id, email]);
  const { data: sess } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  const token = sess.session.access_token;

  // Uncached call 1
  const t1_0 = Date.now();
  await cachedRequireAuth(token);
  const t1 = Date.now() - t1_0;
  console.log(`Call 1 (Cold / Uncached): ${t1}ms`);

  // Cached call 2
  const t2_0 = Date.now();
  await cachedRequireAuth(token);
  const t2 = Date.now() - t2_0;
  console.log(`Call 2 (Cached Hit): ${t2}ms`);

  // Cached call 3
  const t3_0 = Date.now();
  await cachedRequireAuth(token);
  const t3 = Date.now() - t3_0;
  console.log(`Call 3 (Cached Hit): ${t3}ms`);

  // Cleanup
  await pool.query('DELETE FROM profiles WHERE id = $1', [authData.user.id]);
  await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
  await pool.end();
}

testSpeedup().catch(console.error);
