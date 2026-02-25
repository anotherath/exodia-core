import { BadRequestException } from '@nestjs/common';
import { MarketValidationService } from '../market-validation.service';

describe('MarketValidationService', () => {
  let service: MarketValidationService;

  beforeEach(() => {
    service = new MarketValidationService();
  });

  describe('validateInstId', () => {
    it('should throw for empty instId', () => {
      expect(() => service.validateInstId('')).toThrow(BadRequestException);
    });

    it('should throw for invalid format', () => {
      expect(() => service.validateInstId('BTCUSDT')).toThrow(
        BadRequestException,
      );
    });

    it('should pass for valid format', () => {
      expect(() => service.validateInstId('BTC-USDT')).not.toThrow();
    });
  });

  describe('validateBar', () => {
    it('should throw for unsupported bar', () => {
      expect(() => service.validateBar('2m')).toThrow(BadRequestException);
    });

    it('should pass for supported bars', () => {
      expect(() => service.validateBar('1m')).not.toThrow();
      expect(() => service.validateBar('1D')).not.toThrow();
    });
  });

  describe('validateLimit', () => {
    it('should throw for invalid limit', () => {
      expect(() => service.validateLimit(0)).toThrow(BadRequestException);
      expect(() => service.validateLimit(101)).toThrow(BadRequestException);
      expect(() => service.validateLimit('abc')).toThrow(BadRequestException);
    });

    it('should pass for valid limit', () => {
      expect(service.validateLimit(100)).toBe(100);
      expect(service.validateLimit('50')).toBe(50);
    });
  });

  describe('validateBefore', () => {
    it('should throw for invalid timestamp', () => {
      expect(() => service.validateBefore('abc')).toThrow(BadRequestException);
      expect(() => service.validateBefore('-100')).toThrow(BadRequestException);
    });

    it('should pass for valid timestamp string', () => {
      expect(() => service.validateBefore('1700000000000')).not.toThrow();
    });
  });

  describe('validateCandleParams', () => {
    it('should pass for valid params', () => {
      expect(() =>
        service.validateCandleParams({
          instId: 'BTC-USDT',
          bar: '1h',
          limit: 100,
        }),
      ).not.toThrow();
    });

    it('should throw if any param is invalid', () => {
      expect(() =>
        service.validateCandleParams({
          instId: 'BTC-USDT',
          bar: 'invalid',
          limit: 100,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
