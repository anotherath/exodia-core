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

  // ────────────────────────────────────────
  // Realtime Ticker Validation
  // ────────────────────────────────────────

  /**
   * Validate toàn bộ ticker data trước khi cập nhật cache và emit cho client.
   * Trả về true nếu dữ liệu hợp lệ, false nếu cần drop.
   */
  validateTickerData(ticker: { bidPx: string; askPx: string; last: string }): {
    valid: boolean;
    reason?: string;
  } {
    // 1. Kiểm tra bid và ask (bắt buộc phải là số >= 0)
    if (!this.isValidBidAsk(ticker.bidPx)) {
      return { valid: false, reason: `bidPx không hợp lệ: ${ticker.bidPx}` };
    }
    if (!this.isValidBidAsk(ticker.askPx)) {
      return { valid: false, reason: `askPx không hợp lệ: ${ticker.askPx}` };
    }

    // 2. Kiểm tra last (cho phép null/undefined/0 = chưa có giao dịch)
    if (!this.isValidLastPrice(ticker.last)) {
      return {
        valid: false,
        reason: `last price không hợp lệ: ${ticker.last}`,
      };
    }

    // 3. Kiểm tra Spread (bid < ask khi cả hai > 0)
    if (!this.isSpreadValid(ticker.bidPx, ticker.askPx)) {
      return {
        valid: false,
        reason: `Crossed book detected: bid=${ticker.bidPx} >= ask=${ticker.askPx}`,
      };
    }

    return { valid: true };
  }

  /**
   * Kiểm tra giá bid/ask hợp lệ.
   * Bid và Ask phải là số valid >= 0.
   * Giá trị 0 = sổ lệnh trống một bên → hợp lệ.
   */
  isValidBidAsk(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }

  /**
   * Kiểm tra last price hợp lệ.
   * Cho phép null, undefined, '0', hoặc 0 → đại diện "chưa có giao dịch nào".
   * Chỉ reject nếu giá trị là NaN hoặc âm.
   */
  isValidLastPrice(value: any): boolean {
    // null / undefined / rỗng → chưa có giao dịch → chấp nhận
    if (value === null || value === undefined || value === '') {
      return true;
    }
    const num = Number(value);
    return !isNaN(num) && isFinite(num) && num >= 0;
  }

  /**
   * Kiểm tra spread hợp lệ.
   * Nếu cả bid > 0 và ask > 0 thì bid phải < ask.
   * Nếu một trong hai = 0 (sổ lệnh trống) → bỏ qua kiểm tra.
   */
  isSpreadValid(bidPx: any, askPx: any): boolean {
    const bid = Number(bidPx);
    const ask = Number(askPx);

    // Chỉ kiểm tra khi cả hai đều > 0
    if (bid > 0 && ask > 0) {
      return bid < ask;
    }

    return true;
  }
}
