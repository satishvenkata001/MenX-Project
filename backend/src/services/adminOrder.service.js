import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';

// State machine definition for valid status transitions
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'CANCELLED'],
  FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: [], // final state
  CANCELLED: [] // final state
};

/**
 * Returns a paginated list of all orders for admin review
 */
export const getOrdersAdmin = async ({ page = 1, limit = 10, status, search }) => {
  let query = supabaseAdmin
    .from('orders')
    .select('*, customer:profiles!orders_customer_id_fkey(first_name, last_name, email)', { count: 'exact' });

  if (status) {
    query = query.eq('order_status', status);
  }
  if (search) {
    query = query.or(`order_number.ilike.%${search}%,customer_phone.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw AppError.badRequest(error.message);
  }

  return {
    orders: data,
    total: count,
    page,
    limit
  };
};

/**
 * Returns specific order details including snapshots and buyer profile for admin
 */
export const getOrderDetailsAdmin = async (orderId) => {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      order_items(
        *,
        variant:product_variants(
          id,
          sku,
          is_active,
          product:products(
            id,
            title,
            slug,
            status,
            category:categories(id, name, slug),
            subcategory:subcategories(id, name, slug),
            brand:brands(id, name, slug, logo_url),
            images:product_images(id, image_url, alt_text, is_primary, display_order)
          )
        )
      ),
      customer:profiles!orders_customer_id_fkey(*),
      return_requests(
        *,
        return_items(
          *,
          replacement_variant:product_variants!return_items_replacement_variant_id_fkey(
            id,
            sku,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw AppError.notFound('Order not found');
  }

  return order;
};

/**
 * Transitions order status according to state machine rules.
 * Automatically restores or fulfills stock atomically using a SQL transaction.
 */
export const updateOrderStatus = async (orderId, nextStatus, performedByUserId) => {
  if (!pool) {
    throw AppError.internal('Database transaction capabilities are not configured for status transitions');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current order status and details under write lock
    const orderRes = await client.query(
      'SELECT order_status, customer_id FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw AppError.notFound('Order not found');
    }

    const order = orderRes.rows[0];
    const currentStatus = order.order_status;

    // 2. Validate transition against state machine rules
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw AppError.badRequest(`Invalid status transition from ${currentStatus} to ${nextStatus}`);
    }

    // 3. Update order status
    await client.query(
      'UPDATE orders SET order_status = $1, updated_at = NOW() WHERE id = $2',
      [nextStatus, orderId]
    );

    // Note: The database AFTER UPDATE trigger record_order_status_history automatically captures and writes the history log.

    // 4. Handle Inventory Adjustment
    if (nextStatus === 'CANCELLED') {
      // Restore stock (re-add to available, subtract from reserved)
      const itemsRes = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of itemsRes.rows) {
        if (!item.variant_id) continue;
        await client.query(
          `UPDATE inventory_items 
           SET 
             quantity_available = quantity_available + $1, 
             quantity_reserved = quantity_reserved - $1, 
             updated_at = NOW() 
           WHERE variant_id = $2`,
          [item.quantity, item.variant_id]
        );
        await client.query(
          `INSERT INTO stock_movements (
             variant_id,
             movement_type,
             quantity,
             reference_type,
             reference_id,
             reason,
             performed_by
           ) VALUES ($1, 'ONLINE_ORDER_CANCELLED', $2, 'ORDER', $3, 'Order cancelled by admin', $4)`,
          [item.variant_id, item.quantity, orderId, performedByUserId]
        );
      }
    } else if (nextStatus === 'DELIVERED') {
      // Consume stock (subtract from reserved)
      const itemsRes = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of itemsRes.rows) {
        if (!item.variant_id) continue;
        await client.query(
          `UPDATE inventory_items 
           SET 
             quantity_reserved = quantity_reserved - $1, 
             updated_at = NOW() 
           WHERE variant_id = $2`,
          [item.quantity, item.variant_id]
        );
        await client.query(
          `INSERT INTO stock_movements (
             variant_id,
             movement_type,
             quantity,
             reference_type,
             reference_id,
             reason,
             performed_by
           ) VALUES ($1, 'ONLINE_ORDER_FULFILLED', $2, 'ORDER', $3, 'Order delivered', $4)`,
          [item.variant_id, item.quantity, orderId, performedByUserId]
        );
      }
    } else if (nextStatus === 'RETURNED') {
      // Query already completed return item quantities for this order to prevent duplicate restocking
      const restockedRes = await client.query(
        `SELECT ri.order_item_id, COALESCE(SUM(ri.quantity), 0) as restocked_qty
         FROM return_items ri
         JOIN return_requests rr ON rr.id = ri.return_request_id
         WHERE rr.order_id = $1 AND rr.status = 'COMPLETED'
         GROUP BY ri.order_item_id`,
        [orderId]
      );
      
      const restockedMap = {};
      for (const row of restockedRes.rows) {
        restockedMap[row.order_item_id] = parseInt(row.restocked_qty, 10);
      }

      const itemsRes = await client.query('SELECT id, variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of itemsRes.rows) {
        if (!item.variant_id) continue;
        const alreadyRestocked = restockedMap[item.id] || 0;
        const remainingQty = item.quantity - alreadyRestocked;

        if (remainingQty > 0) {
          await client.query(
            `UPDATE inventory_items 
             SET 
               quantity_available = quantity_available + $1, 
               updated_at = NOW() 
             WHERE variant_id = $2`,
            [remainingQty, item.variant_id]
          );
          await client.query(
            `INSERT INTO stock_movements (
               variant_id,
               movement_type,
               quantity,
               reference_type,
               reference_id,
               reason,
               performed_by
             ) VALUES ($1, 'ONLINE_RETURN', $2, 'ORDER', $3, 'Order returned (bulk fallback)', $4)`,
            [item.variant_id, remainingQty, orderId, performedByUserId]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { success: true, fromStatus: currentStatus, toStatus: nextStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Records a full or partial cash collection for COD order.
 * Prevents over-collection and updates payment status on full collection.
 */
export const recordCodCollection = async (orderId, amountCollected, performedByUserId) => {
  if (!pool) {
    throw AppError.internal('Database transaction capabilities are not configured for COD collection');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current order collection details under write lock
    const orderRes = await client.query(
      'SELECT total_payable, cod_amount_due, cod_amount_collected, payment_status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw AppError.notFound('Order not found');
    }

    const order = orderRes.rows[0];

    // 2. Validate amount collected limits
    if (amountCollected < 0) {
      throw AppError.badRequest('Amount collected must be greater than or equal to 0');
    }

    const remainingDue = Number(order.cod_amount_due) - Number(order.cod_amount_collected);
    if (amountCollected > remainingDue) {
      throw AppError.badRequest(`Amount collected (${amountCollected}) cannot exceed the remaining COD amount due (${remainingDue})`);
    }

    // 3. Update collection amounts and status
    const newAmountCollected = Math.round((Number(order.cod_amount_collected) + amountCollected) * 100) / 100;
    const isFullCollection = newAmountCollected >= Number(order.cod_amount_due);
    const nextPaymentStatus = isFullCollection ? 'COLLECTED' : order.payment_status;

    await client.query(
      `UPDATE orders 
       SET 
         cod_amount_collected = $1, 
         payment_status = $2, 
         cod_collected_at = $3,
         cod_collected_by = $4,
         updated_at = NOW()
       WHERE id = $5`,
      [
        newAmountCollected,
        nextPaymentStatus,
        isFullCollection ? new Date() : null,
        isFullCollection ? performedByUserId : null,
        orderId
      ]
    );

    await client.query('COMMIT');
    return {
      success: true,
      amountCollected,
      totalCollected: newAmountCollected,
      paymentStatus: nextPaymentStatus,
      isFullCollection
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
