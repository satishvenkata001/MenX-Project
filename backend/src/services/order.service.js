import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';

/**
 * Validates checkout parameters from database (calculating all prices, delivery fees, and discount server-side)
 */
export const validateCheckout = async (userId, addressId, couponCode) => {
  // 1. Verify Shipping Address Ownership
  const { data: address, error: addrError } = await supabaseAdmin
    .from('addresses')
    .select('*')
    .eq('id', addressId)
    .eq('user_id', userId)
    .single();

  if (addrError || !address) {
    throw AppError.badRequest('Invalid shipping address or ownership');
  }

  // 2. Retrieve Customer Cart
  const { data: cart, error: cartError } = await supabaseAdmin
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (cartError || !cart) {
    throw AppError.notFound('Customer cart not found');
  }

  // 3. Fetch Cart Items & Snapshots
  const { data: cartItems, error: itemsError } = await supabaseAdmin
    .from('cart_items')
    .select('*, product_variants(*, products(*))')
    .eq('cart_id', cart.id);

  if (itemsError || !cartItems || cartItems.length === 0) {
    throw AppError.badRequest('Customer cart is empty');
  }

  // 4. Validate Catalog Active States
  for (const item of cartItems) {
    const variant = item.product_variants;
    if (!variant || !variant.is_active || !variant.products || variant.products.status !== 'PUBLISHED') {
      throw AppError.badRequest('Some items in the cart are no longer active or published');
    }
  }

  // 5. Determine Delivery Zone
  const { data: zones, error: zoneError } = await supabaseAdmin
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true);

  if (zoneError || !zones) {
    throw AppError.internal('Failed to retrieve delivery zones');
  }

  let matchedZone = null;
  let bestMatchLength = -1;

  for (const zone of zones) {
    const pattern = zone.pincode_pattern;
    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexStr);

    if (regex.test(address.postal_code)) {
      const specLength = pattern.replace(/\*/g, '').length;
      if (specLength > bestMatchLength) {
        bestMatchLength = specLength;
        matchedZone = zone;
      }
    }
  }

  if (!matchedZone) {
    throw AppError.badRequest(`No shipping service available for pincode ${address.postal_code}`);
  }

  // 6. Calculate Subtotal
  let subtotal = 0;
  for (const item of cartItems) {
    subtotal += Number(item.product_variants.selling_price) * item.quantity;
  }
  subtotal = Math.round(subtotal * 100) / 100;

  // 7. Determine Store Fulfillability
  const variantIds = cartItems.map(i => i.variant_id);
  const { data: inventory, error: invError } = await supabaseAdmin
    .from('inventory_items')
    .select('*, stores(*)')
    .in('variant_id', variantIds);

  if (invError || !inventory) {
    throw AppError.internal('Failed to retrieve inventory items');
  }

  const storeInventory = {};
  for (const inv of inventory) {
    if (!inv.stores || !inv.stores.is_active) continue;
    if (!storeInventory[inv.store_id]) {
      storeInventory[inv.store_id] = {
        store: inv.stores,
        items: {}
      };
    }
    storeInventory[inv.store_id].items[inv.variant_id] = inv.quantity_available;
  }

  const candidateStores = [];
  for (const storeId in storeInventory) {
    const group = storeInventory[storeId];
    let canFulfill = true;
    for (const item of cartItems) {
      const available = group.items[item.variant_id] || 0;
      if (available < item.quantity) {
        canFulfill = false;
        break;
      }
    }
    if (canFulfill) {
      candidateStores.push(group.store);
    }
  }

  const storeTypes = ['ONLINE_FULFILLMENT', 'CENTRAL_WAREHOUSE', 'PHYSICAL_STORE'];
  candidateStores.sort((a, b) => {
    const idxA = storeTypes.indexOf(a.type);
    const idxB = storeTypes.indexOf(b.type);
    if (idxA !== idxB) return idxA - idxB;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  if (candidateStores.length === 0) {
    throw AppError.badRequest('Insufficient stock across all active stores for the selected items');
  }
  const selectedStore = candidateStores[0];

  // 8. Validate Coupon
  let discount = 0;
  if (couponCode && couponCode.trim() !== '') {
    const code = couponCode.trim().toUpperCase();
    const { data: coupon, error: coupError } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (coupError || !coupon) {
      throw AppError.badRequest('Coupon is invalid or inactive');
    }

    const now = new Date();
    if (now < new Date(coupon.start_date) || (coupon.end_date && now > new Date(coupon.end_date))) {
      throw AppError.badRequest('Coupon validity period has expired');
    }

    if (subtotal < Number(coupon.min_order_amount)) {
      throw AppError.badRequest(`Order subtotal does not meet the minimum requirement of ${coupon.min_order_amount} for this coupon`);
    }

    if (coupon.total_usage_limit !== null && coupon.used_count >= coupon.total_usage_limit) {
      throw AppError.badRequest('Coupon total usage limit has been reached');
    }

    const { count: userRedemptions, error: redemptError } = await supabaseAdmin
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId);

    if (redemptError) {
      throw AppError.internal('Failed to verify coupon redemptions');
    }

    if (userRedemptions >= coupon.usage_limit_per_user) {
      throw AppError.badRequest('Coupon redemption limit per user exceeded');
    }

    if (coupon.discount_type === 'PERCENTAGE') {
      discount = subtotal * (Number(coupon.discount_value) / 100);
      if (coupon.max_discount_amount !== null) {
        discount = Math.min(discount, Number(coupon.max_discount_amount));
      }
    } else if (coupon.discount_type === 'FLAT_AMOUNT') {
      discount = Math.min(Number(coupon.discount_value), subtotal);
    }
    discount = Math.round(discount * 100) / 100;
  }

  // 9. Calculate Delivery Fee
  let deliveryFee = Number(matchedZone.base_delivery_charge);
  if (matchedZone.free_delivery_threshold !== null && subtotal >= Number(matchedZone.free_delivery_threshold)) {
    deliveryFee = 0.00;
  }

  // 10. Total Payable
  const total = Math.round((subtotal - discount + deliveryFee) * 100) / 100;

  return {
    subtotal,
    discount,
    deliveryFee,
    total,
    fulfillmentStoreId: selectedStore.id
  };
};

/**
 * Creates a COD order by calling the atomic process_cod_checkout_atomic function
 */
export const createOrder = async (userId, addressId, couponCode, customerNotes, paymentMethod) => {
  if (paymentMethod !== 'COD') {
    throw AppError.badRequest('Payment method must be COD');
  }

  const { data, error } = await supabaseAdmin.rpc('process_cod_checkout_atomic', {
    p_user_id: userId,
    p_address_id: addressId,
    p_coupon_code: couponCode || null,
    p_customer_notes: customerNotes || null
  });

  if (error) {
    throw AppError.badRequest(error.message);
  }

  return data;
};

/**
 * Returns paginate orders list belonging to authenticated user
 */
export const getOrders = async (userId, { page = 1, limit = 10, status }) => {
  let query = supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('customer_id', userId);

  if (status) {
    query = query.eq('order_status', status);
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
 * Returns specific customer order with snapshotted items
 */
export const getOrderDetails = async (userId, orderId) => {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select(`
      *,
      order_items(
        *,
        variant:product_variants(
          id,
          product:products(
            id,
            images:product_images(image_url, is_primary, display_order)
          )
        )
      )
    `)
    .eq('id', orderId)
    .eq('customer_id', userId)
    .single();

  if (error || !order) {
    throw AppError.notFound('Order not found or access denied');
  }

  return order;
};

/**
 * Returns status transition logs for customer order
 */
export const getOrderStatusHistory = async (userId, orderId) => {
  // Check ownership
  const { data: order, error: checkError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('customer_id', userId)
    .single();

  if (checkError || !order) {
    throw AppError.notFound('Order not found or access denied');
  }

  const { data: history, error } = await supabaseAdmin
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    throw AppError.badRequest(error.message);
  }

  return history;
};

/**
 * Customer order cancellation.
 * Ensures the order status update and inventory stock restoration are completely atomic using a SQL transaction.
 */
export const cancelOrder = async (userId, orderId, reason) => {
  if (!pool) {
    throw AppError.internal('Database transaction capabilities are not configured for order cancellation');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch order and lock the row to prevent updates
    const orderRes = await client.query(
      'SELECT order_status, customer_id, store_id FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw AppError.notFound('Order not found');
    }

    const order = orderRes.rows[0];

    // Check ownership
    if (order.customer_id !== userId) {
      throw AppError.forbidden('Access denied: You do not own this order');
    }

    // Check status
    if (order.order_status !== 'PENDING' && order.order_status !== 'CONFIRMED') {
      throw AppError.badRequest(`Cannot cancel order in ${order.order_status} status`);
    }

    // 2. Update order status to CANCELLED and store cancellation reason
    await client.query(
      "UPDATE orders SET order_status = 'CANCELLED', cancelled_reason = $2, updated_at = NOW() WHERE id = $1",
      [orderId, reason || 'Order cancelled by customer']
    );

    // 2.1 Update the automatically created status history log to include the cancellation reason
    await client.query(
      `UPDATE order_status_history 
       SET note = $1, changed_by = $2 
       WHERE order_id = $3 AND to_status = 'CANCELLED'`,
      [reason ? `Order cancelled: ${reason}` : 'Order cancelled by customer', userId, orderId]
    );

    // 3. Fetch items to restore stock
    const itemsRes = await client.query(
      'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
      [orderId]
    );

    for (const item of itemsRes.rows) {
      if (!item.variant_id || !order.store_id) continue;

      // 4. Update inventory_items to restore stock
      await client.query(
        `UPDATE inventory_items 
         SET 
           quantity_available = quantity_available + $1, 
           quantity_reserved = quantity_reserved - $1, 
           updated_at = NOW() 
         WHERE store_id = $2 AND variant_id = $3`,
        [item.quantity, order.store_id, item.variant_id]
      );

      // 5. Log stock movement
      await client.query(
        `INSERT INTO stock_movements (
           variant_id,
           source_store_id,
           movement_type,
           quantity,
           reference_type,
           reference_id,
           reason,
           performed_by
         ) VALUES ($1, $2, 'ONLINE_ORDER_CANCELLED', $3, 'ORDER', $4, $5, $6)`,
        [
          item.variant_id,
          order.store_id,
          item.quantity,
          orderId,
          reason ? `Order cancelled: ${reason}` : 'Order cancelled by customer',
          userId
        ]
      );
    }

    await client.query('COMMIT');
    return { success: true, message: 'Order successfully cancelled' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
