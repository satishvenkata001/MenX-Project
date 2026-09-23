import { pool } from '../config/db.js';

async function addPerformanceIndexes() {
  if (!pool) {
    console.error('Database pool not configured');
    process.exit(1);
  }

  console.log('--- ADDING PERFORMANCE INDEXES ---');

  const indexes = [
    {
      name: 'idx_profiles_role',
      sql: 'CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);'
    },
    {
      name: 'idx_profiles_email',
      sql: 'CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);'
    },
    {
      name: 'idx_profiles_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles (created_at DESC);'
    }
  ];

  for (const idx of indexes) {
    const start = Date.now();
    await pool.query(idx.sql);
    console.log(`[INDEX CREATED] ${idx.name} in ${Date.now() - start}ms`);
  }

  console.log('All performance indexes added successfully.');
  await pool.end();
}

addPerformanceIndexes().catch(err => {
  console.error('Failed to create indexes:', err);
  process.exit(1);
});
