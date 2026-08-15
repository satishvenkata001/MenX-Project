import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Privileged Server-Side Supabase Admin Client
 * Uses SUPABASE_SECRET_KEY for backend operations.
 * NEVER expose this client or its secret key to client-facing code.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Creates an isolated ephemeral client for authentication operations
 * (prevents session pollution across concurrent requests)
 */
export const createAuthClient = () => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

/**
 * Helper to create a scoped Supabase client with user's JWT
 * @param {string} token - User's JWT token
 */
export const createUserClient = (token) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
};
