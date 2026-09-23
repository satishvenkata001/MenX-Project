import { pool } from '../config/db.js';
import * as adminOrderService from '../services/adminOrder.service.js';
import * as adminReturnService from '../services/adminReturn.service.js';
import { ReturnService } from '../services/return.service.js';
import { supabaseAdmin } from '../config/supabase.js';

let passed = 0;
let failed = 0;

async function assert(desc, condition) {
  if (condition) {
    console.log(` [PASS] ${desc}`);
    passed++;
  } else {
    console.error(` [FAIL] ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== TEST: ADMIN RETURN VS EXCHANGE REQUEST CLARITY ===\n');

  let testOrderId = null;
  let testCustomerId = null;
  let testOrderItemId = null;
  let testVariantId1 = null;
  let testVariantId2 = null;
  let testReturnId = null;

  try {
    // 1. Setup customer and delivered order with 2 items
    const { data: customer } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'CUSTOMER')
      .limit(1)
      .single();
    testCustomerId = customer.id;

    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('id, size:sizes(name), color:colors(name, hex_code), product:products(id, title)')
      .eq('is_active', true)
      .limit(2);

    testVariantId1 = variants[0].id;
    testVariantId2 = variants[1].id;

    // Ensure inventory for testVariantId2
    await pool.query(`
      INSERT INTO inventory_items (variant_id, quantity_available, quantity_reserved, quantity_damaged)
      VALUES ($1, 20, 0, 0)
      ON CONFLICT (variant_id) DO UPDATE SET quantity_available = 20
    `, [testVariantId2]);

    const orderNum = `MX-TEST-RET-${Date.now()}`;
    const { data: order, error: ordErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNum,
        customer_id: testCustomerId,
        order_channel: 'ONLINE',
        order_status: 'DELIVERED',
        payment_method: 'COD',
        payment_status: 'COLLECTED',
        customer_phone: '9876543210',
        shipping_snapshot: {
          recipient_name: 'Test Customer',
          phone_number: '9876543210',
          address_line1: '123 Test St',
          city: 'Vijayawada',
          state: 'Andhra Pradesh',
          postal_code: '520001'
        },
        subtotal_amount: 1999.00,
        discount_amount: 0.00,
        delivery_fee: 0.00,
        total_payable: 1999.00,
        cod_amount_due: 0.00,
        cod_amount_collected: 1999.00
      })
      .select()
      .single();

    if (ordErr) throw new Error(ordErr.message);
    testOrderId = order.id;

    // Insert order items
    const { data: orderItem } = await supabaseAdmin
      .from('order_items')
      .insert({
        order_id: testOrderId,
        variant_id: testVariantId1,
        product_title_snapshot: variants[0].product.title,
        variant_sku_snapshot: 'SKU-TEST-1',
        size_snapshot: variants[0].size.name,
        color_snapshot: variants[0].color.name,
        unit_mrp_snapshot: 1999.00,
        unit_price_snapshot: 1999.00,
        quantity: 1,
        line_subtotal: 1999.00,
        line_discount: 0.00,
        line_total: 1999.00
      })
      .select()
      .single();
    testOrderItemId = orderItem.id;

    // Insert delivery history log so eligibility check passes
    await pool.query(`
      INSERT INTO order_status_history (order_id, from_status, to_status, created_at)
      VALUES ($1, 'OUT_FOR_DELIVERY', 'DELIVERED', NOW())
    `, [testOrderId]);

    // Test A: Check normal delivered order (No Return/Exchange yet)
    const initialAdminOrder = await adminOrderService.getOrderDetailsAdmin(testOrderId);
    await assert('Initial delivered order has return_requests array as empty', Array.isArray(initialAdminOrder.return_requests) && initialAdminOrder.return_requests.length === 0);

    // Test B: Customer requests EXCHANGE
    const exchangeResult = await ReturnService.createReturnRequest(testCustomerId, {
      orderId: testOrderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      customerComment: 'Need size M instead of L please',
      items: [
        {
          orderItemId: testOrderItemId,
          variantId: testVariantId1,
          quantity: 1,
          replacementVariantId: testVariantId2
        }
      ]
    });
    testReturnId = exchangeResult.returnRequestId;

    await assert('Exchange request created successfully', exchangeResult.success && exchangeResult.returnRequestId);

    // Test C: Admin fetches order details with EXCHANGE request
    const adminOrderWithExchange = await adminOrderService.getOrderDetailsAdmin(testOrderId);
    await assert('Admin order status is RETURN_REQUESTED', adminOrderWithExchange.order_status === 'RETURN_REQUESTED');
    await assert('Admin order includes return_requests record', adminOrderWithExchange.return_requests.length === 1);

    const retReq = adminOrderWithExchange.return_requests[0];
    await assert('Customer request type is strictly EXCHANGE', retReq.request_type === 'EXCHANGE');
    await assert('Customer request reason is WRONG_SIZE', retReq.reason === 'WRONG_SIZE');
    await assert('Customer comment is preserved', retReq.customer_comment === 'Need size M instead of L please');
    await assert('Return items contains replacement_variant', Boolean(retReq.return_items[0]?.replacement_variant));
    await assert('Replacement variant contains size and color', Boolean(retReq.return_items[0]?.replacement_variant?.size?.name));

    // Test D: Transition order status to RETURNED
    const statusTransitionRes = await adminOrderService.updateOrderStatus(testOrderId, 'RETURNED', testCustomerId);
    await assert('Admin order status transitioned to RETURNED', statusTransitionRes.toStatus === 'RETURNED');

    const finalAdminOrder = await adminOrderService.getOrderDetailsAdmin(testOrderId);
    await assert('Final order status is RETURNED', finalAdminOrder.order_status === 'RETURNED');
    await assert('Historical return_requests record still preserved as EXCHANGE', finalAdminOrder.return_requests[0]?.request_type === 'EXCHANGE');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Cleanup
    if (testReturnId) {
      await pool.query('DELETE FROM return_status_history WHERE return_request_id = $1', [testReturnId]);
      await pool.query('DELETE FROM return_items WHERE return_request_id = $1', [testReturnId]);
      await pool.query('DELETE FROM return_requests WHERE id = $1', [testReturnId]);
    }
    if (testOrderId) {
      await pool.query('DELETE FROM order_status_history WHERE order_id = $1', [testOrderId]);
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [testOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    }
    await pool.end();
  }

  console.log(`\n================================================================`);
  console.log(`TEST SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log(`================================================================\n`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests();
