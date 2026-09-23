import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class AdminSupportService {
  /**
   * List support tickets for admin/staff portal
   */
  static async listTickets({ page = 1, limit = 10, status, category, search } = {}) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    let query = `
      SELECT st.id, st.ticket_number, st.customer_id, st.order_id, st.category, st.subject,
             st.message, st.status, st.created_at, st.updated_at, st.resolved_at, st.closed_at,
             o.order_number,
             p.first_name, p.last_name, p.email, p.phone,
             (SELECT COUNT(*) FROM support_ticket_messages stm WHERE stm.ticket_id = st.id) AS message_count
      FROM support_tickets st
      JOIN profiles p ON p.id = st.customer_id
      LEFT JOIN orders o ON o.id = st.order_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND st.status = $${paramIndex++}`;
      params.push(status);
    }

    if (category) {
      query += ` AND st.category = $${paramIndex++}`;
      params.push(category);
    }

    if (search && search.trim()) {
      query += ` AND (
        st.ticket_number ILIKE $${paramIndex} OR
        o.order_number ILIKE $${paramIndex} OR
        p.first_name ILIKE $${paramIndex} OR
        p.last_name ILIKE $${paramIndex} OR
        p.email ILIKE $${paramIndex} OR
        st.subject ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_sub`;
    const offset = (page - 1) * limit;
    const dataQuery = query + ` ORDER BY st.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const dataParams = [...params, limit, offset];

    try {
      const [countRes, res] = await Promise.all([
        pool.query(countQuery, params),
        pool.query(dataQuery, dataParams)
      ]);

      const total = parseInt(countRes.rows[0]?.count || 0, 10);
      const totalPages = Math.ceil(total / limit) || 1;

      return {
        tickets: res.rows,
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
      logger.error('Failed to query admin support tickets', { error: err.message });
      throw AppError.internal('Failed to retrieve support tickets');
    }
  }

  /**
   * Get single ticket details for admin/staff
   */
  static async getTicketDetailsAdmin(ticketId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    try {
      const ticketRes = await pool.query(
        `SELECT st.id, st.ticket_number, st.customer_id, st.order_id, st.category, st.subject,
                st.message, st.status, st.created_at, st.updated_at, st.resolved_at, st.closed_at,
                o.order_number, o.created_at AS order_created_at, o.order_status,
                p.first_name, p.last_name, p.email, p.phone
         FROM support_tickets st
         JOIN profiles p ON p.id = st.customer_id
         LEFT JOIN orders o ON o.id = st.order_id
         WHERE st.id = $1`,
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        throw AppError.notFound('Support ticket not found');
      }

      const ticket = ticketRes.rows[0];

      // Fetch complete conversation messages
      const messagesRes = await pool.query(
        `SELECT stm.id, stm.ticket_id, stm.sender_type, stm.sender_id, stm.message, stm.created_at,
                p.first_name, p.last_name, p.role AS sender_role
         FROM support_ticket_messages stm
         JOIN profiles p ON p.id = stm.sender_id
         WHERE stm.ticket_id = $1
         ORDER BY stm.created_at ASC`,
        [ticketId]
      );

      const customer = {
        id: ticket.customer_id,
        first_name: ticket.first_name,
        last_name: ticket.last_name,
        email: ticket.email,
        phone: ticket.phone
      };

      const order = ticket.order_id
        ? {
            id: ticket.order_id,
            order_number: ticket.order_number,
            order_status: ticket.order_status,
            created_at: ticket.order_created_at
          }
        : null;

      return {
        ...ticket,
        customer,
        order,
        messages: messagesRes.rows
      };
    } catch (err) {
      if (err.statusCode) throw err;
      logger.error('Failed to get admin ticket details', { error: err.message, ticketId });
      throw AppError.internal('Failed to retrieve support ticket details');
    }
  }

  /**
   * Add an admin reply message to a support ticket
   */
  static async addAdminMessage(actorId, ticketId, { message }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ticketRes = await client.query(
        'SELECT id, status FROM support_tickets WHERE id = $1 FOR UPDATE',
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        throw AppError.notFound('Support ticket not found');
      }

      const ticket = ticketRes.rows[0];

      // Insert message
      const msgRes = await client.query(
        `INSERT INTO support_ticket_messages (
           ticket_id, sender_type, sender_id, message
         ) VALUES ($1, 'ADMIN', $2, $3)
         RETURNING id, ticket_id, sender_type, sender_id, message, created_at`,
        [ticketId, actorId, message]
      );

      // If ticket is currently OPEN, transition to IN_PROGRESS upon staff response
      let updatedStatus = ticket.status;
      if (ticket.status === 'OPEN') {
        updatedStatus = 'IN_PROGRESS';
        await client.query(
          "UPDATE support_tickets SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1",
          [ticketId]
        );
      } else {
        await client.query(
          'UPDATE support_tickets SET updated_at = NOW() WHERE id = $1',
          [ticketId]
        );
      }

      await client.query('COMMIT');

      // Fetch profile for sender info
      const senderProfile = await pool.query(
        'SELECT first_name, last_name, role FROM profiles WHERE id = $1',
        [actorId]
      );

      return {
        ...msgRes.rows[0],
        ticket_status: updatedStatus,
        first_name: senderProfile.rows[0]?.first_name || 'Staff',
        last_name: senderProfile.rows[0]?.last_name || '',
        sender_role: senderProfile.rows[0]?.role || 'STORE_STAFF'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.statusCode) throw err;
      logger.error('Failed to add admin ticket message', { error: err.message, ticketId, actorId });
      throw AppError.internal('Failed to submit admin reply');
    } finally {
      client.release();
    }
  }

  /**
   * Transition support ticket status
   */
  static async transitionTicketStatus(actorId, ticketId, { status: nextStatus, comment }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ticketRes = await client.query(
        'SELECT id, status FROM support_tickets WHERE id = $1 FOR UPDATE',
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        throw AppError.notFound('Support ticket not found');
      }

      const ticket = ticketRes.rows[0];
      const currentStatus = ticket.status;

      // Status State Machine validation
      const VALID_TRANSITIONS = {
        OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        IN_PROGRESS: ['RESOLVED', 'CLOSED'],
        RESOLVED: ['CLOSED', 'IN_PROGRESS'],
        CLOSED: ['IN_PROGRESS'] // Reopen
      };

      if (currentStatus !== nextStatus) {
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(nextStatus)) {
          throw AppError.badRequest(
            `Invalid support ticket status transition from ${currentStatus} to ${nextStatus}`
          );
        }
      }

      let resolvedAtSql = 'resolved_at';
      if (nextStatus === 'RESOLVED') {
        resolvedAtSql = 'NOW()';
      } else if (nextStatus === 'IN_PROGRESS') {
        resolvedAtSql = 'NULL';
      }

      let closedAtSql = 'closed_at';
      if (nextStatus === 'CLOSED') {
        closedAtSql = 'NOW()';
      } else if (nextStatus === 'IN_PROGRESS') {
        closedAtSql = 'NULL';
      }

      const updatedRes = await client.query(
        `UPDATE support_tickets 
         SET status = $1, 
             resolved_at = ${resolvedAtSql}, 
             closed_at = ${closedAtSql}, 
             updated_at = NOW() 
         WHERE id = $2
         RETURNING id, ticket_number, status, resolved_at, closed_at, updated_at`,
        [nextStatus, ticketId]
      );

      // If comment was attached, log as staff remark in conversation thread
      if (comment && comment.trim()) {
        await client.query(
          `INSERT INTO support_ticket_messages (
             ticket_id, sender_type, sender_id, message
           ) VALUES ($1, 'ADMIN', $2, $3)`,
          [ticketId, actorId, comment.trim()]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        ticketId,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        ...updatedRes.rows[0]
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.statusCode) throw err;
      logger.error('Failed to transition support ticket status', { error: err.message, ticketId, actorId });
      throw AppError.internal('Failed to update ticket status');
    } finally {
      client.release();
    }
  }
}
