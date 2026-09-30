import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  DATABASE_URL: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('600'),
  ADMIN_RATE_LIMIT_MAX: z.string().transform(Number).default('1500'),
  AUTH_RATE_LIMIT_MAX: z.string().transform(Number).default('15'),
  REFRESH_RATE_LIMIT_MAX: z.string().transform(Number).default('60'),
  ORDER_RATE_LIMIT_MAX: z.string().transform(Number).default('5'),
  ORDER_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  IMAGE_MAX_SIZE_BYTES: z.string().transform(Number).default('2097152'), // 2MB
  IMAGE_BUCKET_NAME: z.string().default('menx-product-images')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error('[FATAL CONFIG ERROR] Invalid environment variables:\n' + issues);
  process.exit(1);
}

export const env = parsed.data;
