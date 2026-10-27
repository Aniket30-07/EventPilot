import crypto from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (secret) => {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of secret.toUpperCase().replace(/=+$/g, '')) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Invalid TOTP secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const generateTotpCode = (secret, now = Date.now()) => {
  const key = base32Decode(secret);
  const counter = BigInt(Math.floor(now / 30000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, '0');
};

export const verifyTotp = (secret, candidate, now = Date.now()) => {
  if (typeof candidate !== 'string' || !/^\d{6}$/.test(candidate)) return false;
  const key = base32Decode(secret);
  for (let drift = -1; drift <= 1; drift += 1) {
    const counter = BigInt(Math.floor(now / 30000) + drift);
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(counter);
    const digest = crypto.createHmac('sha1', key).update(message).digest();
    const offset = digest[digest.length - 1] & 15;
    const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    if (crypto.timingSafeEqual(Buffer.from(String(number).padStart(6, '0')), Buffer.from(candidate))) return true;
  }
  return false;
};

export const encryptTotpSecret = (secret) => {
  const keyText = process.env.MFA_ENCRYPTION_KEY || '';
  if (!/^[\da-f]{64}$/i.test(keyText)) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured as 64 hexadecimal characters before enabling MFA.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyText, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('hex')).join('.');
};

export const decryptTotpSecret = (value) => {
  const keyText = process.env.MFA_ENCRYPTION_KEY || '';
  if (!/^[\da-f]{64}$/i.test(keyText)) {
    throw new Error('MFA_ENCRYPTION_KEY must be configured as 64 hexadecimal characters before using MFA.');
  }
  const [ivHex, tagHex, encryptedHex] = value.split('.');
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Stored MFA secret is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyText, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};

export const createTotpUri = (secret, email) => {
  const label = encodeURIComponent(`EventPilot:${email}`);
  const issuer = encodeURIComponent('EventPilot');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
};

export const generateRecoveryCodes = () => Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
export const hashRecoveryCode = (code) => crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
export const createOpaqueToken = () => crypto.randomBytes(32).toString('hex');
export const hashOpaqueToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
