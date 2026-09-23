import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { USER_ROLES } from '../config/constants.js';

export class AdminReturnService {
  /**
   * List return requests for admin/staff
   */
  static async listReturns({ page = 1, limit = 10, status, search } = {}) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    let query = `
      SELECT rr.id, rr.return_number, rr.order_id, rr.customer_id, rr.status, rr.request_type, rr.reason,
             rr.customer_comment, rr.admin_notes, rr.requested_at, rr.created_at,
             o.order_number,
             p.first_name, p.last_name, p.email
      FROM return_requests rr
      LEFT JOIN orders o ON o.id = rr.order_id
      LEFT JOIN profiles p ON p.id = rr.customer_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'ALL' && status.trim() !== '') {
      query += ` AND rr.status = $${paramIndex++}`;
      params.push(status.trim());
    }

    if (search) {
      query += ` AND (rr.return_number ILIKE $${paramIndex} OR o.order_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Prepare pagination query
    const countQuery = `SELECT COUNT(*) FROM (${query}) as count_sub`;
    const dataQuery = query + ` ORDER BY rr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];

    const [countRes, res] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, dataParams)
    ]);

    const total = parseInt(countRes.rows[0]?.count || 0, 10);
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
  }

  /**
   * Get single return request details for admin/staff
   */
  static async getReturnDetailsAdmin(returnId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const returnRes = await pool.query(
      `SELECT rr.*, o.order_number, o.created_at AS order_created_at, o.customer_phone,
              p.first_name, p.last_name, p.email
       FROM return_requests rr
       LEFT JOIN orders o ON o.id = rr.order_id
       LEFT JOIN profiles p ON p.id = rr.customer_id
       WHERE rr.id = $1`,
      [returnId]
    );

    if (returnRes.rows.length === 0) {
      throw AppError.notFound('Return request not found');
    }

    const returnReq = returnRes.rows[0];

    // Fetch return items and status history concurrently
    const [itemsRes, historyRes] = await Promise.all([
      pool.query(
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
      ),
      pool.query(
        `SELECT id, from_status, to_status, comment, created_at
         FROM return_status_history
         WHERE return_request_id = $1
         ORDER BY created_at ASC`,
        [returnId]
      )
    ]);

    return {
      ...returnReq,
      items: itemsRes.rows,
      history: historyRes.rows
    };
  }

  /**
   * Transition return request status
   */
  static async transitionReturnStatus(returnId, nextStatus, { comment, itemsCondition } = {}, actorId) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch return request and lock
      const returnRes = await client.query(
        `SELECT rr.id, rr.return_number, rr.order_id, rr.status, rr.request_type, rr.reason, rr.customer_id,
                o.customer_phone, o.shipping_address_id, o.shipping_snapshot
         FROM return_requests rr
         JOIN orders o ON o.id = rr.order_id
         WHERE rr.id = $1 FOR UPDATE`,
        [returnId]
      );

      if (returnRes.rows.length === 0) {
        throw AppError.notFound('Return request not found');
      }

      const returnReq = returnRes.rows[0];
      const currentStatus = returnReq.status;

      // 2. Validate return status machine transitions
      const VALID_TRANSITIONS = {
        REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
        APPROVED: ['PICKUP_SCHEDULED', 'RECEIVED_IN_STORE', 'CANCELLED'],
        PICKUP_SCHEDULED: ['RECEIVED_IN_STORE', 'CANCELLED'],
        RECEIVED_IN_STORE: ['COMPLETED', 'REJECTED'],
        COMPLETED: [],
        REJECTED: [],
        CANCELLED: []
      };

      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(nextStatus)) {
        throw AppError.badRequest(`Invalid return request transition from ${currentStatus} to ${nextStatus}`);
      }

      // 3. Handle status-specific logic
      if (nextStatus === 'APPROVED' && returnReq.request_type === 'EXCHANGE') {
        // --- RESERVATION PHASE ---
        const itemsRes = await client.query(
          `SELECT id, quantity, replacement_variant_id 
           FROM return_items 
           WHERE return_request_id = $1 
           ORDER BY replacement_variant_id ASC`,
          [returnId]
        );

        for (const item of itemsRes.rows) {
          if (!item.replacement_variant_id) {
            throw AppError.badRequest('Replacement variant is not defined on exchange item');
          }

          // Lock replacement inventory row
          const invRes = await client.query(
            `SELECT quantity_available 
             FROM inventory_items 
             WHERE variant_id = $1 FOR UPDATE`,
            [item.replacement_variant_id]
          );

          if (invRes.rows.length === 0) {
            throw AppError.badRequest(`No inventory record exists for replacement variant`);
          }

          const available = invRes.rows[0].quantity_available;
          if (available < item.quantity) {
            throw AppError.badRequest(
              `Insufficient stock for replacement variant. Requested: ${item.quantity}, Available: ${available}`
            );
          }

          // Reserve stock: available down, reserved up
          await client.query(
            `UPDATE inventory_items 
             SET 
               quantity_available = quantity_available - $1,
               quantity_reserved = quantity_reserved + $1,
               updated_at = NOW()
             WHERE variant_id = $2`,
            [item.quantity, item.replacement_variant_id]
          );

          // Log reservation stock movement
          await client.query(
            `INSERT INTO stock_movements (
               variant_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
             ) VALUES ($1, 'ONLINE_ORDER_RESERVED', $2, 'RETURN_REQUEST', $3, 'Exchange replacement reserved', $4)`,
            [item.replacement_variant_id, item.quantity, returnId, actorId]
          );
        }
      } else if (nextStatus === 'RECEIVED_IN_STORE') {
        // Update condition on receipt for return items
        if (!itemsCondition || !Array.isArray(itemsCondition) || itemsCondition.length === 0) {
          throw AppError.badRequest('Items condition list is required when marking return as received in store');
        }

        for (const cond of itemsCondition) {
          const itemRes = await client.query(
            'SELECT id FROM return_items WHERE id = $1 AND return_request_id = $2',
            [cond.returnItemId, returnId]
          );

          if (itemRes.rows.length === 0) {
            throw AppError.badRequest(`Return item '${cond.returnItemId}' not found in this request`);
          }

          await client.query(
            "UPDATE return_items SET condition_on_receipt = $1 WHERE id = $2",
            [cond.condition, cond.returnItemId]
          );
        }
      } else if (nextStatus === 'COMPLETED') {
        // --- RESTOCKING & EXCHANGES FULFILLMENT PHASE ---
        if (itemsCondition && Array.isArray(itemsCondition) && itemsCondition.length > 0) {
          for (const cond of itemsCondition) {
            await client.query(
              "UPDATE return_items SET condition_on_receipt = $1 WHERE id = $2 AND return_request_id = $3",
              [cond.condition, cond.returnItemId, returnId]
            );
          }
        }

        const itemsRes = await client.query(
          `SELECT ri.id, ri.variant_id, ri.quantity, ri.replacement_variant_id, ri.condition_on_receipt,
                  oi.unit_price_snapshot, oi.product_title_snapshot, oi.variant_sku_snapshot, oi.size_snapshot, oi.color_snapshot
           FROM return_items ri
           JOIN order_items oi ON oi.id = ri.order_item_id
           WHERE ri.return_request_id = $1`,
          [returnId]
        );

        for (const item of itemsRes.rows) {
          const condition = item.condition_on_receipt;
          if (!condition) {
            throw AppError.badRequest('All return items must have a validated condition on receipt before completion');
          }

          // Lock returned inventory row or initialize
          const checkInv = await client.query(
            "SELECT id, quantity_available, quantity_damaged FROM inventory_items WHERE variant_id = $1 FOR UPDATE",
            [item.variant_id]
          );

          if (checkInv.rows.length === 0) {
            await client.query(
              `INSERT INTO inventory_items (variant_id, quantity_available, quantity_reserved, quantity_damaged)
               VALUES ($1, 0, 0, 0)`,
              [item.variant_id]
            );
          }

          // Determine restocking route
          if (condition === 'RESELLABLE' && returnReq.reason !== 'DEFECTIVE' && returnReq.reason !== 'QUALITY_ISSUE') {
            // Restock to available
            await client.query(
              `UPDATE inventory_items 
               SET quantity_available = quantity_available + $1, updated_at = NOW()
               WHERE variant_id = $2`,
              [item.quantity, item.variant_id]
            );

            // Log stock movement
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, 'ONLINE_RETURN', $2, 'RETURN_REQUEST', $3, 'Resellable return restocked', $4)`,
              [item.variant_id, item.quantity, returnId, actorId]
            );
          } else {
            // Restock to damaged
            await client.query(
              `UPDATE inventory_items 
               SET quantity_damaged = quantity_damaged + $1, updated_at = NOW()
               WHERE variant_id = $2`,
              [item.quantity, item.variant_id]
            );

            // Log stock movement as audit adjustment
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, 'INVENTORY_ADJUSTMENT', $2, 'RETURN_REQUEST', $3, 'Defective/damaged return quarantined', $4)`,
              [item.variant_id, item.quantity, returnId, actorId]
            );
          }

          // Process Exchange Replacement stock consumption
          if (returnReq.request_type === 'EXCHANGE') {
            // Decrement reserved replacement stock
            await client.query(
              `UPDATE inventory_items 
               SET quantity_reserved = quantity_reserved - $1, updated_at = NOW()
               WHERE variant_id = $2`,
              [item.quantity, item.replacement_variant_id]
            );

            // Log fulfillment stock movement
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, 'ONLINE_ORDER_FULFILLED', $2, 'RETURN_REQUEST', $3, 'Exchange replacement fulfilled', $4)`,
              [item.replacement_variant_id, item.quantity, returnId, actorId]
            );
          }
        }

        // Create Exchange Replacement Order
        if (returnReq.request_type === 'EXCHANGE') {
          const excOrderNum = `MX-EXC-${Math.floor(Date.now() / 1000)}-${Math.floor(1000 + Math.random() * 9000)}`;
          
          const excOrderRes = await client.query(
            `INSERT INTO orders (
               order_number, customer_id, order_channel, order_status, payment_method, payment_status,
               subtotal_amount, discount_amount, delivery_fee, total_payable, cod_amount_due, shipping_address_id,
               shipping_snapshot, customer_phone, customer_notes, admin_notes
             ) VALUES ($1, $2, 'ONLINE', 'CONFIRMED', 'COD', 'PENDING', 0.00, 0.00, 0.00, 0.00, 0.00, $3, $4, $5, $6, $7) RETURNING id`,
            [
              excOrderNum,
              returnReq.customer_id,
              returnReq.shipping_address_id,
              returnReq.shipping_snapshot,
              returnReq.customer_phone,
              'Exchange replacement order',
              `Replacement order for return request ${returnReq.return_number}`
            ]
          );

          const excOrderId = excOrderRes.rows[0].id;

          // Insert exchange order items
          for (const item of itemsRes.rows) {
            const repVarRes = await client.query(
              `SELECT pv.sku, pv.mrp, pv.selling_price, sz.name as size_name, cl.name as color_name, p.title
               FROM product_variants pv
               JOIN products p ON p.id = pv.product_id
               JOIN sizes sz ON sz.id = pv.size_id
               JOIN colors cl ON cl.id = pv.color_id
               WHERE pv.id = $1`,
              [item.replacement_variant_id]
            );

            const repVar = repVarRes.rows[0];

            await client.query(
              `INSERT INTO order_items (
                 order_id, variant_id, product_title_snapshot, variant_sku_snapshot, size_snapshot, color_snapshot,
                 unit_mrp_snapshot, unit_price_snapshot, quantity, line_subtotal, line_discount, line_total
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                excOrderId,
                item.replacement_variant_id,
                repVar.title,
                repVar.sku,
                repVar.size_name,
                repVar.color_name,
                repVar.mrp,
                0.00,
                item.quantity,
                0.00,
                0.00,
                0.00
              ]
            );
          }
        }

        // Transition original order status to RETURNED if all items returned
        const originalOrderItemsRes = await client.query(
          "SELECT SUM(quantity) as total_qty FROM order_items WHERE order_id = $1",
          [returnReq.order_id]
        );
        const originalOrderTotalQty = parseInt(originalOrderItemsRes.rows[0].total_qty, 10);

        const allCompletedReturnsRes = await client.query(
          `SELECT COALESCE(SUM(ri.quantity), 0) as total_returned
           FROM return_items ri
           JOIN return_requests rr ON rr.id = ri.return_request_id
           WHERE rr.order_id = $1 AND (rr.status = 'COMPLETED' OR rr.id = $2)`,
          [returnReq.order_id, returnId]
        );
        const totalReturned = parseInt(allCompletedReturnsRes.rows[0].total_returned, 10);

        if (totalReturned >= originalOrderTotalQty) {
          await client.query(
            "UPDATE orders SET order_status = 'RETURNED', updated_at = NOW() WHERE id = $1",
            [returnReq.order_id]
          );
        }
      } else if ((nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') && (currentStatus === 'APPROVED' || currentStatus === 'PICKUP_SCHEDULED')) {
        // --- RELEASE EXCHANGE RESERVATION PHASE ---
        if (returnReq.request_type === 'EXCHANGE') {
          const itemsRes = await client.query(
            "SELECT quantity, replacement_variant_id FROM return_items WHERE return_request_id = $1",
            [returnId]
          );

          for (const item of itemsRes.rows) {
            // Restore inventory: available up, reserved down
            await client.query(
              `UPDATE inventory_items 
               SET 
                 quantity_available = quantity_available + $1,
                 quantity_reserved = quantity_reserved - $1,
                 updated_at = NOW()
               WHERE variant_id = $2`,
              [item.quantity, item.replacement_variant_id]
            );

            // Log cancellation stock movement
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, 'ONLINE_ORDER_CANCELLED', $2, 'RETURN_REQUEST', $3, 'Exchange reservation released', $4)`,
              [item.replacement_variant_id, item.quantity, returnId, actorId]
            );
          }
        }
      }

      // If returning to DELIVERED when rejected/cancelled, make sure original order goes back to DELIVERED
      if (nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') {
        const activeRes = await client.query(
          `SELECT COUNT(*) FROM return_requests 
           WHERE order_id = $1 AND id != $2 AND status != 'CANCELLED' AND status != 'REJECTED'`,
          [returnReq.order_id, returnId]
        );

        const activeCount = parseInt(activeRes.rows[0].count, 10);
        if (activeCount === 0) {
          await client.query(
            "UPDATE orders SET order_status = 'DELIVERED', updated_at = NOW() WHERE id = $1",
            [returnReq.order_id]
          );
        }
      }

      // 4. Update return request status
      await client.query(
        "UPDATE return_requests SET status = $1, admin_notes = $2, processed_by = $3, updated_at = NOW() WHERE id = $4",
        [nextStatus, comment || null, actorId, returnId]
      );

      // 5. Insert history entry
      await client.query(
        `INSERT INTO return_status_history (
           return_request_id, from_status, to_status, changed_by, comment
         ) VALUES ($1, $2, $3, $4, $5)`,
        [returnId, currentStatus, nextStatus, actorId, comment || `Status updated to ${nextStatus}`]
      );

      await client.query('COMMIT');
      return {
        success: true,
        returnRequestId: returnId,
        fromStatus: currentStatus,
        toStatus: nextStatus
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
