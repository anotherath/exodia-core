import { Injectable, BadRequestException } from '@nestjs/common';
import { NonceService } from 'src/modules/nonce/nonce.service';
import { UserRepository } from 'src/repositories/user/user.repository';
import type { HexString } from 'src/shared/types/web3.type';
import {
  ActivateUserTypes,
  type ActivateUserValue,
} from 'src/shared/types/eip712.type';
import { UserValidationService } from './user-validation.service';

@Injectable()
export class UserService {
  constructor(
    private readonly nonceService: NonceService,
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

      // Unify EIP-712 Verify and Nonce Consumption
      await this.nonceService.verifyAndConsume({
        walletAddress,
        nonce: typedData.nonce,
        signature,
        types: ActivateUserTypes,
        primaryType: 'ActivateUser',
        message: typedData as unknown as Record<string, unknown>,
      });

      // Nếu xác thực thành công, kích hoạt user
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
