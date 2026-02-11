import { NonceInfo } from 'src/shared/types/nonce.type';
import { NonceModel } from './nonce.model';
import { generateNonce } from 'src/shared/utils/web3.util';

export class NonceRepository {
  private readonly EXPIRE_MS = 2 * 60 * 1000; // 2 phút

  // tạo nonce info
  buildNonceInfo(walletAddress: string): NonceInfo {
    return {
      walletAddress: walletAddress.toLowerCase(),
      nonce: generateNonce(),
      expiresAt: new Date(Date.now() + this.EXPIRE_MS),
    };
  }

  // tạo hoặc ghi đè nonce (1 wallet chỉ có 1 nonce hợp lệ)
  async upsert(walletAddress: string): Promise<NonceInfo> {
    const nonceInfo = this.buildNonceInfo(walletAddress);

    await NonceModel.updateOne(
      { walletAddress: nonceInfo.walletAddress },
      { $set: nonceInfo },
      { upsert: true },
    );

    return nonceInfo;
  }

  // tìm nonce còn hiệu lực
  async findValid(walletAddress: string): Promise<NonceInfo | null> {
    return NonceModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
      expiresAt: { $gt: new Date() },
    }).lean();
  }

  // xóa nonce sau khi dùng
  async delete(walletAddress: string): Promise<void> {
    await NonceModel.deleteOne({
      walletAddress: walletAddress.toLowerCase(),
    });
  }
}
