import { Injectable } from '@nestjs/common';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';
import { verifySignature } from 'src/shared/utils/web3.util';

@Injectable()
export class UserService {
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
}
