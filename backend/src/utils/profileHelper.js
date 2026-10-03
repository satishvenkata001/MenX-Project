import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from './logger.js';

/**
 * Fetches an existing user profile by user UUID from PostgreSQL pool or Supabase PostgREST.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} The profile record or null
 */
export async function fetchProfileById(userId) {
  if (!userId) return null;

  // 1. Direct PostgreSQL pool query for lowest latency (~5-15ms)
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId]);
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (err) {
      logger.error('Error fetching profile from PostgreSQL pool', {
        error: err.message,
        userId
      });
    }
  }

  // 2. Fallback to Supabase PostgREST if pool query failed or not initialized
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      return data;
    }
  } catch (err) {
    logger.error('Error fetching profile from Supabase PostgREST', {
      error: err.message,
      userId
    });
  }

  return null;
}

/**
 * Safely fetches an existing profile or auto-heals a missing CUSTOMER profile
 * for a cryptographically verified Supabase auth user.
 *
 * Safety requirements:
 * 1. Only called after Supabase Auth has successfully authenticated/resolved the user.
 * 2. If a profile already exists, returns it immediately without modifying roles or fields.
 * 3. Handles concurrent inserts gracefully (ON CONFLICT DO NOTHING / re-fetch).
 * 4. Extracts metadata cleanly with safe fallbacks.
 * 5. Uses default role 'CUSTOMER'.
 *
 * @param {Object} authUser - Verified Supabase user object (must have id)
 * @returns {Promise<Object|null>} The existing or newly created profile record
 */
export async function ensureUserProfile(authUser) {
  if (!authUser || !authUser.id) {
    return null;
  }

  const userId = authUser.id;

  // 1. Return existing profile immediately if already present
  let profile = await fetchProfileById(userId);
  if (profile) {
    return profile;
  }

  // 2. Extract profile fields safely from auth user metadata
  const userMeta = authUser.user_metadata || {};
  const email = (authUser.email || userMeta.email || '').trim().toLowerCase();

  const firstName = (
    userMeta.first_name ||
    userMeta.given_name ||
    (userMeta.name ? userMeta.name.split(' ')[0] : '') ||
    (email ? email.split('@')[0] : '') ||
    'Customer'
  ).trim();

  const lastName = (
    userMeta.last_name ||
    userMeta.family_name ||
    (userMeta.name && userMeta.name.split(' ').length > 1
      ? userMeta.name.split(' ').slice(1).join(' ')
      : null) ||
    null
  );

  const phone = (userMeta.phone || authUser.phone || '').trim();

  logger.info('Auto-healing missing customer profile for authenticated user', {
    userId,
    email
  });

  // 3. Insert new profile with concurrency conflict handling
  if (pool) {
    try {
      const insertSql = `
        INSERT INTO profiles (id, first_name, last_name, email, phone, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING *;
      `;
      const res = await pool.query(insertSql, [userId, firstName, lastName, email, phone]);
      if (res.rows.length > 0) {
        return res.rows[0];
      }

      // If ON CONFLICT returned 0 rows, another concurrent request created it; fetch existing
      return await fetchProfileById(userId);
    } catch (dbErr) {
      logger.error('Error auto-healing profile via PostgreSQL pool', {
        error: dbErr.message,
        userId
      });
    }
  }

  // Fallback to Supabase PostgREST if pool is unavailable
  try {
    const { data: created, error: insertErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role: 'CUSTOMER'
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
      .select()
      .single();

    if (!insertErr && created) {
      return created;
    }

    // If duplicate or conflict, re-fetch
    return await fetchProfileById(userId);
  } catch (err) {
    logger.error('Failed to auto-heal profile via Supabase', {
      error: err.message,
      userId
    });
    return null;
  }
}
