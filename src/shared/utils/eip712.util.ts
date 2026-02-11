import { recoverTypedDataAddress } from 'viem';
import { EIP712_DOMAIN } from '../types/eip712.type';
import type { HexString } from '../types/web3.type';

/**
 * Verify EIP-712 typed data signature.
 * Recovers the signer address and compares with the expected wallet address.
 */
export async function verifyTypedDataSignature(params: {
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
  signature: HexString;
  walletAddress: HexString;
}): Promise<boolean> {
  const { types, primaryType, message, signature, walletAddress } = params;

  try {
    const recoveredAddress = await recoverTypedDataAddress({
      domain: EIP712_DOMAIN,
      types,
      primaryType,
      message,
      signature,
    });

    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}
