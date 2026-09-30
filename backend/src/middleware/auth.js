import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { USER_ROLES } from '../config/constants.js';

const STAFF_ROLES = new Set([
  USER_ROLES.STORE_STAFF,
  USER_ROLES.INVENTORY_MANAGER,
  USER_ROLES.ORDER_MANAGER,
  USER_ROLES.STORE_MANAGER,
  USER_ROLES.SUPER_ADMIN
]);

// Security-conscious in-memory cache configuration bounded by JWT exp
const TOKEN_CACHE_TTL_MS = 3 * 60 * 1000;   // 3 minutes max for validated JWT session (bounded by exp)
const PROFILE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes max for user profile & role
const MAX_CACHE_SIZE = 1000;

// Separate Token Authentication Cache and Profile/Role Cache
// tokenAuthCache: Token String -> { user: Object, expiresAt: number }
const tokenAuthCache = new Map();

// profileCache: User ID (UUID) -> { profile: Object, expiresAt: number }
const profileCache = new Map();

/**
 * Safely decodes JWT payload to extract expiration timestamp without trusting signature.
 * Used exclusively for early rejection of expired tokens and calculating cache bounds.
 */
function getJwtExpirationMs(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
  } catch {
    // Non-fatal parse failure; defer to Supabase Auth cryptographic verification
  }
  return null;
}

/**
 * Enforces bounded LRU eviction on a Map
 */
function enforceCacheLimit(cacheMap, maxSize) {
  if (cacheMap.size >= maxSize) {
    const oldestKey = cacheMap.keys().next().value;
    if (oldestKey !== undefined) {
      cacheMap.delete(oldestKey);
    }
  }
}

/**
 * Invalidates cache entry for a given token or user ID immediately.
 * Use this when profile, role, or active status is modified.
 */
export const invalidateAuthCache = (tokenOrUserId) => {
  if (!tokenOrUserId) {
    tokenAuthCache.clear();
    profileCache.clear();
    return;
  }

  // Check if token in tokenAuthCache
  if (tokenAuthCache.has(tokenOrUserId)) {
    const entry = tokenAuthCache.get(tokenOrUserId);
    tokenAuthCache.delete(tokenOrUserId);
    if (entry?.user?.id) {
      profileCache.delete(entry.user.id);
    }
    return;
  }

  // Check if user ID in profileCache
  if (profileCache.has(tokenOrUserId)) {
    profileCache.delete(tokenOrUserId);
  }

  // Remove any token entries for this user ID
  for (const [token, cached] of tokenAuthCache.entries()) {
    if (cached.user?.id === tokenOrUserId) {
      tokenAuthCache.delete(token);
    }
  }
};

export const invalidateProfileCache = (userId) => {
  if (!userId) {
    profileCache.clear();
    return;
  }
  profileCache.delete(userId);
  for (const [token, cached] of tokenAuthCache.entries()) {
    if (cached.user?.id === userId) {
      tokenAuthCache.delete(token);
    }
  }
};

/**
 * Authenticates the Bearer token via Supabase Auth with security-safe short-lived caching
 */
async function authenticateToken(token) {
  const now = Date.now();

  // 1. Early expiration rejection if JWT exp is in the past
  const jwtExpMs = getJwtExpirationMs(token);
  if (jwtExpMs && jwtExpMs <= now) {
    tokenAuthCache.delete(token);
    return null;
  }

  // 2. Check token authentication cache
  const cached = tokenAuthCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  // 3. Perform cryptographic token verification via Supabase Auth server
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    tokenAuthCache.delete(token);
    return null;
  }

  const user = data.user;

  // 4. Bound cache TTL to whichever is shorter: 15s window or actual JWT expiry
  const maxTtlExpiry = now + TOKEN_CACHE_TTL_MS;
  const effectiveExpiresAt = jwtExpMs ? Math.min(maxTtlExpiry, jwtExpMs) : maxTtlExpiry;

  enforceCacheLimit(tokenAuthCache, MAX_CACHE_SIZE);
  tokenAuthCache.set(token, {
    user,
    expiresAt: effectiveExpiresAt
  });

  return user;
}

/**
 * Looks up user profile and role from PostgreSQL with short-lived caching and immediate invalidation
 */
async function lookupProfile(userId) {
  const now = Date.now();

  // 1. Check profile cache
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.profile;
  }

  let profile = null;

  // 2. Fetch directly from PostgreSQL pool for low latency (~5-15ms)
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId]);
      if (res.rows.length > 0) {
        profile = res.rows[0];
      }
    } catch (err) {
      logger.error('Error fetching profile from PostgreSQL pool', { error: err.message, userId });
    }
  }

  // Fallback to Supabase PostgREST if pool query failed or not initialized
  if (!profile) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      profile = data;
    }
  }

  if (!profile) {
    profileCache.delete(userId);
    return null;
  }

  // 3. Store in profile cache with 15s TTL
  enforceCacheLimit(profileCache, MAX_CACHE_SIZE);
  profileCache.set(userId, {
    profile,
    expiresAt: now + PROFILE_CACHE_TTL_MS
  });

  return profile;
}

/**
 * Checks if incoming request has a valid Bearer token belonging to an authorized staff role.
 * Attaches req.user, req.profile, req.token if valid so downstream requireAuth does not re-fetch.
 */
export const isAuthorizedStaffRequest = async (req) => {
  try {
    if (req.user && req.profile && STAFF_ROLES.has(req.profile.role)) {
      return true;
    }

    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      return false;
    }

    const user = await authenticateToken(token);
    if (!user || !user.id) {
      return false;
    }

    const profile = await lookupProfile(user.id);
    if (!profile || profile.is_active === false) {
      return false;
    }

    if (STAFF_ROLES.has(profile.role)) {
      req.user = user;
      req.profile = profile;
      req.token = token;
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Authentication Middleware
 * Validates Bearer token cryptographically and attaches current profile/role.
 */
export const requireAuth = async (req, res, next) => {
  try {
    // If already authenticated by upstream check (e.g. isAuthorizedStaffRequest)
    if (req.user && req.profile) {
      if (req.profile.is_active === false) {
        return next(AppError.forbidden('User account has been deactivated. Please contact support.'));
      }
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(AppError.unauthorized('Authentication required: Missing or malformed Bearer token'));
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.trim() === '') {
      return next(AppError.unauthorized('Authentication required: Token cannot be empty'));
    }

    // 1. Authenticate token
    const user = await authenticateToken(token);
    if (!user) {
      logger.debug('Auth token verification failed');
      return next(AppError.unauthorized('Invalid or expired authentication token'));
    }

    // 2. Look up profile and role
    const profile = await lookupProfile(user.id);
    if (!profile) {
      logger.warn(`Profile record not found for authenticated user ID: ${user.id}`);
      return next(AppError.unauthorized('User profile not found. Please re-authenticate.'));
    }

    // 3. Check active status
    if (profile.is_active === false) {
      return next(AppError.forbidden('User account has been deactivated. Please contact support.'));
    }

    // Attach user, profile, and token to request object
    req.user = user;
    req.profile = profile;
    req.token = token;

    next();
  } catch (err) {
    logger.error('Unexpected error in auth middleware', { error: err.message });
    next(AppError.unauthorized('Authentication failed due to an internal error'));
  }
};

/**
 * Optional Auth Middleware
 * If token is present and valid, attaches user and profile; if absent or invalid, proceeds as guest.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.profile = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      req.profile = null;
      return next();
    }

    const user = await authenticateToken(token);
    if (!user) {
      req.user = null;
      req.profile = null;
      return next();
    }

    const profile = await lookupProfile(user.id);
    req.user = user;
    req.profile = profile || null;
    req.token = token;

    next();
  } catch (err) {
    req.user = null;
    req.profile = null;
    next();
  }
};


