import { NonceInfo } from 'src/shared/types/web3.type';
import { NonceModel } from './models/nonce.model';
import { generateNonce } from 'src/shared/utils/web3.util';

export class NonceRepository {
  private readonly EXPIRE_MS = 2 * 60 * 1000; // 2 phút

  // tạo nonce info
  buildNonceInfo(walletAddress: string): NonceInfo {
    return {
      walletAddress,
      nonce: generateNonce(),
      expiresAt: new Date(Date.now() + this.EXPIRE_MS),
    };
  }

  // up nonce info lên db
  async upsert(walletAddress: string): Promise<NonceInfo> {
    const nonceInfo = this.buildNonceInfo(walletAddress);

    await NonceModel.updateOne(
      { walletAddress },
      { $set: nonceInfo },
      { upsert: true },
    );

    return nonceInfo;
  }

  // tìm nonce info trong db
  async findValid(walletAddress: string): Promise<NonceInfo | null> {
    return NonceModel.findOne({
      walletAddress,
      expiresAt: { $gt: new Date() },
    });
  }

  // xóa nonce info khoi db
  async delete(walletAddress: string) {
    return NonceModel.deleteOne({ walletAddress });
  }
}
