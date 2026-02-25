import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PositionValidationService } from '../position-validation.service';
import { NonceService } from 'src/modules/nonce/nonce.service';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { WalletService } from '../../wallet/wallet.service';
import { HexString } from 'src/shared/types/web3.type';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

describe('PositionValidationService', () => {
  let service: PositionValidationService;
  let nonceService: jest.Mocked<NonceService>;
  let marketPriceRepo: jest.Mocked<RealtimeMarketPriceRepository>;
  let pairRepo: jest.Mocked<PairRepository>;
  let redisMock: Record<string, jest.Mock>;
  let walletServiceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    redisMock = {
      hgetall: jest.fn().mockResolvedValue({}),
    };
    walletServiceMock = {
      getWallet: jest.fn().mockResolvedValue({ tradeBalance: 10000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionValidationService,
        {
          provide: getRedisConnectionToken('default'),
          useValue: redisMock,
        },
        {
          provide: NonceService,
          useValue: {
            verifyAndConsume: jest.fn(),
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
        {
          provide: WalletService,
          useValue: walletServiceMock,
        },
      ],
    }).compile();

    service = module.get<PositionValidationService>(PositionValidationService);
    nonceService = module.get(NonceService);
    marketPriceRepo = module.get(RealtimeMarketPriceRepository);
    pairRepo = module.get(PairRepository);
  });

  describe('validateLimitPrice', () => {
    it('should throw if entryPrice is null', async () => {
      await expect(
        service.validateLimitPrice({
          entryPrice: null,
          symbol: 'BTC',
          side: 'long',
        } as any),
      ).rejects.toThrow(
        'Giá đặt lệnh (Entry Price) là bắt buộc cho lệnh Limit',
      );
    });

    it('should throw if entryPrice is undefined', async () => {
      await expect(
        service.validateLimitPrice({ symbol: 'BTC', side: 'long' } as any),
      ).rejects.toThrow(
        'Giá đặt lệnh (Entry Price) là bắt buộc cho lệnh Limit',
      );
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
    it('should validate SL/TP relative to reference price for Long', () => {
      expect(() => service.validateSLTP('long', 100, 50, null)).not.toThrow();
      expect(() => service.validateSLTP('long', 100, null, 150)).not.toThrow();
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
      minAmount: 10,
      isActive: true,
      openFeeRate: 0.0001,
      closeFeeRate: 0.0001,
    };

    it('should success and return pair', async () => {
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);
      marketPriceRepo.get.mockResolvedValue({
        askPx: '50000',
        bidPx: '49900',
      } as any);
      const result = await service.validateSymbolAndParams({
        symbol: 'BTC-USDT',
        qty: 0.1,
        leverage: 10,
        side: 'long',
        type: 'market',
      } as any);
      expect(result).toEqual(mockPair);
    });

    it('should throw if pair not found', async () => {
      pairRepo.findByInstId.mockResolvedValue(null);
      await expect(
        service.validateSymbolAndParams({
          symbol: 'UNKNOWN',
          qty: 1,
          leverage: 10,
        } as any),
      ).rejects.toThrow("Cặp giao dịch 'UNKNOWN' không tồn tại trong hệ thống");
    });

    it('should throw if pair inactive', async () => {
      pairRepo.findByInstId.mockResolvedValue({
        ...mockPair,
        isActive: false,
      } as any);
      await expect(
        service.validateSymbolAndParams({
          symbol: 'BTC-USDT',
          qty: 0.1,
          leverage: 10,
        } as any),
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
          leverage: 10,
        } as any),
      ).rejects.toThrow('Khối lượng tối thiểu cho BTC-USDT là 0.001');
    });

    it('should throw if order amount < minAmount', async () => {
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);
      marketPriceRepo.get.mockResolvedValue({
        askPx: '9000',
        bidPx: '8900',
      } as any);

      await expect(
        service.validateSymbolAndParams({
          symbol: 'BTC-USDT',
          qty: 0.001, // 0.001 * 9000 = 9 USD < 10 USD
          leverage: 10,
          type: 'market',
          side: 'long',
        } as any),
      ).rejects.toThrow('Giá trị lệnh tối thiểu cho BTC-USDT là 10 USD');
    });

    it('should throw if leverage > maxLeverage', async () => {
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);
      marketPriceRepo.get.mockResolvedValue({
        askPx: '50000',
        bidPx: '49900',
      } as any);
      await expect(
        service.validateSymbolAndParams({
          symbol: 'BTC-USDT',
          qty: 0.1,
          leverage: 125,
          type: 'market',
          side: 'long',
        } as any),
      ).rejects.toThrow('Đòn bẩy tối đa cho BTC-USDT là 100x');
    });
  });
});
