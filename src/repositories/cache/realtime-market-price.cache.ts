import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TickerData } from 'src/shared/types/okx.type';

@Injectable()
export class RealtimeMarketPriceRepository {
  private readonly KEY_PREFIX = 'market:price:';

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Update the cache with new ticker data in Redis and publish to Pub/Sub.
   */
  async update(ticker: TickerData) {
    const key = `${this.KEY_PREFIX}${ticker.instId}`;
    const data = JSON.stringify(ticker);
    await this.redis.set(key, data);
    await this.redis.publish('market:prices', data);
  }

  /**
   * Get the full ticker data for a symbol from Redis.
   */
  async get(instId: string): Promise<TickerData | undefined> {
    const key = `${this.KEY_PREFIX}${instId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  /**
   * Helper to get the best Bid price as a number.
   */
  async getBidPrice(instId: string): Promise<number> {
    const ticker = await this.get(instId);
    return ticker ? parseFloat(ticker.bidPx) : 0;
  }

  /**
   * Helper to get the best Ask price as a number.
   */
  async getAskPrice(instId: string): Promise<number> {
    const ticker = await this.get(instId);
    return ticker ? parseFloat(ticker.askPx) : 0;
  }

  /**
   * Get all cached instrument IDs (uses SCAN to avoid blocking).
   */
  async getAllSymbols(): Promise<string[]> {
    const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
    return keys.map((key) => key.replace(this.KEY_PREFIX, ''));
  }
}
