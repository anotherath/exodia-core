import { recoverTypedDataAddress } from 'viem';
import { EIP712_DOMAIN } from '../types/eip712.type';
import type { HexString } from '../types/web3.type';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { BadRequestException } from '@nestjs/common';

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

/**
 * Verify nonce: kiểm tra nonce trong typed data khớp với nonce trong DB,
 * sau đó verify chữ ký EIP-712, cuối cùng xóa nonce đã dùng.
 */
export async function verifyAndConsumeNonce(
  nonceRepo: NonceRepository,
  params: {
    walletAddress: HexString;
    nonce: string;
    signature: HexString;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<void> {
  const { walletAddress, nonce, signature, types, primaryType, message } =
    params;

  // 1. Kiểm tra nonce hợp lệ trong DB
  const nonceInfo = await nonceRepo.findValid(walletAddress);
  if (!nonceInfo || nonceInfo.nonce !== nonce) {
    throw new BadRequestException('Nonce không hợp lệ hoặc đã hết hạn');
  }

  // 2. Verify chữ ký EIP-712
  const isValid = await verifyTypedDataSignature({
    types,
    primaryType,
    message,
    signature,
    walletAddress,
  });

  if (!isValid) {
    throw new BadRequestException('Chữ ký không hợp lệ');
  }

  // 3. Xóa nonce sau khi dùng (one-time use)
  await nonceRepo.delete(walletAddress);
}
