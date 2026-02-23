import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * OKX candle format: [ts, o, h, l, c, vol, volUsd, confirm]
 * - confirm: '0' = đang chạy (unclosed), '1' = đã đóng (closed)
 */
export type OkxCandle = [
  string, // ts
  string, // o
  string, // h
  string, // l
  string, // c
  string, // vol
  string, // volUsd
  string, // confirm
];

@Injectable()
export class MarketHistoryCacheRepository {
  private readonly logger = new Logger(MarketHistoryCacheRepository.name);

  /** TTL mặc định cho mỗi ZSET key: 24 giờ */
  private readonly TTL_SECONDS = 24 * 60 * 60;

  /** Giới hạn số nến tối đa trong 1 ZSET để tránh tràn bộ nhớ */
  private readonly MAX_CANDLES_PER_SET = 10_000;

  /** Thời gian giữ lock chống stampede (ms) */
  private readonly LOCK_TTL_MS = 5_000;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ────────────────────────────────────────
  // Key builders
  // ────────────────────────────────────────

  private getKey(instId: string, bar: string): string {
    return `market:candles:history:${instId}:${bar}`;
  }

  private getLockKey(instId: string, bar: string): string {
    return `lock:candles:${instId}:${bar}`;
  }

  // ────────────────────────────────────────
  // Core: Đọc nến từ cache
  // ────────────────────────────────────────

  /**
   * Lấy `limit` nến đã đóng từ Redis ZSET.
   * - Nếu có `before`: lấy các nến có timestamp < before.
   * - Nếu không có `before`: lấy các nến mới nhất.
   *
   * @returns Mảng candle (dạng string JSON), hoặc mảng rỗng nếu không có dữ liệu.
   */
  async getCandles(
    instId: string,
    bar: string,
    limit: number,
    before?: string,
  ): Promise<OkxCandle[]> {
    const key = this.getKey(instId, bar);

    const maxScore = before ? `(${before}` : '+inf';

    const results = await this.redis.zrevrangebyscore(
      key,
      maxScore,
      '-inf',
      'LIMIT',
      0,
      limit,
    );

    if (results.length > 0) {
      // Gia hạn TTL mỗi khi có truy cập
      await this.redis.expire(key, this.TTL_SECONDS);
    }

    return results.map((r) => JSON.parse(r) as OkxCandle);
  }

  // ────────────────────────────────────────
  // Core: Ghi nến vào cache
  // ────────────────────────────────────────

  /**
   * Lưu danh sách nến đã đóng vào Redis ZSET.
   * - Sử dụng timestamp (phần tử đầu tiên) làm score.
   * - ZADD tự động bỏ qua nến đã tồn tại (không trùng lặp).
   * - Sau khi thêm, cắt bớt nến cũ nếu vượt quá MAX_CANDLES_PER_SET.
   */
  async addCandles(
    instId: string,
    bar: string,
    candles: OkxCandle[],
  ): Promise<void> {
    if (candles.length === 0) return;

    const key = this.getKey(instId, bar);

    // Chuẩn bị dữ liệu cho ZADD: [score1, member1, score2, member2, ...]
    const args: (string | number)[] = [];
    for (const candle of candles) {
      const timestamp = Number(candle[0]);
      const member = JSON.stringify(candle);
      args.push(timestamp, member);
    }

    // ZADD: thêm nến mới, bỏ qua nến đã có (vì member chứa timestamp → luôn unique)
    await this.redis.zadd(key, ...args);

    // Cắt bớt nến cũ nếu vượt quá giới hạn (giữ lại MAX_CANDLES_PER_SET nến mới nhất)
    const totalCandles = await this.redis.zcard(key);
    if (totalCandles > this.MAX_CANDLES_PER_SET) {
      await this.redis.zremrangebyrank(
        key,
        0,
        totalCandles - this.MAX_CANDLES_PER_SET - 1,
      );
    }

    // Đặt/gia hạn TTL
    await this.redis.expire(key, this.TTL_SECONDS);
  }

  // ────────────────────────────────────────
  // Distributed Lock: Chống stampede
  // ────────────────────────────────────────

  /**
   * Cố gắng lấy lock cho một cặp instId+bar.
   * Chỉ 1 request được phép gọi API OKX tại cùng 1 thời điểm.
   *
   * @returns `true` nếu lấy được lock, `false` nếu đã có request khác đang giữ lock.
   */
  async acquireLock(instId: string, bar: string): Promise<boolean> {
    const lockKey = this.getLockKey(instId, bar);
    const result = await this.redis.set(
      lockKey,
      '1',
      'PX',
      this.LOCK_TTL_MS,
      'NX',
    );
    return result === 'OK';
  }

  /**
   * Giải phóng lock sau khi đã ghi cache xong.
   */
  async releaseLock(instId: string, bar: string): Promise<void> {
    const lockKey = this.getLockKey(instId, bar);
    await this.redis.del(lockKey);
  }
}
