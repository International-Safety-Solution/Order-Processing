import crypto from 'crypto';

/**
 * Enterprise Secure Password Hashing using Node.js Built-in Scrypt (Zero external dependencies)
 */

export function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `$scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;

  // Modern scrypt hash verification
  if (storedPassword.startsWith('$scrypt$')) {
    const parts = storedPassword.split('$');
    if (parts.length !== 4) return false;
    const salt = parts[2];
    const originalHash = parts[3];

    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const originalBuffer = Buffer.from(originalHash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (originalBuffer.length !== computedBuffer.length) return false;
    return crypto.timingSafeEqual(originalBuffer, computedBuffer);
  }

  // Legacy plain text fallback (for backward compatibility)
  return password === storedPassword;
}

export function needsRehash(storedPassword) {
  return !storedPassword || !storedPassword.startsWith('$scrypt$');
}

