import http from 'http';
import app from '../app.js';
import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';

async function measureActions() {
  console.log('--- STARTING COMPREHENSIVE ACTIONS BENCHMARK ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  // 1. Create temporary Super Admin test user
  const email = `benchmark.admin.${Date.now()}@menx.com`;
  const password = 'Password123!Secure';
  
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authErr) {
    console.error('Failed to create benchmark admin user:', authErr);
    server.close();
    if (pool) await pool.end();
    return;
  }

  const userId = authData.user.id;

  // Set profile role to SUPER_ADMIN
  await pool.query(`
    INSERT INTO profiles (id, email, first_name, last_name, phone, role, is_active)
    VALUES ($1, $2, 'Bench', 'Admin', '+919876543210', 'SUPER_ADMIN', true)
    ON CONFLICT (id) DO UPDATE SET role = 'SUPER_ADMIN', is_active = true
  `, [userId, email]);

  // Sign in to get JWT token
  const { data: sessionData, error: loginErr } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password
  });

  if (loginErr) {
    console.error('Login failed:', loginErr);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    server.close();
    if (pool) await pool.end();
    return;
  }

  const token = sessionData.session.access_token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const results = [];

  async function measure(name, fn) {
    const start = Date.now();
    try {
      const res = await fn();
      const elapsed = Date.now() - start;
      results.push({ name, timeMs: elapsed, status: 'OK' });
      console.log(`[ACTION] ${name.padEnd(45)}: ${elapsed}ms (OK)`);
      return res;
    } catch (err) {
      const elapsed = Date.now() - start;
      results.push({ name, timeMs: elapsed, status: 'ERR: ' + err.message });
      console.error(`[ACTION] ${name.padEnd(45)}: ${elapsed}ms (ERR: ${err.message})`);
    }
  }

  console.log('\n--- MEASURING INDIVIDUAL API ENDPOINTS ---');

  // 1. Auth check (/auth/me)
  await measure('1. Auth Check (GET /auth/me)', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

  // 2. Public Catalog Metadata
  await measure('2. Public Categories (GET /categories)', async () => {
    const res = await fetch(`${baseUrl}/categories`);
    return res.json();
  });

  await measure('3. Public Subcategories (GET /subcategories)', async () => {
    const res = await fetch(`${baseUrl}/subcategories`);
    return res.json();
  });

  await measure('4. Public Brands (GET /brands)', async () => {
    const res = await fetch(`${baseUrl}/brands`);
    return res.json();
  });

  await measure('5. Public Sizes (GET /sizes)', async () => {
    const res = await fetch(`${baseUrl}/sizes`);
    return res.json();
  });

  await measure('6. Public Colors (GET /colors)', async () => {
    const res = await fetch(`${baseUrl}/colors`);
    return res.json();
  });

  // 7. Products listing
  let sampleProductSlug = null;
  let sampleProductId = null;
  await measure('7. Products Listing (GET /products?limit=12)', async () => {
    const res = await fetch(`${baseUrl}/products?limit=12`);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      sampleProductSlug = data.data[0].slug;
      sampleProductId = data.data[0].id;
    }
    return data;
  });

  // 8. Admin Orders list
  await measure('8. Admin Orders (GET /admin/orders?limit=8)', async () => {
    const res = await fetch(`${baseUrl}/admin/orders?limit=8`, { headers: authHeaders });
    return res.json();
  });

  // 9. Admin Returns list
  await measure('9. Admin Returns (GET /admin/returns?limit=8)', async () => {
    const res = await fetch(`${baseUrl}/admin/returns?limit=8`, { headers: authHeaders });
    return res.json();
  });

  // 10. Admin Low Stock
  await measure('10. Admin Low Stock (GET /admin/inventory/low-stock)', async () => {
    const res = await fetch(`${baseUrl}/admin/inventory/low-stock?page=1&limit=10`, { headers: authHeaders });
    return res.json();
  });

  // 11. Admin Customers list
  let sampleCustomerId = null;
  await measure('11. Admin Customers List (GET /admin/customers?limit=10)', async () => {
    const res = await fetch(`${baseUrl}/admin/customers?page=1&limit=10`, { headers: authHeaders });
    const data = await res.json();
    if (data.data?.customers?.length > 0) {
      sampleCustomerId = data.data.customers[0].id;
    }
    return data;
  });

  // 12. Admin Customer Details
  if (sampleCustomerId) {
    await measure('12. Admin Customer Details (GET /admin/customers/:id)', async () => {
      const res = await fetch(`${baseUrl}/admin/customers/${sampleCustomerId}`, { headers: authHeaders });
      return res.json();
    });
  }

  // 13. Admin Categories List
  await measure('13. Admin Categories (GET /admin/categories)', async () => {
    const res = await fetch(`${baseUrl}/admin/categories`, { headers: authHeaders });
    return res.json();
  });

  console.log('\n--- MEASURING COMPOSITE USER ACTIONS (AS TRIGGERED BY FRONTEND) ---');

  // ACTION A: Open Admin Dashboard (Initial Mount: Overview Stats + Metadata)
  await measure('ACTION A: Admin Dashboard Init (Stats + Metadata)', async () => {
    // Current frontend does:
    // loadOverviewStats: /products, /admin/orders?limit=1, /admin/returns?limit=1&status=REQUESTED (sequential)
    // loadCatalogMetadata: /admin/categories, /subcategories, /brands, /sizes, /colors (parallel)
    const [pRes, oRes, rRes] = await Promise.all([
      fetch(`${baseUrl}/products`).then(r => r.json()),
      fetch(`${baseUrl}/admin/orders?limit=1`, { headers: authHeaders }).then(r => r.json()),
      fetch(`${baseUrl}/admin/returns?limit=1&status=REQUESTED`, { headers: authHeaders }).then(r => r.json())
    ]);
    const [catRes, subRes, brandRes, sizeRes, colorRes] = await Promise.all([
      fetch(`${baseUrl}/admin/categories`, { headers: authHeaders }).then(r => r.json()),
      fetch(`${baseUrl}/subcategories`).then(r => r.json()),
      fetch(`${baseUrl}/brands`).then(r => r.json()),
      fetch(`${baseUrl}/sizes`).then(r => r.json()),
      fetch(`${baseUrl}/colors`).then(r => r.json())
    ]);
  });

  // ACTION B: Click "Orders" Tab
  await measure('ACTION B: Open Orders Tab (GET /admin/orders)', async () => {
    const res = await fetch(`${baseUrl}/admin/orders?page=1&limit=8`, { headers: authHeaders });
    return res.json();
  });

  // ACTION C: Click "Returns" Tab
  await measure('ACTION C: Open Returns Tab (GET /admin/returns)', async () => {
    const res = await fetch(`${baseUrl}/admin/returns?page=1&limit=8`, { headers: authHeaders });
    return res.json();
  });

  // ACTION D: Click "Customers" Tab
  await measure('ACTION D: Open Customers Tab (GET /admin/customers)', async () => {
    const res = await fetch(`${baseUrl}/admin/customers?page=1&limit=10`, { headers: authHeaders });
    return res.json();
  });

  // ACTION E: Click "Low Stock" Tab
  await measure('ACTION E: Open Low Stock Tab (GET /admin/inventory/low-stock)', async () => {
    const res = await fetch(`${baseUrl}/admin/inventory/low-stock?page=1&limit=10`, { headers: authHeaders });
    return res.json();
  });

  // ACTION F: Click "Catalog" Tab
  await measure('ACTION F: Open Catalog Tab (GET /products?limit=8)', async () => {
    const res = await fetch(`${baseUrl}/products?page=1&limit=8`);
    return res.json();
  });

  // ACTION G: Home Page Filter Change (Simulating current Home.jsx behavior)
  await measure('ACTION G: Home Filter Change (Uncached re-fetch 6 endpoints)', async () => {
    await Promise.all([
      fetch(`${baseUrl}/products?category=apparel&sortBy=newest`).then(r => r.json()),
      fetch(`${baseUrl}/categories`).then(r => r.json()),
      fetch(`${baseUrl}/subcategories`).then(r => r.json()),
      fetch(`${baseUrl}/brands`).then(r => r.json()),
      fetch(`${baseUrl}/sizes`).then(r => r.json()),
      fetch(`${baseUrl}/colors`).then(r => r.json())
    ]);
  });

  // Cleanup
  console.log('\n--- CLEANING UP TEST USER ---');
  await pool.query('DELETE FROM profiles WHERE id = $1', [userId]);
  await supabaseAdmin.auth.admin.deleteUser(userId);
  server.close();
  if (pool) await pool.end();

  console.log('\n--- BENCHMARK SUMMARY ---');
  console.table(results);
}

measureActions().catch(console.error);
