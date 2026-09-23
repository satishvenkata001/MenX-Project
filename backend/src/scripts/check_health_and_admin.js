import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function main() {
  const healthRes = await fetch('http://localhost:5000/api/v1/health');
  console.log('Health check status:', healthRes.status, await healthRes.json());

  // Find an existing admin profile or authenticate
  const { data: adminProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .in('role', ['SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER'])
    .eq('is_active', true);
  
  console.log('Found active admin profiles:', adminProfiles);
}

main().catch(console.error);
