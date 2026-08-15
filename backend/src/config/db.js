import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let pool = null;

if (env.DATABASE_URL) {
  pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  logger.info('PostgreSQL connection pool initialized.');
} else {
  logger.warn('DATABASE_URL is not set. Direct database transactions will not be available.');
}

export { pool };
export default pool;
