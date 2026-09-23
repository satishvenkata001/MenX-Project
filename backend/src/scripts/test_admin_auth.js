import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function main() {
  const adminEmail = 'admin.1786782027454@menx.com';
  // Check auth user
  const { data: userRecord, error: uErr } = await supabaseAdmin.auth.admin.getUserById('c3087fda-138a-4c0d-a00d-73f6b14ba3f4');
  console.log('User record exists:', !uErr, userRecord?.user?.email);

  // We can update the password or generate a token
  // Let's set password to a known secret to login cleanly
  const tempPassword = 'SuperAdmin!SecurePass2026';
  await supabaseAdmin.auth.admin.updateUserById('c3087fda-138a-4c0d-a00d-73f6b14ba3f4', {
    password: tempPassword,
    email_confirm: true
  });

  const authClient = createAuthClient();
  const { data: authRes, error: loginErr } = await authClient.auth.signInWithPassword({
    email: adminEmail,
    password: tempPassword
  });

  if (loginErr) {
    console.error('Login error:', loginErr);
    return;
  }

  const token = authRes.session.access_token;
  console.log('Successfully obtained Super Admin JWT Token! (length:', token.length, ')');

  // Test calling GET /api/v1/admin/categories
  const res = await fetch('http://localhost:5000/api/v1/admin/categories', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  console.log('GET /api/v1/admin/categories status:', res.status);
  const json = await res.json();
  console.log('Categories count:', json.data?.length);
}

main().catch(console.error);
