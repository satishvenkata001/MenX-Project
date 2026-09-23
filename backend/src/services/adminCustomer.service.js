import { pool } from '../config/db.js';
import { AppError } from '../utils/appError.js';

/**
 * Returns a paginated list of all customers for admin review with total spending and order statistics
 */
export const getCustomersAdmin = async ({ page = 1, limit = 10, search }) => {
  if (!pool) {
    throw AppError.internal('Database connection is not configured');
  }

  const offset = (page - 1) * limit;
  let countQuery = `
    SELECT COUNT(*)::int AS total 
    FROM profiles p 
    WHERE p.role = 'CUSTOMER'
  `;
  let selectQuery = `
    SELECT 
      p.id, 
      p.first_name, 
      p.last_name, 
      p.email, 
      p.phone, 
      p.role, 
      p.is_active, 
      p.created_at,
      COUNT(o.id)::int AS total_orders,
      COALESCE(SUM(CASE WHEN o.order_status NOT IN ('CANCELLED', 'FAILED_DELIVERY') THEN o.total_payable ELSE 0 END), 0)::float AS total_spent,
      MAX(o.created_at) AS last_order_date
    FROM profiles p
    LEFT JOIN orders o ON p.id = o.customer_id
    WHERE p.role = 'CUSTOMER'
  `;

  const queryParams = [];
  let paramIndex = 1;

  if (search && search.trim() !== '') {
    const searchPattern = `%${search.trim()}%`;
    countQuery += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.email ILIKE $${paramIndex} OR p.phone ILIKE $${paramIndex})`;
    selectQuery += ` AND (p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.email ILIKE $${paramIndex} OR p.phone ILIKE $${paramIndex})`;
    queryParams.push(searchPattern);
    paramIndex++;
  }

  selectQuery += `
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const selectParams = [...queryParams, limit, offset];

  const client = await pool.connect();
  try {
    const [countRes, selectRes] = await Promise.all([
      client.query(countQuery, queryParams),
      client.query(selectQuery, selectParams)
    ]);

    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      customers: selectRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (err) {
    throw AppError.internal(`Database query failed: ${err.message}`);
  } finally {
    client.release();
  }
};

/**
 * Returns a specific customer's profile details, statistics, order history, and shipping addresses
 */
export const getCustomerDetailsAdmin = async (customerId) => {
  if (!pool) {
    throw AppError.internal('Database connection is not configured');
  }

  const client = await pool.connect();
  try {
    // 1. Fetch customer details
    const profileRes = await client.query(
      `SELECT id, first_name, last_name, email, phone, role, is_active, created_at 
       FROM profiles 
       WHERE id = $1 AND role = 'CUSTOMER'`,
      [customerId]
    );

    if (profileRes.rows.length === 0) {
      throw AppError.notFound('Customer not found');
    }

    const customer = profileRes.rows[0];

    // 2. Fetch statistics, orders history, and addresses concurrently
    const [statsRes, ordersRes, addressesRes] = await Promise.all([
      client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE order_status = 'PENDING')::int AS pending_orders,
           COUNT(*) FILTER (WHERE order_status = 'CONFIRMED')::int AS confirmed_orders,
           COUNT(*) FILTER (WHERE order_status = 'PACKED')::int AS packed_orders,
           COUNT(*) FILTER (WHERE order_status = 'SHIPPED')::int AS shipped_orders,
           COUNT(*) FILTER (WHERE order_status = 'OUT_FOR_DELIVERY')::int AS out_for_delivery_orders,
           COUNT(*) FILTER (WHERE order_status = 'DELIVERED')::int AS delivered_orders,
           COUNT(*) FILTER (WHERE order_status = 'CANCELLED')::int AS cancelled_orders,
           COUNT(*)::int AS total_orders,
           COALESCE(SUM(CASE WHEN order_status NOT IN ('CANCELLED', 'FAILED_DELIVERY') THEN total_payable ELSE 0 END), 0)::float AS total_spent
         FROM orders
         WHERE customer_id = $1`,
        [customerId]
      ),
      client.query(
        `SELECT id, order_number, created_at, order_status, payment_method, total_payable
         FROM orders
         WHERE customer_id = $1
         ORDER BY created_at DESC`,
        [customerId]
      ),
      client.query(
        `SELECT id, address_type, recipient_name, phone_number, alternate_phone, address_line1, address_line2, landmark, city, state, postal_code, is_default
         FROM addresses
         WHERE user_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [customerId]
      )
    ]);

    const statistics = statsRes.rows[0] || {
      pending_orders: 0,
      confirmed_orders: 0,
      packed_orders: 0,
      shipped_orders: 0,
      out_for_delivery_orders: 0,
      delivered_orders: 0,
      cancelled_orders: 0,
      total_orders: 0,
      total_spent: 0
    };

    return {
      customer,
      statistics,
      orders: ordersRes.rows,
      addresses: addressesRes.rows
    };
  } catch (err) {
    if (err.statusCode === 404) throw err;
    throw AppError.internal(`Database query failed: ${err.message}`);
  } finally {
    client.release();
  }
};
