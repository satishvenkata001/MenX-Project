import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';

async function checkAdminUser() {
  if (!pool) return;
  const res = await pool.query(`
    SELECT id, email, role, first_name, last_name 
    FROM profiles 
    WHERE role IN ('SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER')
    LIMIT 5;
  `);
  console.log('Admin profiles:', res.rows);
  await pool.end();
}
checkAdminUser().catch(console.error);
