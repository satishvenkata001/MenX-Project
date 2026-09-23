import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runSupportAndSuggestionsTests() {
  console.log('================================================================');
  console.log('  MENX INTEGRATION SUITE: SUPPORT TICKETS & FEEDBACK SYSTEM');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  console.log(`[TEST SERVER] Running ephemeral test server on port ${port}\n`);

  let passedTests = 0;
  let totalTests = 0;

  async function assert(name, condition, details = '') {
    totalTests++;
    if (condition) {
      console.log(` [PASS] ${name}`);
      passedTests++;
    } else {
      console.error(` [FAIL] ${name} — ${details}`);
    }
  }

  // Tracking IDs for cleanup
  const createdUserIds = [];
  const createdTicketIds = [];
  const createdMessageIds = [];
  const createdSuggestionIds = [];
  const createdOrderIds = [];
  const createdOrderItemIds = [];
  const createdAddressIds = [];
  const createdZoneIds = [];
  const createdCategoryIds = [];
  const createdSubcategoryIds = [];
  const createdBrandIds = [];
  const createdSizeIds = [];
  const createdColorIds = [];
  const createdProductIds = [];
  const createdVariantIds = [];

  let customer1Token = null;
  let customer1UserId = null;
  let customer2Token = null;
  let customer2UserId = null;
  let adminToken = null;
  let adminUserId = null;

  let customer1Order = null;
  let customer2Order = null;

  try {
    console.log('>>> 1. Schema & Database Structure Verification...');
    
    // Check support_tickets table
    const { data: ticketsTableData, error: ticketsTableErr } = await supabaseAdmin
      .from('support_tickets')
      .select('id, ticket_number, customer_id, order_id, category, subject, message, status, created_at, updated_at, resolved_at, closed_at')
      .limit(0);
    await assert('support_tickets table exists with required columns', !ticketsTableErr, ticketsTableErr?.message);

    // Check support_ticket_messages table
    const { data: messagesTableData, error: messagesTableErr } = await supabaseAdmin
      .from('support_ticket_messages')
      .select('id, ticket_id, sender_type, sender_id, message, created_at')
      .limit(0);
    await assert('support_ticket_messages table exists with required columns', !messagesTableErr, messagesTableErr?.message);

    // Check customer_suggestions table
    const { data: suggestionsTableData, error: suggestionsTableErr } = await supabaseAdmin
      .from('customer_suggestions')
      .select('id, customer_id, message, status, admin_note, created_at, updated_at')
      .limit(0);
    await assert('customer_suggestions table exists with required columns', !suggestionsTableErr, suggestionsTableErr?.message);

    console.log('\n>>> 2. Setting Up Test Accounts, Taxonomy & Orders...');
    const password = 'Password123!Secure';
    const ts = Date.now();

    async function createUser(email, firstName, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'SupportTest' }
      });
      if (authErr) throw new Error(`User ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise(r => setTimeout(r, 150));
      await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`User ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const c1 = await createUser(`supp.cust1.${ts}@menx.com`, 'CustOne');
    customer1UserId = c1.uid;
    customer1Token = c1.token;

    const c2 = await createUser(`supp.cust2.${ts}@menx.com`, 'CustTwo');
    customer2UserId = c2.uid;
    customer2Token = c2.token;

    const adm = await createUser(`supp.admin.${ts}@menx.com`, 'AdminStaff', 'SUPER_ADMIN');
    adminUserId = adm.uid;
    adminToken = adm.token;

    // Delivery Zone & Address setup
    const { data: zone, error: zoneErr } = await supabaseAdmin
      .from('delivery_zones')
      .insert({
        name: `Supp-Zone-${ts}`,
        pincode_pattern: '500082',
        base_delivery_charge: 50.00,
        free_delivery_threshold: 500.00,
        is_active: true
      })
      .select()
      .single();
    if (zoneErr) throw new Error(`Zone insert failed: ${zoneErr.message}`);
    createdZoneIds.push(zone.id);

    const { data: a1, error: a1Err } = await supabaseAdmin
      .from('addresses')
      .insert({
        user_id: customer1UserId,
        address_type: 'HOME',
        recipient_name: 'Customer One',
        phone_number: '9381679796',
        address_line1: '100 MenX Avenue',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500082',
        is_default: true
      })
      .select()
      .single();
    if (a1Err) throw new Error(`Address 1 insert failed: ${a1Err.message}`);
    createdAddressIds.push(a1.id);

    const { data: a2, error: a2Err } = await supabaseAdmin
      .from('addresses')
      .insert({
        user_id: customer2UserId,
        address_type: 'HOME',
        recipient_name: 'Customer Two',
        phone_number: '9381679796',
        address_line1: '200 MenX Boulevard',
        city: 'Hyderabad',
        state: 'Telangana',
        postal_code: '500082',
        is_default: true
      })
      .select()
      .single();
    if (a2Err) throw new Error(`Address 2 insert failed: ${a2Err.message}`);
    createdAddressIds.push(a2.id);

    // Create Order for Customer 1
    const { data: ord1, error: ord1Err } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer1UserId,
        order_number: `ORD-SUPP1-${ts}`,
        order_channel: 'ONLINE',
        subtotal_amount: 1500.00,
        delivery_fee: 0.00,
        discount_amount: 0.00,
        total_payable: 1500.00,
        cod_amount_due: 1500.00,
        payment_method: 'COD',
        payment_status: 'PENDING',
        order_status: 'CONFIRMED',
        shipping_address_id: a1.id,
        shipping_snapshot: { address: '100 MenX Avenue' },
        customer_phone: '9381679796'
      })
      .select()
      .single();
    if (ord1Err) throw new Error(`Failed to create order 1: ${ord1Err.message}`);
    customer1Order = ord1;
    createdOrderIds.push(ord1.id);

    // Create Order for Customer 2
    const { data: ord2, error: ord2Err } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: customer2UserId,
        order_number: `ORD-SUPP2-${ts}`,
        order_channel: 'ONLINE',
        subtotal_amount: 2200.00,
        delivery_fee: 0.00,
        discount_amount: 0.00,
        total_payable: 2200.00,
        cod_amount_due: 2200.00,
        payment_method: 'COD',
        payment_status: 'COLLECTED',
        order_status: 'DELIVERED',
        shipping_address_id: a2.id,
        shipping_snapshot: { address: '200 MenX Boulevard' },
        customer_phone: '9381679796'
      })
      .select()
      .single();
    if (ord2Err) throw new Error(`Failed to create order 2: ${ord2Err.message}`);
    customer2Order = ord2;
    createdOrderIds.push(ord2.id);

    // Helper request function
    async function request(endpoint, options = {}) {
      const url = `${baseUrl}${endpoint}`;
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }
      return { status: res.status, data };
    }

    console.log('\n>>> 3. Customer Support Ticket Creation & Validation...');
    
    // 1. Create ticket without order
    const createTicketRes1 = await request('/support/tickets', {
      method: 'POST',
      token: customer1Token,
      body: {
        category: 'PRODUCT_INQUIRY',
        subject: 'Inquiry about fabric care for linen shirts',
        message: 'Could you please provide the recommended washing instructions for pure linen shirts?'
      }
    });

    await assert(
      'Customer 1 creates support ticket successfully without order',
      createTicketRes1.status === 201 && createTicketRes1.data?.success === true,
      JSON.stringify(createTicketRes1.data)
    );

    const ticket1 = createTicketRes1.data?.data;
    if (ticket1?.id) createdTicketIds.push(ticket1.id);

    await assert(
      'Generated ticket_number follows SUP-<timestamp>-<rand4> format',
      typeof ticket1?.ticket_number === 'string' && /^SUP-\d{10,}-\d{4}$/.test(ticket1.ticket_number),
      `ticket_number is ${ticket1?.ticket_number}`
    );

    await assert(
      'Initial ticket status is OPEN',
      ticket1?.status === 'OPEN',
      `status is ${ticket1?.status}`
    );

    // Check message in support_ticket_messages
    const { data: initialMsgs } = await supabaseAdmin
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticket1?.id);
    
    if (initialMsgs?.[0]?.id) createdMessageIds.push(initialMsgs[0].id);

    await assert(
      'Initial ticket message recorded with sender_type CUSTOMER and correct sender_id',
      initialMsgs?.length === 1 && initialMsgs[0].sender_type === 'CUSTOMER' && initialMsgs[0].sender_id === customer1UserId,
      `initialMsgs: ${JSON.stringify(initialMsgs)}`
    );

    console.log('\n>>> 4. Order Attachment & Customer Isolation Verification...');

    // 2. Create ticket with owned order
    const createTicketWithOrderRes = await request('/support/tickets', {
      method: 'POST',
      token: customer1Token,
      body: {
        category: 'ORDERS_FULFILLMENT',
        orderId: customer1Order.id,
        subject: `Delivery tracking for ${customer1Order.order_number}`,
        message: 'When will this order be dispatched and delivered to my address?'
      }
    });

    await assert(
      'Customer 1 successfully attaches their own order to a ticket',
      createTicketWithOrderRes.status === 201 && createTicketWithOrderRes.data?.data?.order_id === customer1Order.id,
      JSON.stringify(createTicketWithOrderRes.data)
    );

    const ticket2 = createTicketWithOrderRes.data?.data;
    if (ticket2?.id) createdTicketIds.push(ticket2.id);

    // 3. Create ticket with ANOTHER customer's order (should be rejected)
    const unauthorizedOrderTicketRes = await request('/support/tickets', {
      method: 'POST',
      token: customer1Token,
      body: {
        category: 'ORDERS_FULFILLMENT',
        orderId: customer2Order.id, // Belongs to Customer 2!
        subject: 'Attempting to attach Customer 2 order',
        message: 'I am trying to attach an order that does not belong to me.'
      }
    });

    await assert(
      'Attaching another customer\'s order is rejected with 403 Forbidden',
      unauthorizedOrderTicketRes.status === 403,
      `status: ${unauthorizedOrderTicketRes.status}, data: ${JSON.stringify(unauthorizedOrderTicketRes.data)}`
    );

    console.log('\n>>> 5. Customer Ticket Retrieval & Data Isolation...');

    // Customer 1 ticket list
    const c1TicketsListRes = await request('/support/tickets?page=1&limit=10', {
      token: customer1Token
    });

    await assert(
      'Customer 1 retrieves their ticket list with pagination',
      c1TicketsListRes.status === 200 && Array.isArray(c1TicketsListRes.data?.data?.tickets) && c1TicketsListRes.data.data.tickets.length >= 2,
      `status: ${c1TicketsListRes.status}, total: ${c1TicketsListRes.data?.data?.pagination?.total}`
    );

    // Customer 2 ticket list (must be empty for customer 2)
    const c2TicketsListRes = await request('/support/tickets', {
      token: customer2Token
    });

    await assert(
      'Customer isolation in listing: Customer 2 sees only 0 tickets (none of Customer 1\'s tickets)',
      c2TicketsListRes.status === 200 && c2TicketsListRes.data?.data?.tickets?.length === 0,
      `Customer 2 tickets count: ${c2TicketsListRes.data?.data?.tickets?.length}`
    );

    // Customer 1 ticket details
    const c1TicketDetailRes = await request(`/support/tickets/${ticket1.id}`, {
      token: customer1Token
    });

    await assert(
      'Customer 1 retrieves complete ticket details with conversation thread',
      c1TicketDetailRes.status === 200 && Array.isArray(c1TicketDetailRes.data?.data?.messages) && c1TicketDetailRes.data.data.messages.length >= 1,
      JSON.stringify(c1TicketDetailRes.data)
    );

    // Customer 2 attempting to view Customer 1's ticket (must return 404 or 403)
    const c2AccessTicket1Res = await request(`/support/tickets/${ticket1.id}`, {
      token: customer2Token
    });

    await assert(
      'Customer isolation in details: Customer 2 cannot access Customer 1\'s ticket (404/403)',
      c2AccessTicket1Res.status === 404 || c2AccessTicket1Res.status === 403,
      `status: ${c2AccessTicket1Res.status}`
    );

    console.log('\n>>> 6. Customer & Admin Conversation Thread Messaging...');

    // Customer 1 posts a reply
    const c1ReplyRes = await request(`/support/tickets/${ticket1.id}/reply`, {
      method: 'POST',
      token: customer1Token,
      body: {
        message: 'Also, can I machine wash it at 30 degrees Celsius or does it strictly require dry cleaning?'
      }
    });

    await assert(
      'Customer 1 posts a reply message successfully',
      c1ReplyRes.status === 201 && c1ReplyRes.data?.data?.sender_type === 'CUSTOMER',
      JSON.stringify(c1ReplyRes.data)
    );
    if (c1ReplyRes.data?.data?.id) createdMessageIds.push(c1ReplyRes.data.data.id);

    // Customer 2 tries to reply to Customer 1's ticket (must fail)
    const c2ReplyToC1TicketRes = await request(`/support/tickets/${ticket1.id}/reply`, {
      method: 'POST',
      token: customer2Token,
      body: {
        message: 'Intruder message from customer 2'
      }
    });

    await assert(
      'Customer isolation in replying: Customer 2 cannot reply to Customer 1\'s ticket (404/403)',
      c2ReplyToC1TicketRes.status === 404 || c2ReplyToC1TicketRes.status === 403,
      `status: ${c2ReplyToC1TicketRes.status}`
    );

    // Admin posts staff reply
    const adminReplyRes = await request(`/admin/support/tickets/${ticket1.id}/reply`, {
      method: 'POST',
      token: adminToken,
      body: {
        message: 'Hello! Pure linen can be safely gentle machine-washed in cold/warm water up to 30°C. We recommend line-drying in the shade.'
      }
    });

    await assert(
      'Admin posts staff reply successfully with sender_type ADMIN',
      adminReplyRes.status === 201 && adminReplyRes.data?.data?.sender_type === 'ADMIN' && adminReplyRes.data?.data?.sender_id === adminUserId,
      JSON.stringify(adminReplyRes.data)
    );
    if (adminReplyRes.data?.data?.id) createdMessageIds.push(adminReplyRes.data.data.id);

    // Verify conversation count in ticket details
    const refreshedTicketRes = await request(`/support/tickets/${ticket1.id}`, {
      token: customer1Token
    });

    await assert(
      'Customer 1 sees updated conversation thread with both customer and admin messages',
      refreshedTicketRes.status === 200 && refreshedTicketRes.data?.data?.messages?.length === 3,
      `messages count: ${refreshedTicketRes.data?.data?.messages?.length}`
    );

    console.log('\n>>> 7. Admin Support Management, Search, Filters & Details...');

    // Admin ticket list
    const adminListRes = await request('/admin/support/tickets?page=1&limit=10', {
      token: adminToken
    });

    await assert(
      'Admin retrieves all customer support tickets list',
      adminListRes.status === 200 && adminListRes.data?.data?.tickets?.length >= 2,
      `admin tickets count: ${adminListRes.data?.data?.tickets?.length}`
    );

    // Admin filter by category
    const adminCategoryFilterRes = await request('/admin/support/tickets?category=PRODUCT_INQUIRY', {
      token: adminToken
    });

    await assert(
      'Admin filters support tickets by category PRODUCT_INQUIRY',
      adminCategoryFilterRes.status === 200 && adminCategoryFilterRes.data?.data?.tickets?.every(t => t.category === 'PRODUCT_INQUIRY'),
      `results: ${adminCategoryFilterRes.data?.data?.tickets?.length}`
    );

    // Admin search by ticket_number
    const adminSearchRes = await request(`/admin/support/tickets?search=${ticket1.ticket_number}`, {
      token: adminToken
    });

    await assert(
      'Admin searches support tickets by ticket_number',
      adminSearchRes.status === 200 && adminSearchRes.data?.data?.tickets?.some(t => t.ticket_number === ticket1.ticket_number),
      `search result count: ${adminSearchRes.data?.data?.tickets?.length}`
    );

    // Admin ticket details with customer profile and linked order
    const adminDetailRes = await request(`/admin/support/tickets/${ticket2.id}`, {
      token: adminToken
    });

    await assert(
      'Admin retrieves full ticket details including customer profile and linked order details',
      adminDetailRes.status === 200 && adminDetailRes.data?.data?.customer?.email && adminDetailRes.data?.data?.order?.order_number === customer1Order.order_number,
      JSON.stringify(adminDetailRes.data?.data)
    );

    console.log('\n>>> 8. Support Ticket State Machine & Status Transitions...');

    // Valid transition 1: OPEN -> IN_PROGRESS
    const trans1Res = await request(`/admin/support/tickets/${ticket1.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'IN_PROGRESS',
        note: 'Assigned to fabric specialist team.'
      }
    });

    await assert(
      'Transition OPEN -> IN_PROGRESS succeeds',
      trans1Res.status === 200 && trans1Res.data?.data?.status === 'IN_PROGRESS',
      JSON.stringify(trans1Res.data)
    );

    // Valid transition 2: IN_PROGRESS -> RESOLVED (sets resolved_at)
    const trans2Res = await request(`/admin/support/tickets/${ticket1.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'RESOLVED',
        note: 'Customer question answered thoroughly.'
      }
    });

    await assert(
      'Transition IN_PROGRESS -> RESOLVED succeeds and sets resolved_at timestamp',
      trans2Res.status === 200 && trans2Res.data?.data?.status === 'RESOLVED' && trans2Res.data?.data?.resolved_at !== null,
      JSON.stringify(trans2Res.data)
    );

    // Valid transition 3: RESOLVED -> CLOSED (sets closed_at)
    const trans3Res = await request(`/admin/support/tickets/${ticket1.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'CLOSED',
        note: 'Ticket closed after customer acknowledgement.'
      }
    });

    await assert(
      'Transition RESOLVED -> CLOSED succeeds and sets closed_at timestamp',
      trans3Res.status === 200 && trans3Res.data?.data?.status === 'CLOSED' && trans3Res.data?.data?.closed_at !== null,
      JSON.stringify(trans3Res.data)
    );

    // Invalid transition: CLOSED -> OPEN (should be rejected with 400 Bad Request)
    const invalidTransRes = await request(`/admin/support/tickets/${ticket1.id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'OPEN',
        note: 'Attempting invalid reopen from CLOSED'
      }
    });

    await assert(
      'Invalid status transition CLOSED -> OPEN is rejected with 400 Bad Request',
      invalidTransRes.status === 400,
      `status: ${invalidTransRes.status}, msg: ${invalidTransRes.data?.message}`
    );

    console.log('\n>>> 9. RBAC Enforcement on Support Admin Endpoints...');

    // Customer calling admin ticket list
    const rbacListRes = await request('/admin/support/tickets', {
      token: customer1Token
    });

    await assert(
      'Customer is forbidden from accessing GET /admin/support/tickets (403)',
      rbacListRes.status === 403,
      `status: ${rbacListRes.status}`
    );

    // Customer calling admin ticket reply
    const rbacReplyRes = await request(`/admin/support/tickets/${ticket1.id}/reply`, {
      method: 'POST',
      token: customer1Token,
      body: { message: 'Customer trying to act as staff' }
    });

    await assert(
      'Customer is forbidden from accessing POST /admin/support/tickets/:id/reply (403)',
      rbacReplyRes.status === 403,
      `status: ${rbacReplyRes.status}`
    );

    // Customer calling admin ticket status transition
    const rbacStatusRes = await request(`/admin/support/tickets/${ticket1.id}/status`, {
      method: 'PATCH',
      token: customer1Token,
      body: { status: 'RESOLVED' }
    });

    await assert(
      'Customer is forbidden from accessing PATCH /admin/support/tickets/:id/status (403)',
      rbacStatusRes.status === 403,
      `status: ${rbacStatusRes.status}`
    );

    console.log('\n>>> 10. Suggestions & Feedback Feature Integration...');

    // 1. Authenticated customer submits suggestion
    const custSuggestionRes = await request('/suggestions', {
      method: 'POST',
      token: customer1Token,
      body: {
        message: 'It would be wonderful to have an interactive size recommendation quiz based on height, weight, and fit preference!'
      }
    });

    await assert(
      'Authenticated customer submits suggestion with customer_id automatically attached',
      custSuggestionRes.status === 201 && custSuggestionRes.data?.data?.customer_id === customer1UserId,
      JSON.stringify(custSuggestionRes.data)
    );

    const sugg1 = custSuggestionRes.data?.data;
    if (sugg1?.id) createdSuggestionIds.push(sugg1.id);

    await assert(
      'Initial suggestion status is NEW',
      sugg1?.status === 'NEW',
      `status is ${sugg1?.status}`
    );

    // 2. Anonymous / Guest user submits suggestion (no auth header)
    const anonSuggestionRes = await request('/suggestions', {
      method: 'POST',
      body: {
        message: 'Please add express next-day delivery options for metro cities across India.'
      }
    });

    await assert(
      'Anonymous / guest user submits suggestion with customer_id = null',
      anonSuggestionRes.status === 201 && anonSuggestionRes.data?.data?.customer_id === null,
      JSON.stringify(anonSuggestionRes.data)
    );

    const sugg2 = anonSuggestionRes.data?.data;
    if (sugg2?.id) createdSuggestionIds.push(sugg2.id);

    // 3. Validation limits: Too short message (< 5 chars)
    const shortSuggestionRes = await request('/suggestions', {
      method: 'POST',
      body: { message: 'Hi' }
    });

    await assert(
      'Suggestion with message < 5 characters is rejected with 400 Bad Request',
      shortSuggestionRes.status === 400,
      `status: ${shortSuggestionRes.status}`
    );

    console.log('\n>>> 11. Admin Suggestions Management & Internal Admin Notes...');

    // Admin lists suggestions
    const adminSuggListRes = await request('/admin/suggestions?page=1&limit=10', {
      token: adminToken
    });

    await assert(
      'Admin retrieves all customer suggestions with customer profile data',
      adminSuggListRes.status === 200 && adminSuggListRes.data?.data?.suggestions?.length >= 2,
      `suggestions count: ${adminSuggListRes.data?.data?.suggestions?.length}`
    );

    // Admin updates suggestion status & internal admin note
    const adminUpdateSuggRes = await request(`/admin/suggestions/${sugg1.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'ACCEPTED',
        adminNote: 'Scheduled for Q4 Roadmap - AI Fit recommendation widget.'
      }
    });

    await assert(
      'Admin updates suggestion status to ACCEPTED and adds internal admin note',
      adminUpdateSuggRes.status === 200 && adminUpdateSuggRes.data?.data?.status === 'ACCEPTED' && adminUpdateSuggRes.data?.data?.admin_note?.includes('Q4 Roadmap'),
      JSON.stringify(adminUpdateSuggRes.data)
    );

    // RBAC on admin suggestions
    const rbacSuggListRes = await request('/admin/suggestions', {
      token: customer1Token
    });

    await assert(
      'Customer is forbidden from accessing GET /admin/suggestions (403)',
      rbacSuggListRes.status === 403,
      `status: ${rbacSuggListRes.status}`
    );

    const rbacSuggPatchRes = await request(`/admin/suggestions/${sugg1.id}`, {
      method: 'PATCH',
      token: customer1Token,
      body: { status: 'REJECTED' }
    });

    await assert(
      'Customer is forbidden from accessing PATCH /admin/suggestions/:id (403)',
      rbacSuggPatchRes.status === 403,
      `status: ${rbacSuggPatchRes.status}`
    );

    console.log('\n>>> 12. Support Phone Hotline Consistency Verification...');
    
    // Verify phone number in HelpCenter.jsx and BaseLayout.jsx
    const helpCenterCode = fs.readFileSync(path.resolve('d:/MenX/frontend/src/pages/HelpCenter.jsx'), 'utf8');
    const baseLayoutCode = fs.readFileSync(path.resolve('d:/MenX/frontend/src/components/BaseLayout.jsx'), 'utf8');

    const hasHelpCenterPhone = helpCenterCode.includes('9381679796') && helpCenterCode.includes('tel:9381679796');
    const hasBaseLayoutPhone = baseLayoutCode.includes('9381679796') && baseLayoutCode.includes('tel:9381679796');

    await assert(
      'Support hotline phone 9381679796 and tel:9381679796 are properly embedded in HelpCenter and BaseLayout',
      hasHelpCenterPhone && hasBaseLayoutPhone,
      `helpCenter: ${hasHelpCenterPhone}, baseLayout: ${hasBaseLayoutPhone}`
    );

  } catch (err) {
    console.error('\n [UNHANDLED TEST EXCEPTION]:', err);
  } finally {
    console.log('\n>>> 13. Comprehensive Test Fixture Cleanup...');

    // 1. Delete support messages
    if (createdMessageIds.length > 0) {
      await supabaseAdmin.from('support_ticket_messages').delete().in('id', createdMessageIds);
    }
    // Delete any remaining messages for test tickets
    if (createdTicketIds.length > 0) {
      await supabaseAdmin.from('support_ticket_messages').delete().in('ticket_id', createdTicketIds);
      await supabaseAdmin.from('support_tickets').delete().in('id', createdTicketIds);
    }

    // 2. Delete suggestions
    if (createdSuggestionIds.length > 0) {
      await supabaseAdmin.from('customer_suggestions').delete().in('id', createdSuggestionIds);
    }

    // 3. Delete orders & addresses & delivery zones
    if (createdOrderIds.length > 0) {
      await supabaseAdmin.from('order_items').delete().in('order_id', createdOrderIds);
      await supabaseAdmin.from('orders').delete().in('id', createdOrderIds);
    }
    if (createdAddressIds.length > 0) {
      await supabaseAdmin.from('addresses').delete().in('id', createdAddressIds);
    }
    if (createdZoneIds.length > 0) {
      await supabaseAdmin.from('delivery_zones').delete().in('id', createdZoneIds);
    }

    // 4. Delete test users
    for (const uid of createdUserIds) {
      await supabaseAdmin.from('profiles').delete().eq('id', uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    server.close();
    console.log(`[CLEANUP COMPLETE] Removed test fixtures: ${createdTicketIds.length} tickets, ${createdSuggestionIds.length} suggestions, ${createdOrderIds.length} orders, ${createdUserIds.length} users.`);

    console.log('\n================================================================');
    console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    console.log('================================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  }
}

runSupportAndSuggestionsTests();
