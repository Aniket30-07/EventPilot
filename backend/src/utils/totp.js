import crypto from 'node:crypto';

export const createOpaqueToken = () => crypto.randomBytes(32).toString('hex');
export const hashOpaqueToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
