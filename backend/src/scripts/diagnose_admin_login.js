import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function main() {
  console.log('=== 1. CHECK SUPABASE AUTH USER FOR ADMIN ===');
  const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error('listUsers error:', listErr);
  }

  const adminEmail = 'admin.1786782027454@menx.com';
  const adminUser = userList?.users?.find(u => u.email === adminEmail);
  console.log('Admin user found in Auth:', adminUser ? {
    id: adminUser.id,
    email: adminUser.email,
    email_confirmed_at: adminUser.email_confirmed_at,
    confirmed_at: adminUser.confirmed_at,
    last_sign_in_at: adminUser.last_sign_in_at,
    app_metadata: adminUser.app_metadata,
    user_metadata: adminUser.user_metadata
  } : 'NOT FOUND');

  console.log('\n=== 2. CHECK PROFILES ROW FOR ADMIN ===');
  const { rows: profileRows } = await pool.query('SELECT * FROM profiles WHERE email = $1', [adminEmail]);
  console.table(profileRows);

  console.log('\n=== 3. TEST AUTHENTICATION VIA BACKEND AUTH SERVICE / API ===');
  // Try login via API
  const testPasswords = [
    'SuperAdmin!SecurePass2026',
    'Admin@123',
    'Password123!',
    'admin123',
    'Admin123456',
    'admin.1786782027454@menx.com'
  ];

  for (const pw of testPasswords) {
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password: pw
    });
    console.log(`Testing password "${pw}": ${error ? 'FAILED (' + error.message + ')' : 'SUCCESS (User ID: ' + data.user.id + ')'}`);
  }
}

main().then(() => process.exit(0)).catch(console.error);
