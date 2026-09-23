import { pool } from '../config/db.js';
import { AdminReturnService } from '../services/adminReturn.service.js';

async function inspect() {
  console.log('--- INSPECTING RETURN REQUESTS IN DB ---');
  const dbRes = await pool.query(`
    SELECT rr.id, rr.return_number, rr.order_id, rr.customer_id, rr.status, rr.request_type, rr.reason,
           rr.customer_comment, rr.admin_notes, rr.requested_at, rr.created_at,
           o.order_number, o.order_status,
           p.first_name, p.last_name, p.email
    FROM return_requests rr
    LEFT JOIN orders o ON o.id = rr.order_id
    LEFT JOIN profiles p ON p.id = rr.customer_id
    ORDER BY rr.created_at DESC
  `);
  console.log('Total return_requests in DB:', dbRes.rows.length);
  for (const r of dbRes.rows) {
    console.log(`- Return: ${r.return_number} | Type: ${r.request_type} | Status: ${r.status} | Order: ${r.order_number} (${r.order_status}) | Customer: ${r.first_name} ${r.last_name} (${r.email})`);
  }

  console.log('\n--- CALLING AdminReturnService.listReturns() ---');
  const apiRes = await AdminReturnService.listReturns({ page: 1, limit: 100 });
  console.log('Total returned by listReturns:', apiRes.returns.length, 'total count:', apiRes.pagination.total);
  for (const r of apiRes.returns) {
    console.log(`- listReturns Item: ${r.return_number} | Type: ${r.request_type} | Status: ${r.status} | Order: ${r.order_number}`);
  }

  console.log('\n--- CHECKING ORDERS WITH RETURN_REQUESTED STATUS IN DB ---');
  const ordersRes = await pool.query(`
    SELECT o.id, o.order_number, o.order_status, o.customer_id,
           p.first_name, p.last_name, p.email,
           (SELECT COUNT(*) FROM return_requests rr WHERE rr.order_id = o.id) as return_req_count
    FROM orders o
    LEFT JOIN profiles p ON p.id = o.customer_id
    WHERE o.order_status = 'RETURN_REQUESTED' OR o.order_status = 'RETURNED'
  `);
  console.log('Total orders in RETURN_REQUESTED / RETURNED:', ordersRes.rows.length);
  for (const o of ordersRes.rows) {
    console.log(`- Order: ${o.order_number} | Status: ${o.order_status} | Customer: ${o.first_name} ${o.last_name} | Return requests count: ${o.return_req_count}`);
  }

  await pool.end();
}

inspect();
