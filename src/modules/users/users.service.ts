import { flatten, Injectable } from '@nestjs/common';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';
import { generateNonce } from 'src/shared/utils/nounce.util';
import { verifySignature } from 'src/shared/utils/sign.util';

@Injectable()
export class UsersService {
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

  getNonce(walletAddress: HexString): string | null {
    const nounce = null;

    //viet logic lấy nonce trong db tai day, nếu không có thì trả về false

    return nounce;
  }

  createNonce(walletAddress: HexString): string {
    const nounce = generateNonce();

    //viet them logic them so nounce vao db cung voi wallet

    return nounce;
  }
}
