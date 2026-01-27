import { ethers } from 'ethers';
import { ISignKeyInfo } from '../types/input.type';

export function verifySignature(SignKeyInfo: ISignKeyInfo): boolean {
  const { walletAddress, signature, message } = SignKeyInfo;

  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);

    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (err) {
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
