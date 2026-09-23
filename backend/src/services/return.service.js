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
        pv.product_id,
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
      JOIN product_variants pv ON pv.id = oi.variant_id
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
        productId: row.product_id,
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
        'SELECT id, customer_id, order_status FROM orders WHERE id = $1 FOR UPDATE',
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

      const orderItemIds = sortedItems.map(i => i.orderItemId);
      const replacementVariantIds = sortedItems
        .map(i => i.replacementVariantId)
        .filter(Boolean);

      // 2a. Batch fetch and lock all relevant order items FOR UPDATE
      const orderItemsRes = await client.query(
        'SELECT id, quantity, variant_id FROM order_items WHERE id = ANY($1::uuid[]) AND order_id = $2 ORDER BY id FOR UPDATE',
        [orderItemIds, orderId]
      );
      
      const orderItemsMap = {};
      for (const row of orderItemsRes.rows) {
        orderItemsMap[row.id] = row;
      }

      // 2b. Batch check for active return requests (status = REQUESTED)
      const pendingRes = await client.query(
        `SELECT ri.order_item_id 
         FROM return_items ri
         JOIN return_requests rr ON rr.id = ri.return_request_id
         WHERE ri.order_item_id = ANY($1::uuid[]) AND rr.status = 'REQUESTED'`,
        [orderItemIds]
      );
      const pendingOrderItemIds = new Set(pendingRes.rows.map(row => row.order_item_id));

      // 2c. Batch fetch already returned quantity across all historical return requests
      const returnedRes = await client.query(
        `SELECT ri.order_item_id, COALESCE(SUM(ri.quantity), 0) AS qty
         FROM return_items ri
         JOIN return_requests rr ON rr.id = ri.return_request_id
         WHERE ri.order_item_id = ANY($1::uuid[])
         GROUP BY ri.order_item_id`,
        [orderItemIds]
      );
      const returnedQtyMap = {};
      for (const row of returnedRes.rows) {
        returnedQtyMap[row.order_item_id] = parseInt(row.qty, 10);
      }

      // 2d. For exchanges, batch validate replacement variants active status and stock availability
      const variantsMap = {};
      const inventoryMap = {};
      if (replacementVariantIds.length > 0) {
        const variantsRes = await client.query(
          'SELECT id, is_active FROM product_variants WHERE id = ANY($1::uuid[])',
          [replacementVariantIds]
        );
        for (const row of variantsRes.rows) {
          variantsMap[row.id] = row.is_active;
        }

        const invRes = await client.query(
          'SELECT variant_id, quantity_available FROM inventory_items WHERE variant_id = ANY($1::uuid[])',
          [replacementVariantIds]
        );
        for (const row of invRes.rows) {
          inventoryMap[row.variant_id] = row.quantity_available || 0;
        }
      }

      // 2e. Validate order items using batched data
      for (const item of sortedItems) {
        const orderItem = orderItemsMap[item.orderItemId];
        if (!orderItem) {
          throw AppError.badRequest(`Order item '${item.orderItemId}' does not belong to this order`);
        }

        // Check variant_id matches
        if (orderItem.variant_id !== item.variantId) {
          throw AppError.badRequest(`Variant mismatch for order item '${item.orderItemId}'`);
        }

        // Check if there is already a pending return request (status = REQUESTED) for this order item
        if (pendingOrderItemIds.has(item.orderItemId)) {
          throw AppError.badRequest(`An active return request is already pending for order item '${item.orderItemId}'`);
        }

        // Calculate already returned quantity across all return lifecycles for this order item
        const alreadyReturned = returnedQtyMap[item.orderItemId] || 0;
        const remainingQuantity = orderItem.quantity - alreadyReturned;

        if (alreadyReturned >= orderItem.quantity) {
          throw AppError.badRequest('This item already has an existing return request');
        }

        if (item.quantity > remainingQuantity) {
          throw AppError.badRequest(
            `Requested return quantity (${item.quantity}) exceeds remaining returnable quantity (${remainingQuantity}) for item '${item.orderItemId}'`
          );
        }

        // For exchanges, validate replacement variant exists, is active, is not identical variant, and has available stock
        if (requestType === 'EXCHANGE') {
          if (!item.replacementVariantId) {
            throw AppError.badRequest('Replacement variant ID is required for exchange requests');
          }

          if (item.replacementVariantId === item.variantId) {
            throw AppError.badRequest('Cannot exchange for the exact same size. Please choose a different size or select refund return.');
          }

          const is_active = variantsMap[item.replacementVariantId];
          if (is_active === undefined || !is_active) {
            throw AppError.badRequest('Selected replacement variant is invalid or inactive');
          }

          const availableStock = inventoryMap[item.replacementVariantId] || 0;
          if (availableStock < item.quantity) {
            throw AppError.badRequest('Selected exchange size is no longer available.');
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
        `SELECT rr.id, rr.return_number, rr.order_id, rr.status, rr.request_type, rr.reason,
                rr.customer_comment, rr.requested_at, rr.created_at,
                COALESCE(
                  (
                    SELECT json_agg(
                      json_build_object(
                        'id', ri.id,
                        'order_item_id', ri.order_item_id,
                        'variant_id', ri.variant_id,
                        'quantity', ri.quantity,
                        'replacement_variant_id', ri.replacement_variant_id,
                        'product_title_snapshot', oi.product_title_snapshot,
                        'variant_sku_snapshot', oi.variant_sku_snapshot,
                        'size_snapshot', oi.size_snapshot,
                        'color_snapshot', oi.color_snapshot,
                        'unit_price_snapshot', oi.unit_price_snapshot,
                        'unit_mrp_snapshot', oi.unit_mrp_snapshot,
                        'product_slug', p.slug,
                        'primary_image_url', pimg.image_url,
                        'replacement_size', reps.name,
                        'replacement_color', repc.name
                      )
                    )
                    FROM return_items ri
                    JOIN order_items oi ON oi.id = ri.order_item_id
                    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
                    LEFT JOIN products p ON p.id = pv.product_id
                    LEFT JOIN LATERAL (
                      SELECT image_url 
                      FROM product_images 
                      WHERE product_id = p.id 
                      ORDER BY is_primary DESC, display_order ASC 
                      LIMIT 1
                    ) pimg ON true
                    LEFT JOIN product_variants rep ON rep.id = ri.replacement_variant_id
                    LEFT JOIN sizes reps ON reps.id = rep.size_id
                    LEFT JOIN colors repc ON repc.id = rep.color_id
                    WHERE ri.return_request_id = rr.id
                  ),
                  '[]'::json
                ) AS items
         FROM return_requests rr
         WHERE rr.customer_id = $1
         ORDER BY rr.created_at DESC 
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
        `SELECT rr.id, rr.return_number, rr.order_id, rr.customer_id, rr.status, rr.request_type, rr.reason,
                rr.customer_comment, rr.admin_notes, rr.requested_at, rr.created_at, rr.updated_at,
                o.order_number, o.created_at AS order_created_at
         FROM return_requests rr
         JOIN orders o ON o.id = rr.order_id
         WHERE rr.id = $1 AND rr.customer_id = $2`,
        [returnId, userId]
      );

      if (returnRes.rows.length === 0) {
        throw AppError.notFound('Return request not found');
      }

      const returnReq = returnRes.rows[0];

      // Get return items with historical snapshots and safe catalog enrichment
      const itemsRes = await pool.query(
        `SELECT ri.id, ri.return_request_id, ri.order_item_id, ri.variant_id, ri.quantity,
                ri.replacement_variant_id, ri.condition_on_receipt, ri.created_at,
                oi.product_title_snapshot, oi.variant_sku_snapshot, oi.size_snapshot, oi.color_snapshot,
                oi.unit_price_snapshot, oi.unit_mrp_snapshot, oi.line_subtotal, oi.line_discount, oi.line_total,
                (oi.unit_price_snapshot * ri.quantity) AS item_total,
                p.id AS product_id, p.title AS catalog_title, p.slug AS product_slug, p.status AS product_status,
                b.name AS brand_name, c.name AS category_name, sc.name AS subcategory_name,
                pimg.image_url AS primary_image_url,
                reps.name AS replacement_size, repc.name AS replacement_color, rep.sku AS replacement_sku
         FROM return_items ri
         JOIN order_items oi ON oi.id = ri.order_item_id
         LEFT JOIN product_variants pv ON pv.id = oi.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         LEFT JOIN brands b ON b.id = p.brand_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
         LEFT JOIN LATERAL (
           SELECT image_url 
           FROM product_images 
           WHERE product_id = p.id 
           ORDER BY is_primary DESC, display_order ASC 
           LIMIT 1
         ) pimg ON true
         LEFT JOIN product_variants rep ON rep.id = ri.replacement_variant_id
         LEFT JOIN sizes reps ON reps.id = rep.size_id
         LEFT JOIN colors repc ON repc.id = rep.color_id
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
