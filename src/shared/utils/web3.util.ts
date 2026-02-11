import { randomBytes } from 'crypto';
import { ISignKeyInfo } from '../types/web3.type';
import { recoverMessageAddress } from 'viem';

export async function verifySignature(
  signKeyInfo: ISignKeyInfo,
): Promise<boolean> {
  const { walletAddress, signature, message } = signKeyInfo;

  try {
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature,
    });

    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function generateNonce(length = 16): string {
  return randomBytes(length).toString('hex');
}

export const isHexString = (v: string) => /^0x[a-fA-F0-9]+$/.test(v);

export function extractNonceFromMessage(message: string): string | null {
  const match = message.match(/Nonce:\s*([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}
