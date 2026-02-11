import { randomBytes } from 'crypto';

export function generateNonce(length = 16): string {
  return randomBytes(length).toString('hex');
}

export const isHexString = (v: string) => /^0x[a-fA-F0-9]+$/.test(v);
