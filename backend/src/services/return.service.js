import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';

export class ReturnService {
  /**
   * List order items eligible for return (delivered in the last 7 days, with remaining returnable quantity > 0)
   */
  static async getEligibleItems(userId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const query = `
      SELECT 
        oi.id AS order_item_id,
        oi.order_id,
        oi.variant_id,
        oi.product_title_snapshot,
        oi.variant_sku_snapshot,
        oi.size_snapshot,
        oi.color_snapshot,
        oi.unit_price_snapshot,
        oi.quantity AS purchased_qty,
        o.order_number,
        osh.created_at AS delivered_at,
        COALESCE(returned.qty, 0) AS returned_qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN (
        SELECT order_id, MAX(created_at) AS created_at
        FROM order_status_history
        WHERE to_status = 'DELIVERED'
        GROUP BY order_id
      ) osh ON osh.order_id = o.id
      LEFT JOIN (
        SELECT ri.order_item_id, SUM(ri.quantity) AS qty
        FROM return_items ri
        JOIN return_requests rr ON rr.id = ri.return_request_id
        WHERE rr.status != 'REJECTED' AND rr.status != 'CANCELLED'
        GROUP BY ri.order_item_id
      ) returned ON returned.order_item_id = oi.id
      WHERE o.customer_id = $1
        AND o.order_status IN ('DELIVERED', 'RETURN_REQUESTED')
        AND osh.created_at >= NOW() - INTERVAL '7 days'
        AND oi.quantity - COALESCE(returned.qty, 0) > 0
      ORDER BY osh.created_at DESC, oi.created_at ASC
    `;

    try {
      const res = await pool.query(query, [userId]);
      return res.rows.map(row => ({
        orderItemId: row.order_item_id,
        orderId: row.order_id,
        orderNumber: row.order_number,
        variantId: row.variant_id,
        productTitle: row.product_title_snapshot,
        sku: row.variant_sku_snapshot,
        size: row.size_snapshot,
        color: row.color_snapshot,
        unitPrice: parseFloat(row.unit_price_snapshot),
        purchasedQuantity: row.purchased_qty,
        returnedQuantity: parseInt(row.returned_qty, 10),
        eligibleQuantity: row.purchased_qty - parseInt(row.returned_qty, 10),
        deliveredAt: row.delivered_at
      }));
    } catch (err) {
      logger.error('Failed to query eligible return items', { error: err.message });
      throw AppError.internal('Failed to retrieve eligible items');
    }
  }

  /**
   * Request a return or exchange
   */
  static async createReturnRequest(userId, { orderId, requestType, reason, customerComment, items }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch order and lock row
      const orderRes = await client.query(
        'SELECT id, customer_id, order_status, store_id FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw AppError.notFound('Order not found');
      }

      const order = orderRes.rows[0];

      // Validate ownership
      if (order.customer_id !== userId) {
        throw AppError.forbidden('Access denied: You do not own this order');
      }

      // Validate status
      if (order.order_status !== 'DELIVERED' && order.order_status !== 'RETURN_REQUESTED') {
        throw AppError.badRequest('Only delivered orders are eligible for return/exchange');
      }

      // Validate delivery time window (7 days)
      const deliveryHistRes = await client.query(
        `SELECT created_at FROM order_status_history 
         WHERE order_id = $1 AND to_status = 'DELIVERED' 
         ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      if (deliveryHistRes.rows.length === 0) {
        throw AppError.badRequest('Order has not been delivered');
      }

      const deliveredAt = new Date(deliveryHistRes.rows[0].created_at);
      const now = new Date();
      const diffDays = (now - deliveredAt) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) {
        throw AppError.badRequest('Return period of 7 days from delivery has expired');
      }

      // Sort items by orderItemId to prevent deadlocks
      const sortedItems = [...items].sort((a, b) => a.orderItemId.localeCompare(b.orderItemId));

      // 2. Validate and lock order items
      for (const item of sortedItems) {
        const orderItemRes = await client.query(
          'SELECT id, quantity, variant_id FROM order_items WHERE id = $1 AND order_id = $2 FOR UPDATE',
          [item.orderItemId, orderId]
        );

        if (orderItemRes.rows.length === 0) {
          throw AppError.badRequest(`Order item '${item.orderItemId}' does not belong to this order`);
        }

        const orderItem = orderItemRes.rows[0];

        // Check variant_id matches
        if (orderItem.variant_id !== item.variantId) {
          throw AppError.badRequest(`Variant mismatch for order item '${item.orderItemId}'`);
        }

        // Check if there is already a pending return request (status = REQUESTED) for this order item
        const pendingRes = await client.query(
          `SELECT 1 FROM return_items ri
           JOIN return_requests rr ON rr.id = ri.return_request_id
           WHERE ri.order_item_id = $1 AND rr.status = 'REQUESTED'`,
          [item.orderItemId]
        );

        if (pendingRes.rows.length > 0) {
          throw AppError.badRequest(`An active return request is already pending for order item '${item.orderItemId}'`);
        }

        // Calculate already returned quantity (excluding cancelled/rejected requests)
        const returnedRes = await client.query(
          `SELECT COALESCE(SUM(ri.quantity), 0) AS qty
           FROM return_items ri
           JOIN return_requests rr ON rr.id = ri.return_request_id
           WHERE ri.order_item_id = $1 AND rr.status != 'REJECTED' AND rr.status != 'CANCELLED'`,
          [item.orderItemId]
        );

        const alreadyReturned = parseInt(returnedRes.rows[0].qty, 10);
        const remainingQuantity = orderItem.quantity - alreadyReturned;

        if (item.quantity > remainingQuantity) {
          throw AppError.badRequest(
            `Requested return quantity (${item.quantity}) exceeds remaining returnable quantity (${remainingQuantity}) for item '${item.orderItemId}'`
          );
        }

        // For exchanges, validate replacement variant exists and is active
        if (requestType === 'EXCHANGE') {
          if (!item.replacementVariantId) {
            throw AppError.badRequest('Replacement variant ID is required for exchange requests');
          }

          const variantRes = await client.query(
            'SELECT is_active FROM product_variants WHERE id = $1',
            [item.replacementVariantId]
          );

          if (variantRes.rows.length === 0 || !variantRes.rows[0].is_active) {
            throw AppError.badRequest(`Selected replacement variant is invalid or inactive`);
          }
        }
      }

      // 3. Generate unique return request number
      const timestamp = Math.floor(Date.now() / 1000);
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const returnNumber = `RET-${timestamp}-${randomPart}`;

      // 4. Create return request header
      const returnReqRes = await client.query(
        `INSERT INTO return_requests (
           return_number, order_id, customer_id, status, request_type, reason, customer_comment
         ) VALUES ($1, $2, $3, 'REQUESTED', $4, $5, $6) RETURNING id`,
        [returnNumber, orderId, userId, requestType, reason, customerComment || null]
      );

      const returnRequestId = returnReqRes.rows[0].id;

      // 5. Create return request items
      for (const item of sortedItems) {
        await client.query(
          `INSERT INTO return_items (
             return_request_id, order_item_id, variant_id, quantity, replacement_variant_id
           ) VALUES ($1, $2, $3, $4, $5)`,
          [
            returnRequestId,
            item.orderItemId,
            item.variantId,
            item.quantity,
            requestType === 'EXCHANGE' ? item.replacementVariantId : null
          ]
        );
      }

      // 6. Log status history transition
      await client.query(
        `INSERT INTO return_status_history (
           return_request_id, from_status, to_status, comment
         ) VALUES ($1, NULL, 'REQUESTED', $2)`,
        [returnRequestId, 'Return request submitted by customer']
      );

      // 7. Update order status to RETURN_REQUESTED (if currently DELIVERED)
      if (order.order_status === 'DELIVERED') {
        await client.query(
          "UPDATE orders SET order_status = 'RETURN_REQUESTED', updated_at = NOW() WHERE id = $1",
          [orderId]
        );
      }

      await client.query('COMMIT');
      return {
        success: true,
        returnRequestId,
        returnNumber,
        status: 'REQUESTED'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List return requests for a customer
   */
  static async getReturns(userId, { page = 1, limit = 10 }) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const offset = (page - 1) * limit;
    try {
      const countRes = await pool.query(
        'SELECT COUNT(*) FROM return_requests WHERE customer_id = $1',
        [userId]
      );
      const total = parseInt(countRes.rows[0].count, 10);

      const res = await pool.query(
        `SELECT id, return_number, order_id, status, request_type, reason, customer_comment, requested_at, created_at
         FROM return_requests 
         WHERE customer_id = $1
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const totalPages = Math.ceil(total / limit) || 1;

      return {
        returns: res.rows,
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
      logger.error('Failed to retrieve customer return list', { error: err.message });
      throw AppError.internal('Failed to retrieve return list');
    }
  }

  /**
   * Get single return request details for customer
   */
  static async getReturnDetails(userId, returnId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    try {
      // Get return request
      const returnRes = await pool.query(
        `SELECT id, return_number, order_id, customer_id, status, request_type, reason, customer_comment, admin_notes, requested_at, created_at
         FROM return_requests
         WHERE id = $1 AND customer_id = $2`,
        [returnId, userId]
      );

      if (returnRes.rows.length === 0) {
        throw AppError.notFound('Return request not found');
      }

      const returnReq = returnRes.rows[0];

      // Get return items
      const itemsRes = await pool.query(
        `SELECT ri.id, ri.order_item_id, ri.variant_id, ri.quantity, ri.replacement_variant_id,
                oi.product_title_snapshot, oi.variant_sku_snapshot, oi.size_snapshot, oi.color_snapshot
         FROM return_items ri
         JOIN order_items oi ON oi.id = ri.order_item_id
         WHERE ri.return_request_id = $1`,
        [returnId]
      );

      // Get return status history
      const historyRes = await pool.query(
        `SELECT id, from_status, to_status, comment, created_at
         FROM return_status_history
         WHERE return_request_id = $1
         ORDER BY created_at ASC`,
        [returnId]
      );

      return {
        ...returnReq,
        items: itemsRes.rows,
        history: historyRes.rows
      };
    } catch (err) {
      if (err.statusCode) throw err;
      logger.error('Failed to retrieve return details', { error: err.message });
      throw AppError.internal('Failed to retrieve return details');
    }
  }

  /**
   * Cancel a return request
   */
  static async cancelReturn(userId, returnId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const returnRes = await client.query(
        'SELECT id, customer_id, order_id, status FROM return_requests WHERE id = $1 FOR UPDATE',
        [returnId]
      );

      if (returnRes.rows.length === 0) {
        throw AppError.notFound('Return request not found');
      }

      const returnReq = returnRes.rows[0];

      if (returnReq.customer_id !== userId) {
        throw AppError.forbidden('Access denied: You do not own this return request');
      }

      if (returnReq.status !== 'REQUESTED') {
        throw AppError.badRequest(`Cannot cancel return request in ${returnReq.status} state`);
      }

      // Update return status
      await client.query(
        "UPDATE return_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1",
        [returnId]
      );

      // Add to status history
      await client.query(
        `INSERT INTO return_status_history (
           return_request_id, from_status, to_status, comment
         ) VALUES ($1, 'REQUESTED', 'CANCELLED', $2)`,
        [returnId, 'Cancelled by customer']
      );

      // Check if there are other active return requests for the order
      const activeRes = await client.query(
        "SELECT COUNT(*) FROM return_requests WHERE order_id = $1 AND status != 'CANCELLED' AND status != 'REJECTED'",
        [returnReq.order_id]
      );

      const activeCount = parseInt(activeRes.rows[0].count, 10);
      if (activeCount === 0) {
        // No other active return requests, transition order status back to DELIVERED
        await client.query(
          "UPDATE orders SET order_status = 'DELIVERED', updated_at = NOW() WHERE id = $1",
          [returnReq.order_id]
        );
      }

      await client.query('COMMIT');
      return { success: true, message: 'Return request successfully cancelled' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
