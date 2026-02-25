import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class PairValidationService {
  /**
   * Validate thông tin khi tạo hoặc cập nhật cặp giao dịch (upsert)
   */
  validateUpsertData(data: {
    instId: string;
    maxLeverage: number;
    minVolume: number;
    minAmount: number;
    openFeeRate: number;
    closeFeeRate: number;
  }) {
    this.validateInstId(data.instId);
    this.validatePositive('maxLeverage', data.maxLeverage);
    this.validatePositive('minVolume', data.minVolume);
    this.validatePositive('minAmount', data.minAmount);
    this.validateFeeRate('openFeeRate', data.openFeeRate);
    this.validateFeeRate('closeFeeRate', data.closeFeeRate);
  }

  /**
   * Validate định dạng instId (VD: BTC-USDT)
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
   * Validate giá trị số dương
   */
  validatePositive(fieldName: string, value: number) {
    const num = this.sanitizeNumber(value);
    if (num <= 0) {
      throw new BadRequestException(`${fieldName} phải là số dương lớn hơn 0`);
    }
    return num;
  }

  /**
   * Validate phí giao dịch (thường < 10%)
   */
  validateFeeRate(fieldName: string, value: number) {
    const num = this.sanitizeNumber(value);
    if (num < 0 || num > 0.1) {
      throw new BadRequestException(
        `${fieldName} phải nằm trong khoảng từ 0 đến 0.1 (0% - 10%)`,
      );
    }
    return num;
  }

  /**
   * Chuyển đổi và kiểm tra giá trị số hợp lệ
   */
  private sanitizeNumber(value: unknown): number {
    if (value === null || value === undefined) {
      throw new BadRequestException('Giá trị số không được để trống');
    }
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      throw new BadRequestException('Giá trị không phải là số hợp lệ');
    }
    return num;
  }
}
