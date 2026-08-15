import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';
import { logger } from '../utils/logger.js';
import { USER_ROLES } from '../config/constants.js';

export class AdminReturnService {
  /**
   * Helper to validate if staff has access to store returns
   */
  static async validateStoreAccess(userProfile, storeId) {
    if (!userProfile) {
      throw AppError.unauthorized('Authentication required');
    }

    if (
      userProfile.role === USER_ROLES.SUPER_ADMIN ||
      userProfile.role === USER_ROLES.ORDER_MANAGER ||
      userProfile.role === USER_ROLES.INVENTORY_MANAGER
    ) {
      return true;
    }

    if (userProfile.role === USER_ROLES.STORE_MANAGER || userProfile.role === USER_ROLES.STORE_STAFF) {
      const res = await pool.query(
        "SELECT id FROM staff_store_assignments WHERE user_id = $1 AND store_id = $2",
        [userProfile.id, storeId]
      );
      if (res.rows.length === 0) {
        throw AppError.forbidden('You do not have permission to manage returns for this store');
      }
      return true;
    }

    throw AppError.forbidden('Unauthorized role for return management');
  }

  /**
   * Helper to get assigned store IDs for staff
   */
  static async getAssignedStoreIds(userProfile) {
    if (
      userProfile.role === USER_ROLES.SUPER_ADMIN ||
      userProfile.role === USER_ROLES.ORDER_MANAGER ||
      userProfile.role === USER_ROLES.INVENTORY_MANAGER
    ) {
      return null; // Global access
    }

    const res = await pool.query(
      "SELECT store_id FROM staff_store_assignments WHERE user_id = $1",
      [userProfile.id]
    );
    return res.rows.map(r => r.store_id);
  }

  /**
   * List return requests for admin/staff
   */
  static async listReturns({ page = 1, limit = 10, status, storeId, search } = {}, userProfile) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const permittedStoreIds = await this.getAssignedStoreIds(userProfile);
    if (permittedStoreIds !== null && permittedStoreIds.length === 0) {
      return {
        returns: [],
        pagination: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false }
      };
    }

    let query = `
      SELECT rr.id, rr.return_number, rr.order_id, rr.customer_id, rr.status, rr.request_type, rr.reason,
             rr.customer_comment, rr.admin_notes, rr.requested_at, rr.created_at,
             o.order_number, o.store_id,
             p.first_name, p.last_name, p.email
      FROM return_requests rr
      JOIN orders o ON o.id = rr.order_id
      JOIN profiles p ON p.id = rr.customer_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Store scope filter
    if (permittedStoreIds !== null) {
      query += ` AND o.store_id = ANY($${paramIndex++})`;
      params.push(permittedStoreIds);
    }

    if (storeId) {
      if (permittedStoreIds !== null && !permittedStoreIds.includes(storeId)) {
        throw AppError.forbidden('You do not have access to this store');
      }
      query += ` AND o.store_id = $${paramIndex++}`;
      params.push(storeId);
    }

    if (status) {
      query += ` AND rr.status = $${paramIndex++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND (rr.return_number ILIKE $${paramIndex} OR o.order_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Get count
    const countQuery = `SELECT COUNT(*) FROM (${query}) as count_sub`;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Add pagination
    query += ` ORDER BY rr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const offset = (page - 1) * limit;
    params.push(limit, offset);

    const res = await pool.query(query, params);
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
  static async getReturnDetailsAdmin(returnId, userProfile) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const returnRes = await pool.query(
      `SELECT rr.*, o.store_id, o.order_number
       FROM return_requests rr
       JOIN orders o ON o.id = rr.order_id
       WHERE rr.id = $1`,
      [returnId]
    );

    if (returnRes.rows.length === 0) {
      throw AppError.notFound('Return request not found');
    }

    const returnReq = returnRes.rows[0];
    await this.validateStoreAccess(userProfile, returnReq.store_id);

    // Get return items
    const itemsRes = await pool.query(
      `SELECT ri.id, ri.order_item_id, ri.variant_id, ri.quantity, ri.replacement_variant_id, ri.condition_on_receipt,
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
  }

  /**
   * Transition return request status
   */
  static async transitionReturnStatus(returnId, nextStatus, { comment, itemsCondition } = {}, actorId, userProfile) {
    if (!pool) {
      throw AppError.internal('Database pool is not configured');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch return request and lock
      const returnRes = await client.query(
        `SELECT rr.id, rr.return_number, rr.order_id, rr.status, rr.request_type, rr.reason, rr.customer_id,
                o.store_id, o.customer_phone, o.shipping_address_id, o.shipping_snapshot
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

      // Validate store access
      await this.validateStoreAccess(userProfile, returnReq.store_id);

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
        // Fetch exchange items and lock replacement variants in sorted order to prevent deadlocks
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
             WHERE store_id = $1 AND variant_id = $2 FOR UPDATE`,
            [returnReq.store_id, item.replacement_variant_id]
          );

          if (invRes.rows.length === 0) {
            throw AppError.badRequest(`No inventory record exists for replacement variant in fulfillment store`);
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
             WHERE store_id = $2 AND variant_id = $3`,
            [item.quantity, returnReq.store_id, item.replacement_variant_id]
          );

          // Log reservation stock movement
          await client.query(
            `INSERT INTO stock_movements (
               variant_id, source_store_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
             ) VALUES ($1, $2, 'ONLINE_ORDER_RESERVED', $3, 'RETURN_REQUEST', $4, 'Exchange replacement reserved', $5)`,
            [item.replacement_variant_id, returnReq.store_id, item.quantity, returnId, actorId]
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
        // If they bypass RECEIVED_IN_STORE directly to COMPLETED, allow but check if conditions are updated
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

          // Lock returned inventory row
          // Initialize inventory if not exists
          const checkInv = await client.query(
            "SELECT id, quantity_available, quantity_damaged FROM inventory_items WHERE store_id = $1 AND variant_id = $2 FOR UPDATE",
            [returnReq.store_id, item.variant_id]
          );

          if (checkInv.rows.length === 0) {
            await client.query(
              `INSERT INTO inventory_items (store_id, variant_id, quantity_available, quantity_reserved, quantity_damaged)
               VALUES ($1, $2, 0, 0, 0)`,
              [returnReq.store_id, item.variant_id]
            );
          }

          // Determine restocking route
          if (condition === 'RESELLABLE' && returnReq.reason !== 'DEFECTIVE' && returnReq.reason !== 'QUALITY_ISSUE') {
            // Restock to available
            await client.query(
              `UPDATE inventory_items 
               SET quantity_available = quantity_available + $1, updated_at = NOW()
               WHERE store_id = $2 AND variant_id = $3`,
              [item.quantity, returnReq.store_id, item.variant_id]
            );

            // Log stock movement
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, source_store_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, $2, 'ONLINE_RETURN', $3, 'RETURN_REQUEST', $4, 'Resellable return restocked', $5)`,
              [item.variant_id, returnReq.store_id, item.quantity, returnId, actorId]
            );
          } else {
            // Restock to damaged
            await client.query(
              `UPDATE inventory_items 
               SET quantity_damaged = quantity_damaged + $1, updated_at = NOW()
               WHERE store_id = $2 AND variant_id = $3`,
              [item.quantity, returnReq.store_id, item.variant_id]
            );

            // Log stock movement as audit adjustment
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, source_store_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, $2, 'INVENTORY_ADJUSTMENT', $3, 'RETURN_REQUEST', $4, 'Defective/damaged return quarantined', $5)`,
              [item.variant_id, returnReq.store_id, item.quantity, returnId, actorId]
            );
          }

          // Process Exchange Replacement stock consumption
          if (returnReq.request_type === 'EXCHANGE') {
            // Decrement reserved replacement stock
            await client.query(
              `UPDATE inventory_items 
               SET quantity_reserved = quantity_reserved - $1, updated_at = NOW()
               WHERE store_id = $2 AND variant_id = $3`,
              [item.quantity, returnReq.store_id, item.replacement_variant_id]
            );

            // Log fulfillment stock movement
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, source_store_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, $2, 'ONLINE_ORDER_FULFILLED', $3, 'RETURN_REQUEST', $4, 'Exchange replacement fulfilled', $5)`,
              [item.replacement_variant_id, returnReq.store_id, item.quantity, returnId, actorId]
            );
          }
        }

        // Create Exchange Replacement Order
        if (returnReq.request_type === 'EXCHANGE') {
          const excOrderNum = `MX-EXC-${Math.floor(Date.now() / 1000)}-${Math.floor(1000 + Math.random() * 9000)}`;
          
          const excOrderRes = await client.query(
            `INSERT INTO orders (
               order_number, customer_id, order_channel, store_id, order_status, payment_method, payment_status,
               subtotal_amount, discount_amount, delivery_fee, total_payable, cod_amount_due, shipping_address_id,
               shipping_snapshot, customer_phone, customer_notes, admin_notes
             ) VALUES ($1, $2, 'ONLINE', $3, 'CONFIRMED', 'COD', 'PENDING', 0.00, 0.00, 0.00, 0.00, 0.00, $4, $5, $6, $7, $8) RETURNING id`,
            [
              excOrderNum,
              returnReq.customer_id,
              returnReq.store_id,
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
            // Get replacement variant details
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
                0.00, // zero price exchange
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
               WHERE store_id = $2 AND variant_id = $3`,
              [item.quantity, returnReq.store_id, item.replacement_variant_id]
            );

            // Log cancellation stock movement
            await client.query(
              `INSERT INTO stock_movements (
                 variant_id, source_store_id, movement_type, quantity, reference_type, reference_id, reason, performed_by
               ) VALUES ($1, $2, 'ONLINE_ORDER_CANCELLED', $3, 'RETURN_REQUEST', $4, 'Exchange reservation released', $5)`,
              [item.replacement_variant_id, returnReq.store_id, item.quantity, returnId, actorId]
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
