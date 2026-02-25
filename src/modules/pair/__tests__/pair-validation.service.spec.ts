import { BadRequestException } from '@nestjs/common';
import { PairValidationService } from '../pair-validation.service';

describe('PairValidationService', () => {
  let service: PairValidationService;

  beforeEach(() => {
    service = new PairValidationService();
  });

  describe('validateInstId', () => {
    it('should throw BadRequestException for empty instId', () => {
      expect(() => service.validateInstId('')).toThrow(BadRequestException);
      expect(() => service.validateInstId(null as any)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid format', () => {
      expect(() => service.validateInstId('BTCUSDT')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateInstId('BTC-USDT-PERP')).toThrow(
        BadRequestException,
      );
    });

    it('should pass for valid format', () => {
      expect(() => service.validateInstId('BTC-USDT')).not.toThrow();
    });
  });

  describe('validatePositive', () => {
    it('should throw for zero or negative values', () => {
      expect(() => service.validatePositive('test', 0)).toThrow(
        BadRequestException,
      );
      expect(() => service.validatePositive('test', -1)).toThrow(
        BadRequestException,
      );
    });

    it('should pass for positive values', () => {
      expect(service.validatePositive('test', 0.1)).toBe(0.1);
      expect(service.validatePositive('test', 100)).toBe(100);
    });

    it('should throw for non-numeric values', () => {
      expect(() => service.validatePositive('test', 'abc' as any)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateFeeRate', () => {
    it('should throw for values out of range [0, 0.1]', () => {
      expect(() => service.validateFeeRate('test', -0.0001)).toThrow(
        BadRequestException,
      );
      expect(() => service.validateFeeRate('test', 0.11)).toThrow(
        BadRequestException,
      );
    });

    it('should pass for valid fee rates', () => {
      expect(service.validateFeeRate('test', 0)).toBe(0);
      expect(service.validateFeeRate('test', 0.0001)).toBe(0.0001);
      expect(service.validateFeeRate('test', 0.1)).toBe(0.1);
    });
  });

  describe('validateUpsertData', () => {
    const validData = {
      instId: 'BTC-USDT',
      maxLeverage: 100,
      minVolume: 0.001,
      minAmount: 10,
      openFeeRate: 0.0001,
      closeFeeRate: 0.0001,
    };

    it('should pass for valid data', () => {
      expect(() => service.validateUpsertData(validData)).not.toThrow();
    });

    it('should throw if any field is invalid', () => {
      expect(() =>
        service.validateUpsertData({ ...validData, maxLeverage: -1 }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.validateUpsertData({ ...validData, instId: 'BTCUSDT' }),
      ).toThrow(BadRequestException);
    });
  });
});
