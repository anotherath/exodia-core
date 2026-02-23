import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PositionValidationService } from '../position-validation.service';
import { NonceRepository } from 'src/repositories/cache/nonce.cache';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import * as eip712Util from 'src/shared/utils/eip712.util';
import { HexString } from 'src/shared/types/web3.type';

jest.mock('src/shared/utils/eip712.util', () => ({
  verifyTypedDataSignature: jest.fn(),
}));

describe('PositionValidationService', () => {
  let service: PositionValidationService;
  let nonceRepo: jest.Mocked<NonceRepository>;
  let marketPriceRepo: jest.Mocked<RealtimeMarketPriceRepository>;
  let pairRepo: jest.Mocked<PairRepository>;

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
          provide: RealtimeMarketPriceRepository,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PairRepository,
          useValue: {
            findByInstId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PositionValidationService>(PositionValidationService);
    nonceRepo = module.get(NonceRepository);
    marketPriceRepo = module.get(RealtimeMarketPriceRepository);
    pairRepo = module.get(PairRepository);
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
    it('should throw if entryPrice <= 0', async () => {
      await expect(
        service.validateLimitPrice({ entryPrice: 0 } as any),
      ).rejects.toThrow('Giá đặt (Limit Price) không hợp lệ');
    });

    it('should throw if no market price', async () => {
      marketPriceRepo.get.mockResolvedValue(undefined);
      await expect(
        service.validateLimitPrice({ symbol: 'BTC', entryPrice: 100 } as any),
      ).rejects.toThrow('Hiện chưa có giá thị trường cho cặp tiền này');
    });

    it('should validate long limit price', async () => {
      marketPriceRepo.get.mockResolvedValue({
        askPx: '100',
        bidPx: '90',
      } as any);
      // Valid long: entryPrice < ask
      await expect(
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'long',
          entryPrice: 95,
        } as any),
      ).resolves.not.toThrow();
      // Invalid long: entryPrice >= ask
      await expect(
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'long',
          entryPrice: 105,
        } as any),
      ).rejects.toThrow('Giá Long Limit phải thấp hơn giá thị trường hiện tại');
    });

    it('should validate short limit price', async () => {
      marketPriceRepo.get.mockResolvedValue({
        askPx: '100',
        bidPx: '90',
      } as any);
      // Valid short: entryPrice > bid
      await expect(
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'short',
          entryPrice: 95,
        } as any),
      ).resolves.not.toThrow();
      // Invalid short: entryPrice <= bid
      await expect(
        service.validateLimitPrice({
          symbol: 'BTC',
          side: 'short',
          entryPrice: 85,
        } as any),
      ).rejects.toThrow('Giá Short Limit phải cao hơn giá thị trường hiện tại');
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

  describe('validateSymbolAndParams', () => {
    const mockPair = {
      instId: 'BTC-USDT',
      maxLeverage: 100,
      minVolume: 0.001,
      isActive: true,
      openFeeRate: 0.0001,
      closeFeeRate: 0.0001,
    };

    it('should success and return pair', async () => {
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);
      const result = await service.validateSymbolAndParams({
        symbol: 'BTC-USDT',
        qty: 0.1,
        leverage: 10,
      } as any);
      expect(result).toEqual(mockPair);
    });

    it('should throw if pair not found', async () => {
      pairRepo.findByInstId.mockResolvedValue(null);
      await expect(
        service.validateSymbolAndParams({ symbol: 'UNKNOWN' } as any),
      ).rejects.toThrow("Cặp giao dịch 'UNKNOWN' không tồn tại trong hệ thống");
    });

    it('should throw if pair inactive', async () => {
      pairRepo.findByInstId.mockResolvedValue({
        ...mockPair,
        isActive: false,
      } as any);
      await expect(
        service.validateSymbolAndParams({ symbol: 'BTC-USDT' } as any),
      ).rejects.toThrow(
        "Cặp giao dịch 'BTC-USDT' hiện đang tạm dừng giao dịch",
      );
    });

    it('should throw if qty < minVolume', async () => {
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);
      await expect(
        service.validateSymbolAndParams({
          symbol: 'BTC-USDT',
          qty: 0.0001,
        } as any),
      ).rejects.toThrow('Khối lượng tối thiểu cho BTC-USDT là 0.001');
    });

    it('should throw if leverage > maxLeverage', async () => {
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);
      await expect(
        service.validateSymbolAndParams({
          symbol: 'BTC-USDT',
          qty: 0.1,
          leverage: 125,
        } as any),
      ).rejects.toThrow('Đòn bẩy tối đa cho BTC-USDT là 100x');
    });
  });
});
