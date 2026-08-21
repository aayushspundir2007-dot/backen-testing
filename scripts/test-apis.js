/**
 * Enterprise API Test Suite for Signup & Email Verification Workflow
 */
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000/api/v1';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passed = 0;
let failed = 0;

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ${colors.red}✖ FAILED:${colors.reset} ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`  ${colors.green}✔ PASSED:${colors.reset} ${message}`);
    passed++;
  }
}

async function runTest(title, testFn) {
  console.log(`\n${colors.cyan}${colors.bold}▶ TEST: ${title}${colors.reset}`);
  try {
    await testFn();
  } catch (err) {
    console.error(`  ${colors.red}Error: ${err.message}${colors.reset}`);
  }
}

async function runSuite() {
  console.log(`\n${colors.bold}========================================`);
  console.log(`🚀 Starting Enterprise Signup API Test Suite`);
  console.log(`📡 Target API: ${BASE_URL}`);
  console.log(`========================================${colors.reset}\n`);

  const uniqueSuffix = Date.now();
  const testUser = {
    email: `enterprise.user.${uniqueSuffix}@acme-corp.com`,
    password: 'SecurePassword123!',
    firstName: 'Alexander',
    lastName: 'Hamilton',
  };

  let capturedToken = null;

  // 1. Health check
  await runTest('GET /health - System health check', async () => {
    const res = await request('/health', { method: 'GET' });
    assert(res.status === 200, `Expected status 200, got ${res.status}`);
    assert(res.body.success === true, 'Expected body.success to be true');
    assert(res.body.data.service === 'enterprise-auth-api', 'Expected valid service metadata');
  });

  // 2. Validation: Missing required fields
  await runTest('POST /auth/signup - Fails on missing required fields (empty payload)', async () => {
    const res = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.body.success === false, 'Expected success === false');
    assert(res.body.errorCode === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR code, got ${res.body.errorCode}`);
    assert(Array.isArray(res.body.errors) && res.body.errors.length > 0, 'Expected validation error details array');
  });

  // 3. Validation: Weak password
  await runTest('POST /auth/signup - Fails on weak password (no uppercase / special char)', async () => {
    const res = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'weak.password@example.com',
        password: 'weakpassword',
        firstName: 'John',
        lastName: 'Doe',
      }),
    });
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.body.errorCode === 'VALIDATION_ERROR', 'Expected VALIDATION_ERROR code');
  });

  // 4. Successful Signup
  await runTest('POST /auth/signup - Successfully registers new enterprise user', async () => {
    const res = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(testUser),
    });
    assert(res.status === 201, `Expected status 201 Created, got ${res.status}`);
    assert(res.body.success === true, 'Expected body.success to be true');
    assert(res.body.data.user.email === testUser.email.toLowerCase(), 'Expected matched email');
    assert(res.body.data.user.status === 'PENDING_VERIFICATION', 'Expected PENDING_VERIFICATION status');
    assert(res.body.data.user.isEmailVerified === false, 'Expected isEmailVerified === false');
    assert(res.body.data.user.password === undefined, 'Security: Password hash must NOT be in response');
    assert(res.body.data.user.__v === undefined, '__v should be stripped in response');

    capturedToken = res.body.data.verification.debugVerificationToken;
    assert(typeof capturedToken === 'string' && capturedToken.length === 64, 'Expected valid 64-char hex token');
  });

  // 5. Conflict: Duplicate email
  await runTest('POST /auth/signup - Rejects duplicate email registration with 409 Conflict', async () => {
    const res = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(testUser),
    });
    assert(res.status === 409, `Expected status 409 Conflict, got ${res.status}`);
    assert(res.body.success === false, 'Expected success === false');
    assert(res.body.errorCode === 'DUPLICATE_RESOURCE', 'Expected DUPLICATE_RESOURCE errorCode');
  });

  // 6. Verify Email: Invalid Token
  await runTest('GET /auth/verify-email - Rejects invalid token', async () => {
    const fakeToken = '0000000000000000000000000000000000000000000000000000000000000000';
    const res = await request(`/auth/verify-email?token=${fakeToken}`, { method: 'GET' });
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.body.errorCode === 'TOKEN_INVALID_OR_EXPIRED', 'Expected TOKEN_INVALID_OR_EXPIRED error code');
  });

  // 7. Verify Email: Valid Token
  await runTest('GET /auth/verify-email - Successfully activates user with valid token', async () => {
    assert(capturedToken !== null, 'Captured token must be present');
    const res = await request(`/auth/verify-email?token=${capturedToken}`, { method: 'GET' });
    assert(res.status === 200, `Expected status 200 OK, got ${res.status}`);
    assert(res.body.success === true, 'Expected body.success === true');
    assert(res.body.data.user.status === 'ACTIVE', 'Expected status to update to ACTIVE');
    assert(res.body.data.user.isEmailVerified === true, 'Expected isEmailVerified to be true');
    assert(res.body.data.user.emailVerifiedAt !== null, 'Expected emailVerifiedAt timestamp');
  });

  // 8. Verify Email: Re-using already verified token
  await runTest('GET /auth/verify-email - Rejects token reuse after email is verified', async () => {
    const res = await request(`/auth/verify-email?token=${capturedToken}`, { method: 'GET' });
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
  });

  // 9. Resend Verification: Already verified account rejection
  await runTest('POST /auth/resend-verification - Fails for already verified active account', async () => {
    const res = await request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email }),
    });
    assert(res.status === 400, `Expected status 400, got ${res.status}`);
    assert(res.body.errorCode === 'ACCOUNT_ALREADY_VERIFIED', 'Expected ACCOUNT_ALREADY_VERIFIED code');
  });

  // 10. Resend Verification: Cooldown rate limiting for pending user
  await runTest('POST /auth/resend-verification - Enforces cooldown on rapid resend requests', async () => {
    const cooldownUser = {
      email: `cooldown.test.${uniqueSuffix}@acme-corp.com`,
      password: 'SecurePassword123!',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    const signupRes = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(cooldownUser),
    });
    assert(signupRes.status === 201, 'Created pending user');

    // Immediate resend should trigger cooldown 429
    const resendRes = await request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: cooldownUser.email }),
    });
    assert(resendRes.status === 429, `Expected status 429 Too Many Requests, got ${resendRes.status}`);
    assert(resendRes.body.errorCode === 'COOLDOWN_ACTIVE', `Expected COOLDOWN_ACTIVE code, got ${resendRes.body.errorCode}`);
  });

  // Summary
  console.log(`\n${colors.bold}========================================`);
  console.log(`📊 Test Execution Results:`);
  console.log(`   ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`   ${failed > 0 ? colors.red : colors.green}Failed: ${failed}${colors.reset}`);
  console.log(`${colors.bold}========================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
