import pg from 'pg';
import { env } from '../config/env.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL
});

async function main() {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database.");

    // Query 1: list all schemas
    const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata");
    console.log("=== Schemas ===");
    console.log(schemasRes.rows.map(r => r.schema_name));

    // Query 2: list all tables in all schemas (excluding standard pg_ catalogs)
    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);
    console.log("=== Tables ===");
    console.log(tablesRes.rows);

    client.release();
  } catch (err) {
    console.error("Database connection/query failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
