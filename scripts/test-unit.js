/**
 * Unit Test Suite for Enterprise Signup Architecture Components
 */
const assert = require('assert');
const CryptoUtils = require('../src/utils/crypto');
const ApiError = require('../src/utils/ApiError');
const ApiResponse = require('../src/utils/ApiResponse');
const authValidation = require('../src/validations/auth.validation');
const { AccountStatus, UserRole, ErrorCode, HttpStatus } = require('../src/constants/enums');
const app = require('../src/app');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ${colors.green}✔ PASSED:${colors.reset} ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ${colors.red}✖ FAILED:${colors.reset} ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(`  ${colors.green}✔ PASSED:${colors.reset} ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ${colors.red}✖ FAILED:${colors.reset} ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runUnitTests() {
  console.log(`\n${colors.cyan}${colors.bold}=== Running Enterprise Unit Tests ===${colors.reset}\n`);

  // 1. Crypto Utilities
  console.log(`${colors.bold}1. Crypto & Hashing Tests${colors.reset}`);
  await itAsync('Should hash password and successfully verify with correct password', async () => {
    const rawPass = 'P@ssw0rdEnterprise2026!';
    const hash = await CryptoUtils.hashPassword(rawPass, 10);
    assert.strictEqual(typeof hash, 'string');
    assert.ok(hash.startsWith('$2'));

    const match = await CryptoUtils.comparePassword(rawPass, hash);
    assert.strictEqual(match, true);

    const mismatch = await CryptoUtils.comparePassword('WrongPassword123!', hash);
    assert.strictEqual(mismatch, false);
  });

  it('Should generate 64-character hex crypto token and match SHA-256 hash', () => {
    const rawToken = CryptoUtils.generateRandomToken(32);
    assert.strictEqual(rawToken.length, 64);

    const hash1 = CryptoUtils.hashToken(rawToken);
    const hash2 = CryptoUtils.hashToken(rawToken);
    assert.strictEqual(hash1.length, 64);
    assert.strictEqual(hash1, hash2);
  });

  // 2. Validation Schemas
  console.log(`\n${colors.bold}2. Joi Validation Schemas${colors.reset}`);
  it('Should accept valid enterprise signup payload', () => {
    const validData = {
      email: 'alexander.hamilton@treasury.gov',
      password: 'StrongPassword123#',
      firstName: 'Alexander',
      lastName: 'Hamilton',
      role: UserRole.USER,
    };
    const { error, value } = authValidation.signup.body.validate(validData);
    assert.strictEqual(error, undefined);
    assert.strictEqual(value.email, validData.email);
  });

  it('Should reject weak passwords missing special chars or numbers', () => {
    const weakData = {
      email: 'user@example.com',
      password: 'alllowercasepassword',
      firstName: 'John',
      lastName: 'Doe',
    };
    const { error } = authValidation.signup.body.validate(weakData);
    assert.ok(error !== undefined);
  });

  it('Should reject invalid email format', () => {
    const invalidEmailData = {
      email: 'not-an-email',
      password: 'StrongPassword123#',
      firstName: 'John',
      lastName: 'Doe',
    };
    const { error } = authValidation.signup.body.validate(invalidEmailData);
    assert.ok(error !== undefined);
  });

  it('Should reject empty first or last names', () => {
    const emptyNameData = {
      email: 'user@example.com',
      password: 'StrongPassword123#',
      firstName: '',
      lastName: 'Doe',
    };
    const { error } = authValidation.signup.body.validate(emptyNameData);
    assert.ok(error !== undefined);
  });

  it('Should validate email verification query token', () => {
    const validQuery = { token: 'abc1234567890' };
    const { error } = authValidation.verifyEmail.query.validate(validQuery);
    assert.strictEqual(error, undefined);

    const emptyQuery = {};
    const { error: emptyErr } = authValidation.verifyEmail.query.validate(emptyQuery);
    assert.ok(emptyErr !== undefined);
  });

  it('Should validate valid login credentials and reject missing password', () => {
    const validLogin = { email: 'user@example.com', password: 'Password123!' };
    const { error: validErr, value } = authValidation.login.body.validate(validLogin);
    assert.strictEqual(validErr, undefined);
    assert.strictEqual(value.email, 'user@example.com');

    const invalidLogin = { email: 'user@example.com' };
    const { error: invalidErr } = authValidation.login.body.validate(invalidLogin);
    assert.ok(invalidErr !== undefined);
  });

  // 3. ApiError & ApiResponse
  console.log(`\n${colors.bold}3. Standard Response & Error Contracts${colors.reset}`);
  it('Should construct ApiError with status, error codes, and operational flags', () => {
    const err = ApiError.conflict('User already exists', ErrorCode.DUPLICATE_RESOURCE);
    assert.strictEqual(err.statusCode, HttpStatus.CONFLICT);
    assert.strictEqual(err.errorCode, ErrorCode.DUPLICATE_RESOURCE);
    assert.strictEqual(err.isOperational, true);
    assert.strictEqual(err.success, false);
  });

  it('Should construct ApiResponse with envelope metadata and timestamp', () => {
    const resp = ApiResponse.created('User created', { id: '123' });
    assert.strictEqual(resp.statusCode, HttpStatus.CREATED);
    assert.strictEqual(resp.success, true);
    assert.strictEqual(resp.message, 'User created');
    assert.strictEqual(resp.data.id, '123');
    assert.ok(resp.meta.timestamp);
  });

  // 4. Express App Stack
  console.log(`\n${colors.bold}4. Express Architecture Integrity${colors.reset}`);
  it('Should export configured Express application', () => {
    assert.ok(app);
    assert.strictEqual(typeof app.listen, 'function');
  });

  // Summary
  console.log(`\n${colors.bold}========================================`);
  console.log(`📊 Unit Test Results:`);
  console.log(`   ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`   ${failed > 0 ? colors.red : colors.green}Failed: ${failed}${colors.reset}`);
  console.log(`${colors.bold}========================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runUnitTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
