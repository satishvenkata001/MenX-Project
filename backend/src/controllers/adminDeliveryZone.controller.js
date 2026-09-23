import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/appError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

/**
 * Format a delivery zone row for consistent frontend consumption
 */
function formatZone(row) {
  // Extract state & district from name if available (e.g., "Andhra Pradesh - West Godavari (534340)")
  let state = 'Andhra Pradesh';
  let district = null;

  if (row.name) {
    if (row.name.startsWith('Andhra Pradesh - ')) {
      const remainder = row.name.replace('Andhra Pradesh - ', '');
      const match = remainder.match(/^(.*?)(?:\s*\(\d+\))?$/);
      if (match) district = match[1].trim();
    } else if (row.name === 'LOCAL') {
      district = 'Local Delivery';
    }
  }

  return {
    id: row.id,
    name: row.name,
    pincode: row.pincode_pattern,
    state: state,
    district: district,
    baseDeliveryCharge: Number(row.base_delivery_charge),
    freeDeliveryThreshold: row.free_delivery_threshold !== null ? Number(row.free_delivery_threshold) : null,
    estimatedDaysMin: row.estimated_days_min,
    estimatedDaysMax: row.estimated_days_max,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * GET /api/v1/admin/delivery-zones
 * Retrieve paginated delivery PIN codes with search and filter capabilities
 */
export const listDeliveryZonesAdminHandler = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, search, status = 'ALL', state } = req.query;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 25;
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    conditions.push(`(pincode_pattern ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`);
    params.push(term);
    paramIdx++;
  }

  if (status === 'ACTIVE') {
    conditions.push(`is_active = TRUE`);
  } else if (status === 'INACTIVE') {
    conditions.push(`is_active = FALSE`);
  }

  if (state && state.trim() !== '' && state !== 'ALL') {
    conditions.push(`name ILIKE $${paramIdx}`);
    params.push(`%${state.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Fetch filtered zones
  const querySql = `
    SELECT id, name, pincode_pattern, base_delivery_charge, free_delivery_threshold, estimated_days_min, estimated_days_max, is_active, created_at, updated_at
    FROM delivery_zones
    ${whereClause}
    ORDER BY pincode_pattern ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  const queryParams = [...params, limitNum, offset];

  // 2. Fetch filtered count & global active/inactive summary counts in parallel
  const [dataRes, countRes, statsRes] = await Promise.all([
    pool.query(querySql, queryParams),
    pool.query(`SELECT COUNT(*) FROM delivery_zones ${whereClause}`, params),
    pool.query(`
      SELECT 
        COUNT(*) AS total_all,
        COUNT(*) FILTER (WHERE is_active = TRUE) AS active_count,
        COUNT(*) FILTER (WHERE is_active = FALSE) AS inactive_count
      FROM delivery_zones
    `)
  ]);

  const total = parseInt(countRes.rows[0].count, 10);
  const totalPages = Math.ceil(total / limitNum) || 1;
  const activeCount = parseInt(statsRes.rows[0].active_count, 10) || 0;
  const inactiveCount = parseInt(statsRes.rows[0].inactive_count, 10) || 0;
  const totalConfigured = parseInt(statsRes.rows[0].total_all, 10) || 0;

  const items = dataRes.rows.map(formatZone);

  return sendSuccess(res, {
    zones: items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages
    },
    summary: {
      totalConfigured,
      activeCount,
      inactiveCount
    }
  }, 'Delivery zones retrieved successfully');
});

/**
 * POST /api/v1/admin/delivery-zones
 * Add a new delivery PIN code to the system
 */
export const createDeliveryZoneAdminHandler = asyncHandler(async (req, res) => {
  const {
    pincode,
    state = 'Andhra Pradesh',
    district,
    isActive = true,
    baseDeliveryCharge = 20.00,
    estimatedDaysMin = 5,
    estimatedDaysMax = 9
  } = req.body;

  const cleanPin = pincode.trim();

  // 1. Check for duplicate PIN code
  const existing = await pool.query(
    'SELECT id, pincode_pattern, is_active FROM delivery_zones WHERE pincode_pattern = $1',
    [cleanPin]
  );

  if (existing.rows.length > 0) {
    const existingRow = existing.rows[0];
    throw AppError.badRequest(
      `PIN code ${cleanPin} is already configured (${existingRow.is_active ? 'Active' : 'Inactive'}). Modify its status instead.`
    );
  }

  // 2. Construct friendly zone name
  let zoneName = `${state} (${cleanPin})`;
  if (district && district.trim()) {
    zoneName = `${state} - ${district.trim()} (${cleanPin})`;
  }

  // 3. Insert into delivery_zones
  const insertRes = await pool.query(`
    INSERT INTO delivery_zones (
      name,
      pincode_pattern,
      base_delivery_charge,
      free_delivery_threshold,
      estimated_days_min,
      estimated_days_max,
      is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    zoneName,
    cleanPin,
    baseDeliveryCharge,
    null,
    estimatedDaysMin,
    estimatedDaysMax,
    isActive
  ]);

  const created = formatZone(insertRes.rows[0]);
  return sendCreated(res, created, `Delivery PIN code ${cleanPin} added successfully`);
});

/**
 * PATCH /api/v1/admin/delivery-zones/:id/status
 * Toggle active status of a delivery PIN code
 */
export const updateDeliveryZoneStatusAdminHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const updateRes = await pool.query(`
    UPDATE delivery_zones
    SET is_active = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [isActive, id]);

  if (updateRes.rows.length === 0) {
    throw AppError.notFound('Delivery zone not found');
  }

  const updated = formatZone(updateRes.rows[0]);
  return sendSuccess(
    res,
    updated,
    `Delivery PIN code ${updated.pincode} ${isActive ? 'activated' : 'deactivated'} successfully`
  );
});

/**
 * DELETE /api/v1/admin/delivery-zones/:id
 * Delete a delivery PIN code record
 */
export const deleteDeliveryZoneAdminHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleteRes = await pool.query(
    'DELETE FROM delivery_zones WHERE id = $1 RETURNING id, pincode_pattern',
    [id]
  );

  if (deleteRes.rows.length === 0) {
    throw AppError.notFound('Delivery zone not found');
  }

  const deletedPin = deleteRes.rows[0].pincode_pattern;
  return sendSuccess(res, { id, pincode: deletedPin }, `Delivery PIN code ${deletedPin} deleted successfully`);
});
