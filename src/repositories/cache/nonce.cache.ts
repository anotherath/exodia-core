import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { NonceInfo } from 'src/shared/types/nonce.type';
import { generateNonce } from 'src/shared/utils/web3.util';

@Injectable()
export class NonceRepository {
  private readonly TTL_SECONDS = 2 * 60; // 2 phút

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private getKey(walletAddress: string): string {
    return `nonce:${walletAddress.toLowerCase()}`;
  }

  // tạo nonce info
  buildNonceInfo(walletAddress: string): NonceInfo {
    return {
      walletAddress: walletAddress.toLowerCase(),
      nonce: generateNonce(),
      expiresAt: new Date(Date.now() + this.TTL_SECONDS * 1000),
    };
  }

  // tạo hoặc ghi đè nonce (1 wallet chỉ có 1 nonce hợp lệ)
  async upsert(walletAddress: string): Promise<NonceInfo> {
    const nonceInfo = this.buildNonceInfo(walletAddress);
    const key = this.getKey(walletAddress);

    await this.redis.set(
      key,
      JSON.stringify(nonceInfo),
      'EX',
      this.TTL_SECONDS,
    );

    return nonceInfo;
  }

  // tìm nonce còn hiệu lực (Redis tự xóa khi hết TTL nên không cần check expiresAt)
  async findValid(walletAddress: string): Promise<NonceInfo | null> {
    const key = this.getKey(walletAddress);
    const data = await this.redis.get(key);

    if (!data) return null;

    return JSON.parse(data) as NonceInfo;
  }

  // xóa nonce sau khi dùng
  async delete(walletAddress: string): Promise<void> {
    const key = this.getKey(walletAddress);
    await this.redis.del(key);
  }
}
