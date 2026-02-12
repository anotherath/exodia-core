import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PositionValidationService } from '../position-validation.service';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { MarketPriceCache } from '../../market/market-price.cache';
import * as eip712Util from 'src/shared/utils/eip712.util';
import { HexString } from 'src/shared/types/web3.type';

jest.mock('src/shared/utils/eip712.util', () => ({
  verifyTypedDataSignature: jest.fn(),
}));

describe('PositionValidationService', () => {
  let service: PositionValidationService;
  let nonceRepo: jest.Mocked<NonceRepository>;
  let priceCache: jest.Mocked<MarketPriceCache>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionValidationService,
        {
          provide: NonceRepository,
          useValue: {
            findValid: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: MarketPriceCache,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PositionValidationService>(PositionValidationService);
    nonceRepo = module.get(NonceRepository);
    priceCache = module.get(MarketPriceCache);
  });

  describe('verifyAndConsumeNonce', () => {
    const params = {
      walletAddress: '0x123' as HexString,
      nonce: 'n1',
      signature: '0xsig' as HexString,
      types: {},
      primaryType: 'T',
      message: {},
    };

    it('should success and delete nonce', async () => {
      nonceRepo.findValid.mockResolvedValue({ nonce: 'n1' } as any);
      (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(
        true,
      );

      await service.verifyAndConsumeNonce(params);

      expect(nonceRepo.delete).toHaveBeenCalledWith('0x123');
    });

    it('should throw if nonce invalid', async () => {
      nonceRepo.findValid.mockResolvedValue(null);
      await expect(service.verifyAndConsumeNonce(params)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if signature invalid', async () => {
      nonceRepo.findValid.mockResolvedValue({ nonce: 'n1' } as any);
      (eip712Util.verifyTypedDataSignature as jest.Mock).mockResolvedValue(
        false,
      );
      await expect(service.verifyAndConsumeNonce(params)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateLimitPrice', () => {
    it('should throw if price <= 0', () => {
      expect(() => service.validateLimitPrice({ price: 0 } as any)).toThrow(
        'Giá đặt (Limit Price) không hợp lệ',
      );
    });

    it('should throw if no market price', () => {
      priceCache.get.mockReturnValue(undefined);
      expect(() =>
        service.validateLimitPrice({ symbol: 'BTC', price: 100 } as any),
      ).toThrow('Hiện chưa có giá thị trường cho cặp tiền này');
    });

    it('should validate long limit price', () => {
      priceCache.get.mockReturnValue({ askPx: '100', bidPx: '90' } as any);
      // Valid long: price < ask
      expect(() =>
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'long',
          price: 95,
        } as any),
      ).not.toThrow();
      // Invalid long: price >= ask
      expect(() =>
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'long',
          price: 105,
        } as any),
      ).toThrow('Giá Long Limit phải thấp hơn giá thị trường hiện tại');
    });

    it('should validate short limit price', () => {
      priceCache.get.mockReturnValue({ askPx: '100', bidPx: '90' } as any);
      // Valid short: price > bid
      expect(() =>
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'short',
          price: 95,
        } as any),
      ).not.toThrow();
      // Invalid short: price <= bid
      expect(() =>
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'short',
          price: 85,
        } as any),
      ).toThrow('Giá Short Limit phải cao hơn giá thị trường hiện tại');
    });
  });

  describe('validateSLTP', () => {
    it('should throw if SL/TP <= 0', () => {
      expect(() => service.validateSLTP('long', 100, -1, null)).toThrow(
        'Giá cắt lỗ (SL) phải lớn hơn 0',
      );
      expect(() => service.validateSLTP('long', 100, null, 0)).toThrow(
        'Giá chốt lời (TP) phải lớn hơn 0',
      );
    });

    it('should validate Long SL/TP', () => {
      // Long: SL < Price < TP
      expect(() => service.validateSLTP('long', 100, 90, 110)).not.toThrow();
      expect(() => service.validateSLTP('long', 100, 110, null)).toThrow(
        'Cắt lỗ (SL) của Long phải thấp hơn giá tham chiếu',
      );
      expect(() => service.validateSLTP('long', 100, null, 90)).toThrow(
        'Chốt lời (TP) của Long phải cao hơn giá tham chiếu',
      );
    });

    it('should validate Short SL/TP', () => {
      // Short: TP < Price < SL
      expect(() => service.validateSLTP('short', 100, 110, 90)).not.toThrow();
      expect(() => service.validateSLTP('short', 100, 90, null)).toThrow(
        'Cắt lỗ (SL) của Short phải cao hơn giá tham chiếu',
      );
      expect(() => service.validateSLTP('short', 100, null, 110)).toThrow(
        'Chốt lời (TP) của Short phải thấp hơn giá tham chiếu',
      );
    });
  });
});
