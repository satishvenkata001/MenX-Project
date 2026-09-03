import pg from 'pg';
import { env } from '../config/env.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL
});

async function main() {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database.");

    // Query 1: check vault secrets
    try {
      const res = await client.query("SELECT * FROM vault.decrypted_secrets");
      console.log("=== Vault Decrypted Secrets ===");
      console.log(res.rows);
    } catch (e) {
      console.warn("Could not query vault.decrypted_secrets:", e.message);
    }

    // Query 2: check auth settings or configuration tables
    try {
      const res = await client.query("SELECT * FROM auth.instances");
      console.log("=== Auth Instances ===");
      console.log(res.rows);
    } catch (e) {
      console.warn("Could not query auth.instances:", e.message);
    }

    client.release();
  } catch (err) {
    console.error("Database connection/query failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
