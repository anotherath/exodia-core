import { randomBytes } from 'crypto';

export function generateNonce(length = 16): string {
  return randomBytes(length).toString('hex');
}
