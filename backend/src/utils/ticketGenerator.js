import crypto from 'crypto';

export const generateTicketCode = (category = 'EVENT') => {
  const prefix = (category || 'EVENT').toUpperCase().slice(0, 4);
  const randomPart1 = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars
  const randomPart2 = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 chars
  return `EP-${prefix}-${randomPart1}-${randomPart2}`;
};
