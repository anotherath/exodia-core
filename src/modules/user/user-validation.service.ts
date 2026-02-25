import { Injectable, BadRequestException } from '@nestjs/common';
import { isAddress } from 'viem';
import { HexString } from 'src/shared/types/web3.type';

@Injectable()
export class UserValidationService {
  /**
   * Validate địa chỉ ví (Ethereum address)
   */
  validateWalletAddress(walletAddress: string): HexString {
    if (!walletAddress) {
      throw new BadRequestException('Địa chỉ ví không được để trống');
    }

    if (!isAddress(walletAddress)) {
      throw new BadRequestException('Địa chỉ ví không hợp lệ');
    }

    return walletAddress.toLowerCase() as HexString;
  }

  /**
   * Validate chữ ký (Signature hex)
   */
  validateSignature(signature: string): HexString {
    if (!signature) {
      throw new BadRequestException('Chữ ký không được để trống');
    }

    if (!signature.startsWith('0x') || signature.length < 130) {
      throw new BadRequestException('Chữ ký không đúng định dạng hex');
    }

    return signature as HexString;
  }

  /**
   * Validate dữ liệu kích hoạt người dùng (ActivateUserValue)
   */
  validateActivateData(data: {
    walletAddress: string;
    nonce: string;
    timestamp: string;
  }) {
    this.validateWalletAddress(data.walletAddress);

    if (!data.nonce || typeof data.nonce !== 'string') {
      throw new BadRequestException('Nonce không được để trống');
    }

    if (!data.timestamp || isNaN(Date.parse(data.timestamp))) {
      throw new BadRequestException('Timestamp không hợp lệ');
    }

    // Kiểm tra timestamp không được quá cũ (ví dụ: > 5 phút)
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = Date.now();
    const ts = new Date(data.timestamp).getTime();

    if (Math.abs(now - ts) > FIVE_MINUTES) {
      throw new BadRequestException(
        'Yêu cầu đã hết hạn (timestamp quá xa hiện tại)',
      );
    }
  }
}
