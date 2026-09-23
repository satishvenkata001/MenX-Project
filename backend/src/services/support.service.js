import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class SupportService {
  /**
   * Create a new support ticket by customer
   */
  static async createTicket(userId, { subject, category, message, orderNumber, orderId }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let resolvedOrderId = null;

      // Validate order ownership if order reference is supplied
      if (orderNumber && orderNumber.trim()) {
        const orderRes = await client.query(
          'SELECT id, customer_id, order_number FROM orders WHERE order_number = $1 OR id::text = $1',
          [orderNumber.trim()]
        );

        if (orderRes.rows.length === 0) {
          throw AppError.badRequest(`Referenced order '${orderNumber.trim()}' was not found.`);
        }

        const order = orderRes.rows[0];
        if (order.customer_id !== userId) {
          throw AppError.forbidden('Access denied: You do not own the referenced order.');
        }

        resolvedOrderId = order.id;
      } else if (orderId) {
        const orderRes = await client.query(
          'SELECT id, customer_id, order_number FROM orders WHERE id = $1',
          [orderId]
        );

        if (orderRes.rows.length === 0) {
          throw AppError.badRequest('Referenced order was not found.');
        }

        const order = orderRes.rows[0];
        if (order.customer_id !== userId) {
          throw AppError.forbidden('Access denied: You do not own the referenced order.');
        }

        resolvedOrderId = order.id;
      }

      // Generate unique ticket number (e.g. SUP-1788792000-5821)
      const timestamp = Math.floor(Date.now() / 1000);
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `SUP-${timestamp}-${randomPart}`;

      // Insert support ticket
      const ticketRes = await client.query(
        `INSERT INTO support_tickets (
           ticket_number, customer_id, order_id, category, subject, message, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
         RETURNING id, ticket_number, customer_id, order_id, category, subject, message, status, created_at, updated_at`,
        [ticketNumber, userId, resolvedOrderId, category, subject, message]
      );

      const ticket = ticketRes.rows[0];

      // Insert initial message into conversation thread
      const msgRes = await client.query(
        `INSERT INTO support_ticket_messages (
           ticket_id, sender_type, sender_id, message
         ) VALUES ($1, 'CUSTOMER', $2, $3)
         RETURNING id, ticket_id, sender_type, sender_id, message, created_at`,
        [ticket.id, userId, message]
      );

      await client.query('COMMIT');

      return {
        ...ticket,
        messages: [msgRes.rows[0]]
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.statusCode) throw err;
      logger.error('Failed to create support ticket', { error: err.message, userId });
      throw AppError.internal('Failed to create support ticket');
    } finally {
      client.release();
    }
  }

  /**
   * List customer's own support tickets
   */
  static async getCustomerTickets(userId, { page = 1, limit = 10, status, category } = {}) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    let query = `
      SELECT st.id, st.ticket_number, st.customer_id, st.order_id, st.category, st.subject,
             st.message, st.status, st.created_at, st.updated_at, st.resolved_at, st.closed_at,
             o.order_number,
             (SELECT COUNT(*) FROM support_ticket_messages stm WHERE stm.ticket_id = st.id) AS message_count
      FROM support_tickets st
      LEFT JOIN orders o ON o.id = st.order_id
      WHERE st.customer_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND st.status = $${paramIndex++}`;
      params.push(status);
    }

    if (category) {
      query += ` AND st.category = $${paramIndex++}`;
      params.push(category);
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
      logger.error('Failed to query customer support tickets', { error: err.message, userId });
      throw AppError.internal('Failed to retrieve support tickets');
    }
  }

  /**
   * Get full ticket details with conversation thread for customer
   */
  static async getCustomerTicketDetails(userId, ticketId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    try {
      const ticketRes = await pool.query(
        `SELECT st.id, st.ticket_number, st.customer_id, st.order_id, st.category, st.subject,
                st.message, st.status, st.created_at, st.updated_at, st.resolved_at, st.closed_at,
                o.order_number, o.created_at AS order_created_at
         FROM support_tickets st
         LEFT JOIN orders o ON o.id = st.order_id
         WHERE st.id = $1`,
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        throw AppError.notFound('Support ticket not found');
      }

      const ticket = ticketRes.rows[0];

      // Enforce strict customer isolation
      if (ticket.customer_id !== userId) {
        throw AppError.forbidden('Access denied: You do not have permission to access this support ticket');
      }

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

      return {
        ...ticket,
        messages: messagesRes.rows
      };
    } catch (err) {
      if (err.statusCode) throw err;
      logger.error('Failed to get customer ticket details', { error: err.message, ticketId, userId });
      throw AppError.internal('Failed to retrieve support ticket details');
    }
  }

  /**
   * Add a message reply by customer
   */
  static async addCustomerMessage(userId, ticketId, { message }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ticketRes = await client.query(
        'SELECT id, customer_id, status FROM support_tickets WHERE id = $1 FOR UPDATE',
        [ticketId]
      );

      if (ticketRes.rows.length === 0) {
        throw AppError.notFound('Support ticket not found');
      }

      const ticket = ticketRes.rows[0];

      if (ticket.customer_id !== userId) {
        throw AppError.forbidden('Access denied: You do not own this support ticket');
      }

      if (ticket.status === 'CLOSED') {
        throw AppError.badRequest('Cannot add replies to a closed support ticket. Please submit a new ticket.');
      }

      // Insert message
      const msgRes = await client.query(
        `INSERT INTO support_ticket_messages (
           ticket_id, sender_type, sender_id, message
         ) VALUES ($1, 'CUSTOMER', $2, $3)
         RETURNING id, ticket_id, sender_type, sender_id, message, created_at`,
        [ticketId, userId, message]
      );

      // Update ticket updated_at
      await client.query(
        'UPDATE support_tickets SET updated_at = NOW() WHERE id = $1',
        [ticketId]
      );

      await client.query('COMMIT');

      // Fetch profile for sender info
      const senderProfile = await pool.query(
        'SELECT first_name, last_name, role FROM profiles WHERE id = $1',
        [userId]
      );

      return {
        ...msgRes.rows[0],
        first_name: senderProfile.rows[0]?.first_name || 'Customer',
        last_name: senderProfile.rows[0]?.last_name || '',
        sender_role: senderProfile.rows[0]?.role || 'CUSTOMER'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.statusCode) throw err;
      logger.error('Failed to add customer ticket message', { error: err.message, ticketId, userId });
      throw AppError.internal('Failed to submit message');
    } finally {
      client.release();
    }
  }
}
