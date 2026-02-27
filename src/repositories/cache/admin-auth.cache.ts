import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ADMIN_CONFIG } from 'src/config/admin.config';

@Injectable()
export class AdminAuthCacheRepository {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private getFailedLoginKey(username: string): string {
    return `admin:login_fails:${username}`;
  }

  /**
   * Tăng bộ đếm số lần đăng nhập sai.
   * Nếu là lần nhập sai đầu tiên, sẽ set TTL.
   * @returns Số lần nhập sai hiện tại.
   */
  async incrementFailedLogin(username: string): Promise<number> {
    const key = this.getFailedLoginKey(username);
    const fails = await this.redis.incr(key);

    if (fails === 1) {
      // Set TTL ở lần đầu tiên sai. expire tính bằng giây.
      await this.redis.expire(key, ADMIN_CONFIG.LOCKOUT_DURATION_MINUTES * 60);
    }

    return fails;
  }

  /**
   * Lấy số lần nhập sai hiện tại.
   */
  async getFailedLoginAttempts(username: string): Promise<number> {
    const key = this.getFailedLoginKey(username);
    const fails = await this.redis.get(key);
    return fails ? parseInt(fails, 10) : 0;
  }

  /**
   * Lấy thời gian TTL còn lại (tính bằng giây).
   * @returns Số giây còn lại, hoặc -2 nếu key không tồn tại.
   */
  async getLockoutRemainingTimeSeconds(username: string): Promise<number> {
    const key = this.getFailedLoginKey(username);
    return this.redis.ttl(key);
  }

  /**
   * Reset bộ đếm số lần nhập sai.
   */
  async resetFailedLogin(username: string): Promise<void> {
    const key = this.getFailedLoginKey(username);
    await this.redis.del(key);
  }
}
