import { Injectable, Logger } from '@nestjs/common';
import { OkxRest } from 'src/infra/okx/okx.rest';
import {
  MarketHistoryCacheRepository,
  OkxCandle,
} from 'src/repositories/cache/market-history.cache';
import { MarketValidationService } from './market-validation.service';

/** Thời gian chờ tối đa khi bị block bởi lock (ms) */
const LOCK_WAIT_MS = 300;

/** Số lần retry tối đa khi chờ lock */
const LOCK_MAX_RETRIES = 3;

/** Mapping từ bar → duration (ms) của 1 cây nến */
const BAR_DURATION_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1D': 24 * 60 * 60_000,
  '1W': 7 * 24 * 60 * 60_000,
  '1M': 30 * 24 * 60 * 60_000,
};

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    private readonly okxRest: OkxRest,
    private readonly cacheRepo: MarketHistoryCacheRepository,
    private readonly marketValidation: MarketValidationService,
  ) {}

  async getCandles(params: {
    instId: string;
    bar: string;
    limit: number;
    before?: string;
  }) {
    this.marketValidation.validateCandleParams(params);
    const { instId, bar, limit, before } = params;

    // ── Bước 1: Kiểm tra cache ──
    const cached = await this.cacheRepo.getCandles(instId, bar, limit, before);

    if (cached.length >= limit) {
      this.logger.debug(
        `Cache HIT: ${instId}:${bar} (${cached.length} candles)`,
      );
      return cached;
    }

    // ── Bước 2: Cache miss → Cố gắng lấy lock ──
    const lockAcquired = await this.cacheRepo.acquireLock(instId, bar);

    if (!lockAcquired) {
      // Có request khác đang gọi OKX → chờ rồi đọc lại cache
      this.logger.debug(
        `Lock BLOCKED: ${instId}:${bar}, waiting for other request...`,
      );
      return this.waitAndRetryFromCache(instId, bar, limit, before);
    }

    try {
      // ── Bước 3: Gọi API OKX ──
      this.logger.debug(`Cache MISS: ${instId}:${bar}, fetching from OKX...`);
      const rawCandles = await this.fetchFromOkx(instId, bar, limit, before);

      // ── Bước 4: Lọc nến chưa đóng ──
      const closedCandles = this.filterClosedCandles(rawCandles, bar);

      // ── Bước 5: Lưu vào cache (Self-healing) ──
      await this.cacheRepo.addCandles(instId, bar, closedCandles);

      return closedCandles;
    } finally {
      // ── Luôn giải phóng lock ──
      await this.cacheRepo.releaseLock(instId, bar);
    }
  }

  // ────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────

  /**
   * Gọi API OKX để lấy nến. Phân biệt giữa nến mới nhất và nến lịch sử.
   */
  private async fetchFromOkx(
    instId: string,
    bar: string,
    limit: number,
    before?: string,
  ): Promise<OkxCandle[]> {
    if (before) {
      const res = await this.okxRest.getHistoryCandles(
        instId,
        bar,
        before,
        limit,
      );
      return res.data?.data ?? [];
    }

    const res = await this.okxRest.getCandles(instId, bar, limit);
    return res.data?.data ?? [];
  }

  /**
   * Lọc bỏ nến chưa đóng (confirm !== '1').
   * Nếu OKX không trả về trường confirm, dùng timestamp + bar duration để kiểm tra.
   */
  private filterClosedCandles(candles: OkxCandle[], bar: string): OkxCandle[] {
    const barDuration = BAR_DURATION_MS[bar] ?? 60_000;
    const now = Date.now();

    return candles.filter((candle) => {
      // Ưu tiên dùng trường confirm (index 7)
      if (candle[7] !== undefined) {
        return candle[7] === '1';
      }

      // Fallback: nến đã đóng nếu ts + duration <= now
      const candleEnd = Number(candle[0]) + barDuration;
      return candleEnd <= now;
    });
  }

  /**
   * Chờ một khoảng thời gian rồi đọc lại cache.
   * Dùng khi một request khác đang giữ lock và gọi OKX.
   */
  private async waitAndRetryFromCache(
    instId: string,
    bar: string,
    limit: number,
    before?: string,
  ): Promise<OkxCandle[]> {
    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      await this.sleep(LOCK_WAIT_MS);
      const cached = await this.cacheRepo.getCandles(
        instId,
        bar,
        limit,
        before,
      );
      if (cached.length > 0) {
        this.logger.debug(
          `Retry ${i + 1}: Cache HIT after waiting (${cached.length} candles)`,
        );
        return cached;
      }
    }

    // Nếu vẫn không có sau khi retry → gọi trực tiếp OKX (fallback an toàn)
    this.logger.warn(
      `Retry exhausted for ${instId}:${bar}, falling back to OKX API`,
    );
    const rawCandles = await this.fetchFromOkx(instId, bar, limit, before);
    return this.filterClosedCandles(rawCandles, bar);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
