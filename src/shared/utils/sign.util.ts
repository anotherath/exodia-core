import { ISignKeyInfo } from '../types/input.type';
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

// export function veryfiMessage(SignKeyInfo: ISignKeyInfo): boolean {
//   const parsed = JSON.parse(SignKeyInfo.message);

//   if (parsed.action !== 'ACTIVATE_TRADING_ACCOUNT') return false;

//   if (parsed.walletAddress !== SignKeyInfo.walletAddress) return false;

//   if (parsed.nonce !== 0) return false;

//   if (parsed.issuedAt !== 1706500000000) return false;

//   return true;
// }
