import { flatten, Injectable } from '@nestjs/common';
import { ISignKeyInfo } from 'src/shared/types/input.type';
import { verifySignature } from 'src/shared/utils/sign.util';

@Injectable()
export class UsersService {
  activeUser(signKeyInfo: ISignKeyInfo) {
    // if (!veryfiMessage(signKeyInfo)) {
    //   console.log('loi veryfi message');
    //   return false;
    // }

    if (!verifySignature(signKeyInfo)) {
      console.log('loi veryfi chu ky');
      return false;
    }

    return true;
  }
}
