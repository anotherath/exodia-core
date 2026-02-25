import { Injectable, BadRequestException } from '@nestjs/common';
import { NonceRepository } from 'src/repositories/cache/nonce.cache';
import { UserRepository } from 'src/repositories/user/user.repository';
import type { HexString } from 'src/shared/types/web3.type';
import {
  ActivateUserTypes,
  type ActivateUserValue,
} from 'src/shared/types/eip712.type';
import { verifyTypedDataSignature } from 'src/shared/utils/eip712.util';
import { UserValidationService } from './user-validation.service';

@Injectable()
export class UserService {
  constructor(
    private readonly nonceRepo: NonceRepository,
    private readonly userRepo: UserRepository,
    private readonly userValidation: UserValidationService,
  ) {}

  // kích hoạt người dùng (Login via EIP-712)
  async activeUser(
    typedData: ActivateUserValue,
    signature: HexString,
  ): Promise<boolean> {
    try {
      this.userValidation.validateActivateData(typedData as any);
      this.userValidation.validateSignature(signature);

      const walletAddress = typedData.walletAddress as HexString;

      // 1. Kiểm tra nonce hợp lệ trong DB
      const nonceInfo = await this.nonceRepo.findValid(walletAddress);
      if (!nonceInfo || nonceInfo.nonce !== typedData.nonce) {
        throw new BadRequestException('Nonce không hợp lệ hoặc đã hết hạn');
      }

      // 2. Verify chữ ký EIP-712
      const isValid = await verifyTypedDataSignature({
        walletAddress,
        signature,
        types: ActivateUserTypes,
        primaryType: 'ActivateUser',
        message: typedData as unknown as Record<string, unknown>,
      });

      if (!isValid) {
        throw new BadRequestException('Chữ ký không hợp lệ');
      }

      // 3. Xóa nonce sau khi verify thành công
      await this.nonceRepo.delete(walletAddress);

      // 4. Nếu xác thực thành công, kích hoạt user
      await this.userRepo.upsert(walletAddress, {
        isActive: true,
      });

      return true;
    } catch (error) {
      console.error('Active user failed:', error.message);
      return false;
    }
  }

  // kiểm tra xem người dùng active hay chưa
  async isActiveUser(walletAddress: HexString): Promise<boolean> {
    const validatedAddress =
      this.userValidation.validateWalletAddress(walletAddress);

    const user = await this.userRepo.findByWallet(validatedAddress);

    // chưa tồn tại hoặc bị soft delete → chưa active
    if (!user) return false;

    return user.isActive === true;
  }
}
