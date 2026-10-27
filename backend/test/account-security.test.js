import test from 'node:test';
import assert from 'node:assert/strict';
import { hashOpaqueToken } from '../src/utils/totp.js';
import { isMailConfigured } from '../src/utils/mailer.js';
import User from '../src/models/User.js';

test('opaque tokens are stored as deterministic digests, not plaintext', () => {
  const token = 'a'.repeat(64);
  const digest = hashOpaqueToken(token);
  assert.notEqual(digest, token);
  assert.equal(hashOpaqueToken(token), digest);
});

test('user JSON never exposes password or token hashes', () => {
  const user = new User({
    name: 'Organizer',
    email: 'organizer@example.test',
    passwordHash: 'password-hash',
    authTokenVersion: 3,
    emailVerificationTokenHash: 'verification-hash',
    passwordResetTokenHash: 'reset-hash',
  });
  const json = user.toJSON();

  assert.equal(json.name, 'Organizer');
  for (const field of ['passwordHash', 'authTokenVersion', 'emailVerificationTokenHash', 'passwordResetTokenHash']) {
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
