import { flatten, Injectable } from '@nestjs/common';
import { NonceRepository } from 'src/repositories/nonce.repository';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';
import { generateNonce } from 'src/shared/utils/web3.util';
import { verifySignature } from 'src/shared/utils/web3.util';

@Injectable()
export class UsersService {
  constructor(private readonly nonceRepo: NonceRepository) {}

  async activeUser(signKeyInfo: ISignKeyInfo): Promise<boolean> {
    const verify = await verifySignature(signKeyInfo);

    // check message, tai day bao gom ca checl nounce

    if (!verify) {
      console.log('loi veryfi chu ky');
      return false;
    }

    // add nguoi dung vao db
    // xoa nounce

    return true;
  }

  isActiveUser(walletAddress: HexString): boolean {
    let isActive: boolean = true;

    //viet them logic check trong db tai day

    return isActive;
  }

  async getNonce(walletAddress: HexString): Promise<string | null> {
    const nonceInfo = await this.nonceRepo.findValid(walletAddress);

    if (nonceInfo) return nonceInfo.nonce;

    const newNonce = await this.nonceRepo.upsert(walletAddress);
    return newNonce.nonce;
  }
}
