import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function main() {
  const customerEmail = 'venkataramana@gmail.com';
  const customerPassword = 'Customer!SecurePass2026';

  // Find customer user id
  const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById('159fc47d-8c6a-444e-b334-ce70994cbdea');
  console.log('Customer auth record:', userRecord?.user?.email);

  await supabaseAdmin.auth.admin.updateUserById('159fc47d-8c6a-444e-b334-ce70994cbdea', {
    password: customerPassword,
    email_confirm: true
  });

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: customerEmail,
    password: customerPassword
  });

  console.log('Customer login test:', error ? 'FAILED: ' + error.message : 'SUCCESS: ' + data.user.id);
}

main().catch(console.error);
