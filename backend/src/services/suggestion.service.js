import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class SuggestionService {
  /**
   * Submit customer feedback / suggestion
   */
  static async createSuggestion(userId, { message }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    try {
      const res = await pool.query(
        `INSERT INTO customer_suggestions (
           customer_id, message, status
         ) VALUES ($1, $2, 'NEW')
         RETURNING id, customer_id, message, status, created_at, updated_at`,
        [userId || null, message.trim()]
      );

      return res.rows[0];
    } catch (err) {
      logger.error('Failed to create customer suggestion', { error: err.message, userId });
      throw AppError.internal('Failed to submit suggestion');
    }
  }

  /**
   * List suggestions for admin portal
   */
  static async listSuggestionsAdmin({ page = 1, limit = 10, status, search } = {}) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    let query = `
      SELECT cs.id, cs.customer_id, cs.message, cs.status, cs.admin_note, cs.created_at, cs.updated_at,
             p.first_name, p.last_name, p.email, p.phone
      FROM customer_suggestions cs
      LEFT JOIN profiles p ON p.id = cs.customer_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND cs.status = $${paramIndex++}`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (
        cs.message ILIKE $${paramIndex} OR
        p.first_name ILIKE $${paramIndex} OR
        p.last_name ILIKE $${paramIndex} OR
        p.email ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_sub`;
    const offset = (page - 1) * limit;
    const dataQuery = query + ` ORDER BY cs.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const dataParams = [...params, limit, offset];

    try {
      const [countRes, res] = await Promise.all([
        pool.query(countQuery, params),
        pool.query(dataQuery, dataParams)
      ]);

      const total = parseInt(countRes.rows[0]?.count || 0, 10);
      const totalPages = Math.ceil(total / limit) || 1;

      return {
        suggestions: res.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (err) {
      logger.error('Failed to query admin suggestions', { error: err.message });
      throw AppError.internal('Failed to retrieve suggestions');
    }
  }

  /**
   * Update suggestion status or add admin note
   */
  static async updateSuggestionAdmin(suggestionId, { status, adminNote }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    try {
      const checkRes = await pool.query(
        'SELECT id, status, admin_note FROM customer_suggestions WHERE id = $1',
        [suggestionId]
      );

      if (checkRes.rows.length === 0) {
        throw AppError.notFound('Suggestion not found');
      }

      const current = checkRes.rows[0];
      const newStatus = status || current.status;
      const newAdminNote = adminNote !== undefined ? adminNote : current.admin_note;

      const res = await pool.query(
        `UPDATE customer_suggestions 
         SET status = $1, admin_note = $2, updated_at = NOW() 
         WHERE id = $3
         RETURNING id, customer_id, message, status, admin_note, created_at, updated_at`,
        [newStatus, newAdminNote, suggestionId]
      );

      return res.rows[0];
    } catch (err) {
      if (err.statusCode) throw err;
      logger.error('Failed to update suggestion', { error: err.message, suggestionId });
      throw AppError.internal('Failed to update suggestion');
    }
  }
}
