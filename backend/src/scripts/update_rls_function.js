import { pool } from '../config/db.js';

async function updateDb() {
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.is_manager_or_superadmin()
    RETURNS BOOLEAN AS $$
      SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
          AND role IN ('INVENTORY_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN')
          AND is_active = TRUE
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER;
  `);
  console.log('Successfully updated is_manager_or_superadmin in database');
  process.exit(0);
}

updateDb().catch(err => {
  console.error(err);
  process.exit(1);
});
