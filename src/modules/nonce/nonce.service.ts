import { Injectable, BadRequestException } from '@nestjs/common';
import { NonceRepository } from 'src/repositories/cache/nonce.cache';
import type { HexString } from 'src/shared/types/web3.type';
import { verifyTypedDataSignature } from 'src/shared/utils/eip712.util';

@Injectable()
export class NonceService {
  constructor(private readonly nonceRepo: NonceRepository) {}

  async getNonce(walletAddress: HexString): Promise<string> {
    const nonceInfo = await this.nonceRepo.findValid(walletAddress);

    if (nonceInfo) return nonceInfo.nonce;

    const newNonce = await this.nonceRepo.upsert(walletAddress);
    return newNonce.nonce;
  }

  /**
   * Xác thực chữ ký EIP-712, kiểm tra nonce và tiêu thụ nonce nếu hợp lệ.
   * Dùng chung cho User Activation và Position Management.
   */
  async verifyAndConsume(params: {
    walletAddress: HexString;
    nonce: string;
    signature: HexString;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<void> {
    const { walletAddress, nonce, signature, types, primaryType, message } =
      params;

    // 1. Kiểm tra nonce hợp lệ trong Cache
    const nonceInfo = await this.nonceRepo.findValid(walletAddress);
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

    // 3. Xóa nonce sau khi verify thành công (tránh replay attack)
    await this.nonceRepo.delete(walletAddress);
  }
}
