import pg from 'pg';
import { env } from '../config/env.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL
});

async function main() {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database.");

    // Query 1: Search for JWT-related settings
    const settingsRes = await client.query("SELECT name, setting FROM pg_settings WHERE name LIKE '%jwt%' OR name LIKE '%secret%'");
    console.log("=== DB Settings ===");
    console.log(settingsRes.rows);

    client.release();
  } catch (err) {
    console.error("Database query failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
