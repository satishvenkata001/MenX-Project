import { pool } from '../config/db.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function main() {
  console.log('=== TEST ALL KNOWN LOGINS ===');

  // Let's check venkataramana@gmail.com
  const customerEmail = 'venkataramana@gmail.com';
  const { rows: custProfile } = await pool.query('SELECT * FROM profiles WHERE email = $1', [customerEmail]);
  console.log('Customer profile:', custProfile);

  // Let's test customer login with standard passwords
  for (const pw of ['Password123!', 'Password123!Secure', 'Venkat@123', 'admin123', '12345678']) {
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: customerEmail,
      password: pw
    });
    console.log(`Customer with "${pw}": ${error ? 'FAILED (' + error.message + ')' : 'SUCCESS (ID: ' + data.user.id + ')'}`);
  }

  // Let's check admin
  const adminEmail = 'admin.1786782027454@menx.com';
  const { rows: adminProfile } = await pool.query('SELECT * FROM profiles WHERE email = $1', [adminEmail]);
  console.log('Admin profile:', adminProfile);
}

main().then(() => process.exit(0)).catch(console.error);
