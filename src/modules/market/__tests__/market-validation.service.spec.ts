import { BadRequestException } from '@nestjs/common';
import { MarketValidationService } from '../market-validation.service';

describe('MarketValidationService', () => {
  let service: MarketValidationService;

  beforeEach(() => {
    service = new MarketValidationService();
  });

  // ────────────────────────────────────────
  // Candle Params Validation
  // ────────────────────────────────────────

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

  // ────────────────────────────────────────
  // Realtime Ticker Validation
  // ────────────────────────────────────────

  describe('isValidBidAsk', () => {
    it('should return false for null, undefined, or empty string', () => {
      expect(service.isValidBidAsk(null)).toBe(false);
      expect(service.isValidBidAsk(undefined)).toBe(false);
      expect(service.isValidBidAsk('')).toBe(false);
    });

    it('should return false for NaN or non-numeric strings', () => {
      expect(service.isValidBidAsk('abc')).toBe(false);
      expect(service.isValidBidAsk(NaN)).toBe(false);
    });

    it('should return false for negative values', () => {
      expect(service.isValidBidAsk(-1)).toBe(false);
      expect(service.isValidBidAsk('-0.01')).toBe(false);
    });

    it('should return true for 0 (sổ lệnh trống)', () => {
      expect(service.isValidBidAsk(0)).toBe(true);
      expect(service.isValidBidAsk('0')).toBe(true);
    });

    it('should return true for positive values', () => {
      expect(service.isValidBidAsk('49999.50')).toBe(true);
      expect(service.isValidBidAsk(100)).toBe(true);
    });
  });

  describe('isValidLastPrice', () => {
    it('should return true for null, undefined, or empty string (chưa có giao dịch)', () => {
      expect(service.isValidLastPrice(null)).toBe(true);
      expect(service.isValidLastPrice(undefined)).toBe(true);
      expect(service.isValidLastPrice('')).toBe(true);
    });

    it('should return true for 0 (chưa có giao dịch)', () => {
      expect(service.isValidLastPrice(0)).toBe(true);
      expect(service.isValidLastPrice('0')).toBe(true);
    });

    it('should return true for positive values', () => {
      expect(service.isValidLastPrice('50000')).toBe(true);
      expect(service.isValidLastPrice(123.45)).toBe(true);
    });

    it('should return false for NaN or negative values', () => {
      expect(service.isValidLastPrice('NaN')).toBe(false);
      expect(service.isValidLastPrice(-100)).toBe(false);
      expect(service.isValidLastPrice('abc')).toBe(false);
    });
  });

  describe('isSpreadValid', () => {
    it('should return true when bid < ask', () => {
      expect(service.isSpreadValid('49999', '50001')).toBe(true);
    });

    it('should return false when bid >= ask (crossed book)', () => {
      expect(service.isSpreadValid('50001', '50001')).toBe(false); // bid == ask
      expect(service.isSpreadValid('50002', '50001')).toBe(false); // bid > ask
    });

    it('should return true when bid is 0 (sổ lệnh trống)', () => {
      expect(service.isSpreadValid('0', '50001')).toBe(true);
    });

    it('should return true when ask is 0 (sổ lệnh trống)', () => {
      expect(service.isSpreadValid('49999', '0')).toBe(true);
    });

    it('should return true when both are 0', () => {
      expect(service.isSpreadValid('0', '0')).toBe(true);
    });
  });

  describe('validateTickerData', () => {
    it('should pass for valid ticker data', () => {
      expect(
        service.validateTickerData({
          bidPx: '49999',
          askPx: '50001',
          last: '50000',
        }),
      ).toEqual({ valid: true });
    });

    it('should pass when last is null (chưa có giao dịch)', () => {
      expect(
        service.validateTickerData({
          bidPx: '49999',
          askPx: '50001',
          last: null as any,
        }),
      ).toEqual({ valid: true });
    });

    it('should fail for invalid bidPx', () => {
      const result = service.validateTickerData({
        bidPx: 'abc',
        askPx: '50001',
        last: '50000',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('bidPx');
    });

    it('should fail for crossed book (bid >= ask)', () => {
      const result = service.validateTickerData({
        bidPx: '50002',
        askPx: '50001',
        last: '50000',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Crossed book');
    });

    it('should fail for NaN last price', () => {
      const result = service.validateTickerData({
        bidPx: '49999',
        askPx: '50001',
        last: 'NaN',
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('last price');
    });
  });
});
