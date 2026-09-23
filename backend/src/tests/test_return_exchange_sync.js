import { pool } from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
import { ReturnService } from '../services/return.service.js';
import { AdminReturnService } from '../services/adminReturn.service.js';
import { getOrdersAdmin } from '../services/adminOrder.service.js';

async function runTests() {
  console.log('\n=== COMPREHENSIVE TEST: RETURN & EXCHANGE SYNC ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(` \x1b[32m✔ [PASS]\x1b[0m ${message}`);
      passed++;
    } else {
      console.error(` \x1b[31m✖ [FAIL]\x1b[0m ${message}`);
    }
  }

  try {
    // Setup test customers, variants
    const { data: customer } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'CUSTOMER')
      .limit(1)
      .single();
    if (!customer) throw new Error('No customer found in database');
    const customerId = customer.id;

    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('id, size:sizes(name), color:colors(name), product:products(title)')
      .limit(2);
    if (!variants || variants.length < 2) throw new Error('Need at least 2 variants for tests');
    const originalVar = variants[0];
    const replaceVar = variants[1];

    // Helper to create test delivered order
    async function createTestDeliveredOrder() {
      const orderNum = `MX-SYNC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: order, error: ordErr } = await supabaseAdmin
        .from('orders')
        .insert({
          order_number: orderNum,
          customer_id: customerId,
          order_channel: 'ONLINE',
          order_status: 'DELIVERED',
          payment_method: 'COD',
          payment_status: 'COLLECTED',
          customer_phone: '9876543210',
          shipping_snapshot: {
            recipient_name: 'Test Customer',
            phone_number: '9876543210',
            address_line1: '123 Sync Road',
            city: 'Vijayawada',
            state: 'Andhra Pradesh',
            postal_code: '520001'
          },
          subtotal_amount: 999.00,
          discount_amount: 0.00,
          delivery_fee: 0.00,
          total_payable: 999.00,
          cod_amount_due: 0.00,
          cod_amount_collected: 999.00
        })
        .select()
        .single();

      if (ordErr) throw new Error(ordErr.message);

      const { data: item, error: itemErr } = await supabaseAdmin
        .from('order_items')
        .insert({
          order_id: order.id,
          variant_id: originalVar.id,
          product_title_snapshot: originalVar.product?.title || 'Sync Product',
          variant_sku_snapshot: 'SKU-SYNC-01',
          size_snapshot: originalVar.size?.name || 'M',
          color_snapshot: originalVar.color?.name || 'Black',
          unit_mrp_snapshot: 999.00,
          unit_price_snapshot: 999.00,
          quantity: 1,
          line_subtotal: 999.00,
          line_discount: 0.00,
          line_total: 999.00
        })
        .select()
        .single();

      if (itemErr) throw new Error(itemErr.message);

      await pool.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, created_at)
         VALUES ($1, 'SHIPPED', 'DELIVERED', NOW())`,
        [order.id]
      );

      return { orderId: order.id, orderNumber: orderNum, orderItemId: item.id };
    }

    // ==========================================
    // TEST 1: Customer requests RETURN
    // ==========================================
    console.log('--- TEST 1: Customer requests RETURN ---');
    const t1 = await createTestDeliveredOrder();
    const ret1 = await ReturnService.createReturnRequest(customerId, {
      orderId: t1.orderId,
      requestType: 'RETURN',
      reason: 'NOT_AS_DESCRIBED',
      customerComment: 'Customer requested a direct return',
      items: [{
        orderItemId: t1.orderItemId,
        variantId: originalVar.id,
        quantity: 1
      }]
    });

    // Check Fulfillment Orders view
    const orderListT1 = await getOrdersAdmin({ search: t1.orderNumber });
    const orderT1 = orderListT1.orders.find(o => o.id === t1.orderId);
    assert(orderT1 && orderT1.order_status === 'RETURN_REQUESTED', 'Fulfillment Orders reflects RETURN_REQUESTED for return request');

    // Check Returns & Exchanges view
    const retListT1 = await AdminReturnService.listReturns({ search: t1.orderNumber });
    const returnRecordT1 = retListT1.returns.find(r => r.order_id === t1.orderId);
    assert(returnRecordT1 !== undefined, 'Returns & Exchanges list contains the return request');
    assert(returnRecordT1?.request_type === 'RETURN', 'Returns & Exchanges type is RETURN');
    assert(returnRecordT1?.status === 'REQUESTED', 'Returns & Exchanges status is REQUESTED');
    assert(returnRecordT1?.order_number === t1.orderNumber, 'Linked correctly with order number');

    // ==========================================
    // TEST 2: Customer requests EXCHANGE
    // ==========================================
    console.log('\n--- TEST 2: Customer requests EXCHANGE ---');
    const t2 = await createTestDeliveredOrder();
    const ret2 = await ReturnService.createReturnRequest(customerId, {
      orderId: t2.orderId,
      requestType: 'EXCHANGE',
      reason: 'WRONG_SIZE',
      customerComment: 'Customer requested exchange for size L',
      items: [{
        orderItemId: t2.orderItemId,
        variantId: originalVar.id,
        quantity: 1,
        replacementVariantId: replaceVar.id
      }]
    });

    const orderListT2 = await getOrdersAdmin({ search: t2.orderNumber });
    const orderT2 = orderListT2.orders.find(o => o.id === t2.orderId);
    assert(orderT2 && orderT2.order_status === 'RETURN_REQUESTED', 'Fulfillment Orders reflects RETURN_REQUESTED for exchange request');

    const retListT2 = await AdminReturnService.listReturns({ search: t2.orderNumber });
    const returnRecordT2 = retListT2.returns.find(r => r.order_id === t2.orderId);
    assert(returnRecordT2 !== undefined, 'Returns & Exchanges list contains the exchange request');
    assert(returnRecordT2?.request_type === 'EXCHANGE', 'Returns & Exchanges type is EXCHANGE');
    assert(returnRecordT2?.status === 'REQUESTED', 'Returns & Exchanges status is REQUESTED');

    // ==========================================
    // TEST 3: Admin approves RETURN
    // ==========================================
    console.log('\n--- TEST 3: Admin approves RETURN ---');
    const ret1Id = ret1.returnRequestId || ret1.id;
    await AdminReturnService.transitionReturnStatus(ret1Id, 'APPROVED', { comment: 'Approved by test suite' }, customerId);

    const retListT3 = await AdminReturnService.listReturns({ search: t1.orderNumber });
    const returnRecordT3 = retListT3.returns.find(r => r.id === ret1Id);
    assert(returnRecordT3?.request_type === 'RETURN', 'Return type preserved as RETURN');
    assert(returnRecordT3?.status === 'APPROVED', 'Return status updated to APPROVED');

    // ==========================================
    // TEST 4: Admin approves EXCHANGE
    // ==========================================
    console.log('\n--- TEST 4: Admin approves EXCHANGE ---');
    const ret2Id = ret2.returnRequestId || ret2.id;
    await AdminReturnService.transitionReturnStatus(ret2Id, 'APPROVED', { comment: 'Exchange approved by test suite' }, customerId);

    const retListT4 = await AdminReturnService.listReturns({ search: t2.orderNumber });
    const returnRecordT4 = retListT4.returns.find(r => r.id === ret2Id);
    assert(returnRecordT4?.request_type === 'EXCHANGE', 'Exchange type preserved as EXCHANGE');
    assert(returnRecordT4?.status === 'APPROVED', 'Exchange status updated to APPROVED');

    // ==========================================
    // TEST 5: Cancelled request
    // ==========================================
    console.log('\n--- TEST 5: Cancelled request ---');
    const t5 = await createTestDeliveredOrder();
    const ret5 = await ReturnService.createReturnRequest(customerId, {
      orderId: t5.orderId,
      requestType: 'EXCHANGE',
      reason: 'QUALITY_ISSUE',
      customerComment: 'Need exchange',
      items: [{
        orderItemId: t5.orderItemId,
        variantId: originalVar.id,
        quantity: 1,
        replacementVariantId: replaceVar.id
      }]
    });

    const ret5Id = ret5.returnRequestId || ret5.id;
    await ReturnService.cancelReturn(customerId, ret5Id);

    const retListT5 = await AdminReturnService.listReturns({ search: t5.orderNumber, status: 'CANCELLED' });
    const returnRecordT5 = retListT5.returns.find(r => r.id === ret5Id);
    assert(returnRecordT5 !== undefined, 'Cancelled request found under CANCELLED status filter');
    assert(returnRecordT5?.request_type === 'EXCHANGE', 'Cancelled request preserves TYPE = EXCHANGE');
    assert(returnRecordT5?.status === 'CANCELLED', 'Cancelled request has STATUS = CANCELLED');

    // ==========================================
    // TEST 6: Multiple requests / orders isolation
    // ==========================================
    console.log('\n--- TEST 6: Multiple requests isolation ---');
    const allReturns = await AdminReturnService.listReturns({ limit: 50 });
    const ret1Found = allReturns.returns.some(r => r.id === ret1Id);
    const ret2Found = allReturns.returns.some(r => r.id === ret2Id);
    const ret5Found = allReturns.returns.some(r => r.id === ret5Id);
    assert(ret1Found && ret2Found && ret5Found, 'All requests coexist independently without dropping or collision');

    // ==========================================
    // TEST 7: Duplicate Request Protection
    // ==========================================
    console.log('\n--- TEST 7: Duplicate Request Protection ---');
    let dupErrorCaught = false;
    try {
      await ReturnService.createReturnRequest(customerId, {
        orderId: t1.orderId,
        requestType: 'RETURN',
        reason: 'DEFECTIVE',
        items: [{
          orderItemId: t1.orderItemId,
          variantId: originalVar.id,
          quantity: 1
        }]
      });
    } catch (err) {
      dupErrorCaught = true;
    }
    assert(dupErrorCaught, 'Duplicate return/exchange request on already requested order item correctly blocked');

    console.log(`\n================================================================`);
    console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log(`================================================================\n`);

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await pool.end();
  }
}

runTests();
