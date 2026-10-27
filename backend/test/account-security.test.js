import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, generateTotpCode, generateTotpSecret,
  hashOpaqueToken, hashRecoveryCode, verifyTotp,
} from '../src/utils/totp.js';
import { isMailConfigured } from '../src/utils/mailer.js';
import User from '../src/models/User.js';

test('TOTP validates RFC 4226 counter vector and rejects an incorrect code', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const code = generateTotpCode(secret, 59000);

  assert.equal(code, '287082');
  assert.equal(verifyTotp(secret, code, 59000), true);
  assert.equal(verifyTotp(secret, '287083', 59000), false);
});

test('TOTP setup secrets and recovery codes are unique and usable', () => {
  const secret = generateTotpSecret();
  const codes = generateRecoveryCodes();

  assert.equal(secret.length, 32);
  assert.equal(verifyTotp(secret, generateTotpCode(secret)), true);
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(codes[0].toLowerCase()));
});

test('MFA secrets are encrypted and require a configured encryption key', () => {
  const oldKey = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = 'ab'.repeat(32);
  try {
    const encrypted = encryptTotpSecret('MYTESTSECRET');
    assert.notEqual(encrypted, 'MYTESTSECRET');
    assert.equal(decryptTotpSecret(encrypted), 'MYTESTSECRET');
  } finally {
    if (oldKey === undefined) delete process.env.MFA_ENCRYPTION_KEY;
    else process.env.MFA_ENCRYPTION_KEY = oldKey;
  }
});

test('opaque tokens are stored as deterministic digests, not plaintext', () => {
  const token = 'a'.repeat(64);
  const digest = hashOpaqueToken(token);
  assert.notEqual(digest, token);
  assert.equal(hashOpaqueToken(token), digest);
});

test('user JSON never exposes password, recovery, or encrypted MFA fields', () => {
  const user = new User({
    name: 'Organizer',
    email: 'organizer@example.test',
    passwordHash: 'password-hash',
    authTokenVersion: 3,
    emailVerificationTokenHash: 'verification-hash',
    passwordResetTokenHash: 'reset-hash',
    mfaSecretEncrypted: 'encrypted-secret',
    mfaPendingSecretEncrypted: 'pending-secret',
    mfaRecoveryCodeHashes: ['recovery-hash'],
  });
  const json = user.toJSON();

  assert.equal(json.name, 'Organizer');
  for (const field of ['passwordHash', 'authTokenVersion', 'emailVerificationTokenHash', 'passwordResetTokenHash', 'mfaSecretEncrypted', 'mfaPendingSecretEncrypted', 'mfaRecoveryCodeHashes']) {
    assert.equal(Object.hasOwn(json, field), false, `${field} should not be serialized`);
  }
});

test('SMTP is considered configured only with required delivery settings', () => {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(isMailConfigured(), false);
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_FROM = 'EventPilot <noreply@example.test>';
    assert.equal(isMailConfigured(), true);
    process.env.SMTP_USER = 'smtp-user';
    assert.equal(isMailConfigured(), false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
