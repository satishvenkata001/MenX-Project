import http from 'http';
import app from '../app.js';
import { supabaseAdmin } from '../config/supabase.js';
import { pool } from '../config/db.js';
import { ensureUserProfile } from '../utils/profileHelper.js';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api/v1`;
      console.log(`[TEST-SUITE] Test server running on ${baseUrl}`);
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ ${message}`);
}

async function runRecoveryAndAutohealTests() {
  console.log('================================================================');
  console.log('RECOVERY TOKEN LIFECYCLE & PROFILE AUTO-HEAL TEST SUITE');
  console.log('1. Password Reset with Existing Profile (Real Recovery Token)');
  console.log('2. Password Reset with Missing Profile (Auto-Heal Validation)');
  console.log('3. Normal Login with Missing Profile (Login Auto-Heal Validation)');
  console.log('4. Concurrent Auto-Heal Race Condition Safety');
  console.log('5. Replayed/Expired Recovery Link Rejection');
  console.log('================================================================\n');

  await startServer();

  const timestamp = Date.now();
  const cleanupUserIds = [];

  try {
    // =========================================================================
    // SCENARIO 1: PASSWORD RESET WITH EXISTING PROFILE
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO 1: Password Reset with Existing Profile');
    console.log('----------------------------------------------------------------');

    const email1 = `test.recov.exist.${timestamp}@menxfashion.test`;
    const initialPass1 = 'InitPass@123!';
    const newPass1 = 'UpdatedPass@456!';

    // Create user via signup
    const signupRes1 = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Existing',
        lastName: 'ProfileUser',
        phone: '+91 9911223344',
        email: email1,
        password: initialPass1
      })
    });
    assert(signupRes1.status === 201, '1.1 Signup succeeds with HTTP 201');
    const signupData1 = await signupRes1.json();
    const userId1 = signupData1.data?.user?.id;
    assert(!!userId1, '1.1 User ID returned');
    cleanupUserIds.push(userId1);

    // Confirm email
    await supabaseAdmin.auth.admin.updateUserById(userId1, { email_confirm: true });

    // Generate real recovery link
    const { data: linkData1, error: linkErr1 } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email1,
      options: { redirectTo: 'http://localhost:5173/reset-password' }
    });
    assert(!linkErr1 && !!linkData1?.properties?.action_link, '1.2 Real recovery link generated');

    // Follow link to verify recovery token
    const verifyRes1 = await fetch(linkData1.properties.action_link, {
      method: 'GET',
      redirect: 'manual'
    });
    assert(verifyRes1.status === 303, '1.3 Recovery link verification returns HTTP 303');
    const loc1 = verifyRes1.headers.get('location') || '';
    assert(loc1.includes('access_token=') && loc1.includes('type=recovery'), '1.3 Redirect contains recovery access token');

    const params1 = new URLSearchParams(loc1.split('#')[1]);
    const recoveryToken1 = params1.get('access_token');
    assert(!!recoveryToken1, '1.3 Recovery access token parsed');

    // Update password using recovery access token
    const updateRes1 = await fetch(`${baseUrl}/auth/password-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recoveryToken1}`
      },
      body: JSON.stringify({ newPassword: newPass1 })
    });
    assert(updateRes1.status === 200, '1.4 POST /auth/password-update succeeds with HTTP 200 using recovery token');

    // Old password must fail
    const oldLogin1 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password: initialPass1 })
    });
    assert(oldLogin1.status === 401, '1.5 Old password rejected with HTTP 401');

    // New password must succeed
    const newLogin1 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email1, password: newPass1 })
    });
    assert(newLogin1.status === 200, '1.6 Fresh login with new password succeeds with HTTP 200');
    const newLoginData1 = await newLogin1.json();
    const loginToken1 = newLoginData1.data?.session?.accessToken;
    assert(!!loginToken1, '1.6 Fresh session access token received');

    // Verify /auth/me
    const meRes1 = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginToken1}` }
    });
    assert(meRes1.status === 200, '1.7 GET /auth/me succeeds with new session');

    // =========================================================================
    // SCENARIO 2: PASSWORD RESET WITH MISSING PROFILE (AUTO-HEAL)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO 2: Password Reset with Missing Profile (Auto-Heal)');
    console.log('----------------------------------------------------------------');

    const email2 = `test.recov.orphan.${timestamp}@menxfashion.test`;
    const initialPass2 = 'OrphanPass@123!';
    const newPass2 = 'HealedPass@456!';

    // Create user directly in Supabase
    const { data: userAuth2, error: createErr2 } = await supabaseAdmin.auth.admin.createUser({
      email: email2,
      password: initialPass2,
      email_confirm: true,
      user_metadata: {
        first_name: 'Orphan',
        last_name: 'Customer',
        phone: '+91 9988776655'
      }
    });
    assert(!createErr2 && !!userAuth2?.user?.id, '2.1 Auth user created');
    const userId2 = userAuth2.user.id;
    cleanupUserIds.push(userId2);

    // Delete profile to guarantee orphan state
    await pool.query('DELETE FROM profiles WHERE id = $1', [userId2]);
    const { rows: checkOrphan } = await pool.query('SELECT id FROM profiles WHERE id = $1', [userId2]);
    assert(checkOrphan.length === 0, '2.2 Profile verified absent from database before reset');

    // Generate real recovery link
    const { data: linkData2, error: linkErr2 } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email2,
      options: { redirectTo: 'http://localhost:5173/reset-password' }
    });
    assert(!linkErr2 && !!linkData2?.properties?.action_link, '2.3 Recovery link generated');

    const verifyRes2 = await fetch(linkData2.properties.action_link, {
      method: 'GET',
      redirect: 'manual'
    });
    assert(verifyRes2.status === 303, '2.4 Recovery verify returns HTTP 303');
    const loc2 = verifyRes2.headers.get('location') || '';
    const params2 = new URLSearchParams(loc2.split('#')[1]);
    const recoveryToken2 = params2.get('access_token');
    assert(!!recoveryToken2, '2.4 Recovery access token obtained');

    // POST /auth/password-update — requireAuth must auto-heal and succeed with HTTP 200
    const updateRes2 = await fetch(`${baseUrl}/auth/password-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recoveryToken2}`
      },
      body: JSON.stringify({ newPassword: newPass2 })
    });
    assert(updateRes2.status === 200, '2.5 POST /auth/password-update succeeds with HTTP 200 for user with missing profile');

    // Verify profile was auto-healed in PostgreSQL
    const { rows: healedRows } = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId2]);
    assert(healedRows.length === 1, '2.6 Profile auto-healed in database');
    assert(healedRows[0].first_name === 'Orphan', '2.6 Auto-healed profile first_name matches metadata');
    assert(healedRows[0].role === 'CUSTOMER', '2.6 Auto-healed profile role is CUSTOMER');
    assert(healedRows[0].is_active === true, '2.6 Auto-healed profile is_active is true');

    // Fresh login with new password
    const newLogin2 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email2, password: newPass2 })
    });
    assert(newLogin2.status === 200, '2.7 Fresh login succeeds with new password');
    const newLoginData2 = await newLogin2.json();
    assert(newLoginData2.data?.profile?.role === 'CUSTOMER', '2.7 Login response contains auto-healed profile');

    // Verify /auth/me
    const meRes2 = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${newLoginData2.data.session.accessToken}` }
    });
    assert(meRes2.status === 200, '2.8 GET /auth/me succeeds with auto-healed profile');

    // =========================================================================
    // SCENARIO 3: NORMAL LOGIN WITH MISSING PROFILE (AUTO-HEAL)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO 3: Normal Login with Missing Profile (Auto-Heal)');
    console.log('----------------------------------------------------------------');

    const email3 = `test.login.orphan.${timestamp}@menxfashion.test`;
    const pass3 = 'ValidLoginPass@123!';

    const { data: userAuth3, error: createErr3 } = await supabaseAdmin.auth.admin.createUser({
      email: email3,
      password: pass3,
      email_confirm: true,
      user_metadata: {
        first_name: 'LoginAutoHeal',
        last_name: 'Customer',
        phone: '+91 9123456780'
      }
    });
    assert(!createErr3 && !!userAuth3?.user?.id, '3.1 Auth user created');
    const userId3 = userAuth3.user.id;
    cleanupUserIds.push(userId3);

    // Delete profile
    await pool.query('DELETE FROM profiles WHERE id = $1', [userId3]);
    const { rows: checkOrphan3 } = await pool.query('SELECT id FROM profiles WHERE id = $1', [userId3]);
    assert(checkOrphan3.length === 0, '3.2 Profile verified absent before login');

    // Attempt login — AuthService.login must auto-heal and succeed
    const loginRes3 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email3, password: pass3 })
    });
    assert(loginRes3.status === 200, '3.3 Login succeeds with HTTP 200 despite missing profile');
    const loginData3 = await loginRes3.json();
    assert(loginData3.data?.profile?.first_name === 'LoginAutoHeal', '3.3 Auto-healed profile returned in login response');

    // Verify profile in DB
    const { rows: healedRows3 } = await pool.query('SELECT * FROM profiles WHERE id = $1', [userId3]);
    assert(healedRows3.length === 1, '3.4 Profile exists in PostgreSQL database');

    // =========================================================================
    // SCENARIO 4: CONCURRENT AUTO-HEAL RACE CONDITION SAFETY
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO 4: Concurrent Auto-Heal Race Condition Safety');
    console.log('----------------------------------------------------------------');

    const email4 = `test.race.heal.${timestamp}@menxfashion.test`;
    const { data: userAuth4 } = await supabaseAdmin.auth.admin.createUser({
      email: email4,
      password: 'RacePassword@123!',
      email_confirm: true,
      user_metadata: { first_name: 'Race', last_name: 'Tester' }
    });
    const userId4 = userAuth4.user.id;
    cleanupUserIds.push(userId4);

    await pool.query('DELETE FROM profiles WHERE id = $1', [userId4]);

    // Fire 5 concurrent auto-heal calls at the exact same millisecond
    const results = await Promise.all([
      ensureUserProfile(userAuth4.user),
      ensureUserProfile(userAuth4.user),
      ensureUserProfile(userAuth4.user),
      ensureUserProfile(userAuth4.user),
      ensureUserProfile(userAuth4.user)
    ]);

    assert(results.every((r) => !!r && r.id === userId4), '4.1 All 5 concurrent requests resolved successfully');
    const { rows: raceRows } = await pool.query('SELECT id FROM profiles WHERE id = $1', [userId4]);
    assert(raceRows.length === 1, '4.2 Exactly one profile row exists in database');

    // =========================================================================
    // SCENARIO 5: REPLAYED / EXPIRED RECOVERY LINK REJECTION
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('SCENARIO 5: Replayed Recovery Link Rejection');
    console.log('----------------------------------------------------------------');

    // Replay the link from Scenario 1
    const replayRes = await fetch(linkData1.properties.action_link, {
      method: 'GET',
      redirect: 'manual'
    });
    assert(replayRes.status === 303, '5.1 Replayed link returns HTTP 303 redirect');
    const replayLoc = replayRes.headers.get('location') || '';
    assert(
      replayLoc.includes('otp_expired') || replayLoc.includes('access_denied') || replayLoc.includes('error='),
      '5.2 Replayed link contains error in redirect URL'
    );

    console.log('\n================================================================');
    console.log('✅ ALL RECOVERY LIFECYCLE & AUTO-HEAL TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    console.log('Cleaning up test fixtures...');
    for (const uid of cleanupUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      await pool.query('DELETE FROM profiles WHERE id = $1', [uid]).catch(() => {});
    }
    await stopServer();
  }
}

runRecoveryAndAutohealTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
