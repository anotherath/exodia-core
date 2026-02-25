import { BadRequestException } from '@nestjs/common';
import { UserValidationService } from '../user-validation.service';

describe('UserValidationService', () => {
  let service: UserValidationService;

  beforeEach(() => {
    service = new UserValidationService();
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

    it('should pass and lowercase for valid address', () => {
      const addr = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
      expect(service.validateWalletAddress(addr)).toBe(addr.toLowerCase());
    });
  });

  describe('validateSignature', () => {
    it('should throw for empty signature', () => {
      expect(() => service.validateSignature('')).toThrow(BadRequestException);
    });

    it('should throw for invalid format', () => {
      expect(() => service.validateSignature('abc')).toThrow(
        BadRequestException,
      );
      expect(() => service.validateSignature('0x123')).toThrow(
        BadRequestException,
      ); // too short
    });

    it('should pass for valid signature format', () => {
      const sig = '0x' + 'a'.repeat(130);
      expect(service.validateSignature(sig)).toBe(sig);
    });
  });

  describe('validateActivateData', () => {
    const validData = {
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      nonce: 'nonce-123',
      timestamp: new Date().toISOString(),
    };

    it('should pass for valid recent data', () => {
      expect(() => service.validateActivateData(validData)).not.toThrow();
    });

    it('should throw for invalid timestamp', () => {
      expect(() =>
        service.validateActivateData({ ...validData, timestamp: 'invalid' }),
      ).toThrow(BadRequestException);
    });

    it('should throw for expired timestamp (too old)', () => {
      const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
      expect(() =>
        service.validateActivateData({ ...validData, timestamp: oldDate }),
      ).toThrow(BadRequestException);
    });

    it('should throw for future timestamp (too far ahead)', () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins future
      expect(() =>
        service.validateActivateData({ ...validData, timestamp: futureDate }),
      ).toThrow(BadRequestException);
    });
  });
});
