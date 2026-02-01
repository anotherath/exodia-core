import { Injectable } from '@nestjs/common';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';
import { verifySignature } from 'src/shared/utils/web3.util';

@Injectable()
export class UserService {
  constructor(
    private readonly nonceRepo: NonceRepository,
    private readonly userRepo: UserRepository,
  ) {}

  //kích hoạt người dùng
  async activeUser(signKeyInfo: ISignKeyInfo): Promise<boolean> {
    // kiểm tra số nonce
    const nonce = await this.nonceRepo.findValid(signKeyInfo.walletAddress);
    if (!nonce || nonce.nonce !== signKeyInfo.message) {
      console.log('nonce khong hop le hoac het han');
      return false;
    }

    // verify chữ ký
    const verify = await verifySignature(signKeyInfo);
    if (!verify) {
      console.log('loi verify chu ky');
      return false;
    }

    // thêm user
    await this.userRepo.upsert(signKeyInfo.walletAddress, {
      isActive: true,
    });

    // xóa nonce
    await this.nonceRepo.delete(signKeyInfo.walletAddress);
    return true;
  }

  // kiểm tra xem người dùng active hay chưa
  async isActiveUser(walletAddress: HexString): Promise<boolean> {
    const user = await this.userRepo.findByWallet(walletAddress);

    // chưa tồn tại hoặc bị soft delete → chưa active
    if (!user) return false;

    return user.isActive === true;
  }
}
