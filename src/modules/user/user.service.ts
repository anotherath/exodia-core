import { Injectable } from '@nestjs/common';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import type { HexString } from 'src/shared/types/web3.type';
import {
  ActivateUserTypes,
  type ActivateUserValue,
} from 'src/shared/types/eip712.type';
import { verifyAndConsumeNonce } from 'src/shared/utils/eip712.util';

@Injectable()
export class UserService {
  constructor(
    private readonly nonceRepo: NonceRepository,
    private readonly userRepo: UserRepository,
  ) {}

  // kích hoạt người dùng (Login via EIP-712)
  async activeUser(
    typedData: ActivateUserValue,
    signature: HexString,
  ): Promise<boolean> {
    try {
      // Xác thực nonce và chữ ký EIP-712
      // Hàm này sẽ throw BadRequestException nếu sai nonce hoặc sai chữ ký
      await verifyAndConsumeNonce(this.nonceRepo, {
        walletAddress: typedData.walletAddress as HexString,
        nonce: typedData.nonce,
        signature,
        types: ActivateUserTypes,
        primaryType: 'ActivateUser',
        message: typedData as unknown as Record<string, unknown>,
      });

      // Nếu xác thực thành công, kích hoạt user
      await this.userRepo.upsert(typedData.walletAddress, {
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
    const user = await this.userRepo.findByWallet(walletAddress);

    // chưa tồn tại hoặc bị soft delete → chưa active
    if (!user) return false;

    return user.isActive === true;
  }
}
