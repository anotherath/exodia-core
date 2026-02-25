import { BadRequestException } from '@nestjs/common';
import { WalletValidationService } from '../wallet-validation.service';

describe('WalletValidationService', () => {
  let service: WalletValidationService;

  beforeEach(() => {
    service = new WalletValidationService();
  });

  describe('validateWalletAddress', () => {
    it('should throw for empty address', () => {
      expect(() => service.validateWalletAddress('')).toThrow(
        BadRequestException,
      );
    });

    it('should throw for invalid address', () => {
      expect(() => service.validateWalletAddress('0x123')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateWalletAddress('not-an-address')).toThrow(
        BadRequestException,
      );
    });

    it('should pass and return lowercase for valid address', () => {
      const addr = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
      expect(service.validateWalletAddress(addr)).toBe(addr.toLowerCase());
    });
  });

  describe('validateChainId', () => {
    it('should throw for invalid chainId', () => {
      expect(() => service.validateChainId(0)).toThrow(BadRequestException);
      expect(() => service.validateChainId(-1)).toThrow(BadRequestException);
      expect(() => service.validateChainId('abc')).toThrow(BadRequestException);
      expect(() => service.validateChainId(NaN)).toThrow(BadRequestException);
    });

    it('should return number for valid chainId', () => {
      expect(service.validateChainId(1)).toBe(1);
      expect(service.validateChainId('137')).toBe(137);
    });
  });

  describe('validateAmount', () => {
    it('should throw for non-positive amounts', () => {
      expect(() => service.validateAmount(0)).toThrow(BadRequestException);
      expect(() => service.validateAmount(-100)).toThrow(BadRequestException);
    });

    it('should return number for valid amount', () => {
      expect(service.validateAmount(10.5)).toBe(10.5);
      expect(service.validateAmount('100')).toBe(100);
    });
  });

  describe('validateTransaction', () => {
    it('should pass for valid data', () => {
      expect(() =>
        service.validateTransaction({
          walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
          chainId: 1,
          amount: 100,
        }),
      ).not.toThrow();
    });

    it('should throw if any field is invalid', () => {
      expect(() =>
        service.validateTransaction({
          walletAddress: 'invalid',
          chainId: 1,
          amount: 100,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
