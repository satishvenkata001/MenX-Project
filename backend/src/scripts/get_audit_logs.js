import pg from 'pg';
import { env } from '../config/env.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL
});

async function main() {
  try {
    const client = await pool.connect();
    console.log("Connected to PostgreSQL database.");

    // Query audit_logs
    try {
      const res = await client.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50");
      console.log("=== Audit Logs ===");
      console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
      console.warn("Could not query audit_logs:", e.message);
    }

    client.release();
  } catch (err) {
    console.error("Database connection/query failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
