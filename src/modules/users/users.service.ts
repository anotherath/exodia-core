import { flatten, Injectable } from '@nestjs/common';
import { ISignKeyInfo } from 'src/shared/types/input.type';
import { verifySignature } from 'src/shared/utils/sign.util';

@Injectable()
export class UsersService {
  async activeUser(signKeyInfo: ISignKeyInfo): Promise<boolean> {
    const verify = await verifySignature(signKeyInfo);

    if (!verify) {
      console.log('loi veryfi chu ky');
      return false;
    }

    return true;
  }
}
