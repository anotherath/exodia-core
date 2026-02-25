import { Injectable, BadRequestException } from '@nestjs/common';
import { okxConfig } from 'src/config/okx.config';

@Injectable()
export class MarketValidationService {
  /**
   * Validate thông số lấy nến (candles)
   */
  validateCandleParams(params: {
    instId: string;
    bar: string;
    limit: number;
    before?: string;
  }) {
    this.validateInstId(params.instId);
    this.validateBar(params.bar);
    this.validateLimit(params.limit);
    if (params.before) {
      this.validateBefore(params.before);
    }
  }

  /**
   * Validate instId (VD: BTC-USDT)
   */
  validateInstId(instId: string) {
    if (!instId || typeof instId !== 'string') {
      throw new BadRequestException('instId không được để trống');
    }
    const parts = instId.split('-');
    if (parts.length !== 2) {
      throw new BadRequestException(
        'instId không đúng định dạng (VD: BTC-USDT)',
      );
    }
  }

  /**
   * Validate khung nến (bar)
   */
  validateBar(bar: string) {
    if (!okxConfig.candleBars.includes(bar)) {
      throw new BadRequestException(
        `Khung nến '${bar}' không được hỗ trợ. Các khung hợp lệ: ${okxConfig.candleBars.join(', ')}`,
      );
    }
  }

  /**
   * Validate số lượng nến (limit)
   */
  validateLimit(limit: unknown) {
    const num = Number(limit);
    if (isNaN(num) || num <= 0 || num > okxConfig.maxCandlesLimit) {
      throw new BadRequestException(
        `Limit phải là số từ 1 đến ${okxConfig.maxCandlesLimit}`,
      );
    }
    return num;
  }

  /**
   * Validate timestamp (before)
   */
  validateBefore(before: string) {
    const ts = Number(before);
    if (isNaN(ts) || ts <= 0) {
      throw new BadRequestException(
        'Tham số before phải là timestamp hợp lệ (ms)',
      );
    }
  }
}
