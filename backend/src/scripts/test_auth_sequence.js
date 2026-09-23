async function testAuthFlow() {
  const adminEmail = 'admin.1786782027454@menx.com';
  const password = 'SuperAdmin!SecurePass2026';

  console.log('1. Calling POST /api/v1/auth/login ...');
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password })
  });

  console.log('Login HTTP status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login Response:', JSON.stringify(loginData, null, 2));

  if (!loginRes.ok) {
    console.error('Login failed!');
    return;
  }

  const token = loginData.data?.session?.accessToken;
  console.log('\n2. Calling GET /api/v1/auth/me with Bearer token ...');
  const meRes = await fetch('http://localhost:5000/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  console.log('GET /auth/me HTTP status:', meRes.status);
  const meData = await meRes.json();
  console.log('Profile Data:', JSON.stringify(meData, null, 2));

  console.log('\n3. Role evaluation:');
  const role = meData.data?.profile?.role;
  const isAdminOrStaff = ['SUPER_ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER', 'STORE_STAFF'].includes(role);
  console.log(`Role: "${role}" -> isAdminOrStaff: ${isAdminOrStaff}`);

  console.log('\n4. Calling Protected Admin API: GET /api/v1/admin/categories ...');
  const adminCatRes = await fetch('http://localhost:5000/api/v1/admin/categories', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  console.log('Admin categories HTTP status:', adminCatRes.status);
}

testAuthFlow().catch(console.error);
