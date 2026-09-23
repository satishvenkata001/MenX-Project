import http from 'http';
import app from '../app.js';
import { supabaseAdmin, createAuthClient } from '../config/supabase.js';

async function runFeedbackModalFlowTests() {
  console.log('================================================================');
  console.log('  MENX INTEGRATION SUITE: ADMIN CUSTOMER FEEDBACK DETAILS MODAL');
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

  const createdUserIds = [];
  const createdSuggestionIds = [];

  let customerToken = null;
  let customerUserId = null;
  let adminToken = null;
  let adminUserId = null;

  try {
    const password = 'Password123!Secure';
    const ts = Date.now();

    async function createUser(email, firstName, role = 'CUSTOMER') {
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: 'FeedbackTest' }
      });
      if (authErr) throw new Error(`User ${email} creation failed: ${authErr.message}`);
      const uid = authUser.user.id;
      createdUserIds.push(uid);

      await new Promise((r) => setTimeout(r, 150));
      await supabaseAdmin.from('profiles').update({ role }).eq('id', uid);

      const authClient = createAuthClient();
      const { data: login, error: loginErr } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      if (loginErr) throw new Error(`User ${email} login failed: ${loginErr.message}`);

      return { uid, token: login.session.access_token };
    }

    const cust = await createUser(`feedback.cust.${ts}@menx.com`, 'Rohan');
    customerUserId = cust.uid;
    customerToken = cust.token;

    const adm = await createUser(`feedback.admin.${ts}@menx.com`, 'StoreAdmin', 'SUPER_ADMIN');
    adminUserId = adm.uid;
    adminToken = adm.token;

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

    console.log('>>> 1. Creating Authenticated & Anonymous Feedback Suggestions...');

    // 1. Authenticated customer feedback
    const authSuggRes = await request('/suggestions', {
      method: 'POST',
      token: customerToken,
      body: {
        message: 'Please add fabric weight (GSM) information and garment transparency ratings to the product details page.'
      }
    });

    await assert(
      'Authenticated feedback created with NEW status and customer ID',
      authSuggRes.status === 201 && authSuggRes.data?.data?.status === 'NEW' && authSuggRes.data?.data?.customer_id === customerUserId,
      JSON.stringify(authSuggRes.data)
    );
    const authSugg = authSuggRes.data?.data;
    if (authSugg?.id) createdSuggestionIds.push(authSugg.id);

    // 2. Anonymous feedback
    const anonSuggRes = await request('/suggestions', {
      method: 'POST',
      body: {
        message: 'Support UPI auto-pay for subscription orders and monthly wardrobe boxes.'
      }
    });

    await assert(
      'Anonymous feedback created with customer_id = null',
      anonSuggRes.status === 201 && anonSuggRes.data?.data?.customer_id === null,
      JSON.stringify(anonSuggRes.data)
    );
    const anonSugg = anonSuggRes.data?.data;
    if (anonSugg?.id) createdSuggestionIds.push(anonSugg.id);

    console.log('\n>>> 2. Admin Viewing Feedback Details List & Item Structure...');

    const adminListRes = await request(`/admin/suggestions?search=${encodeURIComponent('fabric weight')}`, {
      token: adminToken
    });

    await assert(
      'Admin searches feedback list and retrieves customer profile details',
      adminListRes.status === 200 && adminListRes.data?.data?.suggestions?.length >= 1,
      JSON.stringify(adminListRes.data)
    );

    const foundSugg = adminListRes.data?.data?.suggestions?.[0];
    await assert(
      'Feedback item contains message, customer details (first_name, email), received timestamp',
      foundSugg?.first_name === 'Rohan' && foundSugg?.email?.includes('feedback.cust') && typeof foundSugg?.created_at === 'string',
      JSON.stringify(foundSugg)
    );

    console.log('\n>>> 3. Admin Saving Feedback Status & Internal Staff Note (Valid Flow)...');

    // Save update to ACCEPTED with internal roadmap note
    const saveRes = await request(`/admin/suggestions/${authSugg.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'ACCEPTED',
        adminNote: 'Reviewed in Product Sync — Scheduled for Autumn catalog release with GSM labels.'
      }
    });

    await assert(
      'Admin successfully updates feedback status to ACCEPTED with internal note (HTTP 200)',
      saveRes.status === 200 && saveRes.data?.data?.status === 'ACCEPTED',
      JSON.stringify(saveRes.data)
    );

    await assert(
      'Internal staff note is preserved accurately in response payload',
      saveRes.data?.data?.admin_note?.includes('Autumn catalog release'),
      `admin_note: ${saveRes.data?.data?.admin_note}`
    );

    // Verify reopening / re-fetching the feedback item shows the updated status and internal note
    const refetchListRes = await request(`/admin/suggestions?search=${encodeURIComponent('fabric weight')}`, {
      token: adminToken
    });

    const refreshedSugg = refetchListRes.data?.data?.suggestions?.find((s) => s.id === authSugg.id);
    await assert(
      'Re-fetching feedback item confirms persistent updated status ACCEPTED and saved internal staff note',
      refreshedSugg?.status === 'ACCEPTED' && refreshedSugg?.admin_note?.includes('Autumn catalog release'),
      JSON.stringify(refreshedSugg)
    );

    console.log('\n>>> 4. Testing Error Cases & Invalid Status Submissions...');

    // Attempting invalid status
    const invalidStatusRes = await request(`/admin/suggestions/${authSugg.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'UNKNOWN_INVALID_STATUS',
        adminNote: 'Should fail'
      }
    });

    await assert(
      'Submitting invalid status is rejected with HTTP 400 Bad Request',
      invalidStatusRes.status === 400,
      `status: ${invalidStatusRes.status}, data: ${JSON.stringify(invalidStatusRes.data)}`
    );

    // Confirm that failed update did not modify the database state
    const afterFailListRes = await request(`/admin/suggestions?search=${encodeURIComponent('fabric weight')}`, {
      token: adminToken
    });
    const afterFailSugg = afterFailListRes.data?.data?.suggestions?.find((s) => s.id === authSugg.id);
    await assert(
      'Failed update keeps existing status intact (ACCEPTED)',
      afterFailSugg?.status === 'ACCEPTED',
      `status: ${afterFailSugg?.status}`
    );

    console.log('\n>>> 5. Customer Authorization Protection (RBAC)...');

    const customerPatchRes = await request(`/admin/suggestions/${authSugg.id}`, {
      method: 'PATCH',
      token: customerToken,
      body: {
        status: 'REJECTED'
      }
    });

    await assert(
      'Customer cannot save or alter feedback status on /admin/suggestions/:id (HTTP 403 Forbidden)',
      customerPatchRes.status === 403,
      `status: ${customerPatchRes.status}`
    );

    console.log('\n>>> 6. Admin Transition to IMPLEMENTED...');

    const implementedRes = await request(`/admin/suggestions/${authSugg.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'IMPLEMENTED',
        adminNote: 'Feature live in production v1.4.0'
      }
    });

    await assert(
      'Admin successfully transitions status to IMPLEMENTED',
      implementedRes.status === 200 && implementedRes.data?.data?.status === 'IMPLEMENTED',
      JSON.stringify(implementedRes.data)
    );

  } catch (err) {
    console.error('\n [UNHANDLED TEST EXCEPTION]:', err);
  } finally {
    console.log('\n>>> Cleaning up test fixtures...');

    if (createdSuggestionIds.length > 0) {
      await supabaseAdmin.from('customer_suggestions').delete().in('id', createdSuggestionIds);
    }

    for (const uid of createdUserIds) {
      await supabaseAdmin.from('profiles').delete().eq('id', uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }

    server.close();
    console.log(`[CLEANUP COMPLETE] Removed test fixtures: ${createdSuggestionIds.length} suggestions, ${createdUserIds.length} users.`);

    console.log('\n================================================================');
    console.log(`  FEEDBACK MODAL FLOW TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    console.log('================================================================\n');

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  }
}

runFeedbackModalFlowTests();
