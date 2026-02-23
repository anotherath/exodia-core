import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PositionService } from '../position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { PositionValidationService } from '../position-validation.service';
import { WalletService } from '../../wallet/wallet.service';
import { Position } from 'src/shared/types/position.type';
import { Pair } from 'src/shared/types/pair.type';
import { HexString } from 'src/shared/types/web3.type';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

describe('PositionService', () => {
  let service: PositionService;
  let repo: jest.Mocked<PositionRepository>;
  let pairRepo: jest.Mocked<PairRepository>;
  let marketPriceRepo: jest.Mocked<RealtimeMarketPriceRepository>;
  let validator: jest.Mocked<PositionValidationService>;
  let walletService: jest.Mocked<WalletService>;
  let redisMock: Record<string, jest.Mock>;

  const walletAddress =
    '0x1776040b08a8e10086a603bf27c2e1e1e1e1e1e1' as HexString;
  const mockSignature = '0xsignature' as HexString;
  const mockTypedData = { walletAddress, nonce: 'nonce123' } as any;

  const mockPosition: Position = {
    walletAddress,
    symbol: 'BTC-USDT',
    side: 'long',
    type: 'market',
    status: 'open',
    qty: 1,
    leverage: 10,
    pnl: 0,
  };

  const mockPair: Pair = {
    instId: 'BTC-USDT',
    maxLeverage: 100,
    minVolume: 0.001,
    minAmount: 10,
    openFeeRate: 0.0001, // 0.01%
    closeFeeRate: 0.0002, // 0.02%
    isActive: true,
  };

  beforeEach(async () => {
    redisMock = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
      hset: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      hdel: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        {
          provide: PositionRepository,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            close: jest.fn(),
            findById: jest.fn(),
            findActiveByWallet: jest.fn(),
            findByWallet: jest.fn(),
          },
        },
        {
          provide: PairRepository,
          useValue: {
            findByInstId: jest.fn(),
          },
        },
        {
          provide: RealtimeMarketPriceRepository,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PositionValidationService,
          useValue: {
            verifyAndConsumeNonce: jest.fn(),
            validateSymbolAndParams: jest.fn(),
            validateLimitPrice: jest.fn(),
            validateSLTP: jest.fn(),
            validatePartialClose: jest.fn(),
            validateMargin: jest.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            updateTradePnL: jest.fn(),
          },
        },
        {
          provide: getRedisConnectionToken('default'),
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
    repo = module.get(PositionRepository);
    pairRepo = module.get(PairRepository);
    marketPriceRepo = module.get(RealtimeMarketPriceRepository);
    validator = module.get(PositionValidationService);
    walletService = module.get(WalletService);
  });

  describe('openMarket', () => {
    it(' nên mở lệnh market thành công và trừ phí mở lệnh', async () => {
      marketPriceRepo.get.mockResolvedValue({
        askPx: '50000',
        bidPx: '49000',
      } as any);
      validator.validateSymbolAndParams.mockResolvedValue(mockPair);
      repo.create.mockResolvedValue({
        _id: 'pos123',
        ...mockPosition,
        status: 'open',
        entryPrice: 50000,
        openFee: 5, // 1 * 50000 * 0.0001
      } as any);

      const result = await service.openMarket(
        mockPosition,
        mockTypedData,
        mockSignature,
      );

      const expectedOpenFee = 1 * 50000 * 0.0001;
      expect(walletService.updateTradePnL).toHaveBeenCalledWith(
        walletAddress,
        expect.any(Number),
        -expectedOpenFee,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          openFee: expectedOpenFee,
          status: 'open',
        }),
      );
      expect(result.status).toBe('open');
    });
  });

  describe('updateOpen', () => {
    it(' nên đóng một phần vị thế: tính PnL ròng và trừ phí đóng', async () => {
      const existingPos = {
        ...mockPosition,
        _id: 'id123',
        entryPrice: 40000,
        qty: 1,
      } as any;
      repo.findById.mockResolvedValue(existingPos);
      marketPriceRepo.get.mockResolvedValue({
        bidPx: '45000',
        askPx: '46000',
      } as any);
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);

      // Đóng 0.4 BTC (còn lại 0.6)
      await service.updateOpen(
        'id123',
        { qty: 0.6 },
        mockTypedData,
        mockSignature,
      );

      const closeQty = 0.4;
      const rawPnl = (45000 - 40000) * closeQty; // 2000
      const closeFee = closeQty * 45000 * 0.0002; // 3.6
      const netPnl = rawPnl - closeFee;

      expect(validator.validatePartialClose).toHaveBeenCalledWith(
        existingPos,
        closeQty,
      );
      expect(walletService.updateTradePnL).toHaveBeenCalledWith(
        walletAddress,
        expect.any(Number),
        netPnl,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'closed',
          qty: closeQty,
          pnl: netPnl,
          closeFee,
        }),
      );
      expect(repo.update).toHaveBeenCalledWith('id123', { qty: 0.6 });
    });

    it(' nên lỗi nếu cố tình thay đổi đòn bẩy', async () => {
      repo.findById.mockResolvedValue({ ...mockPosition, leverage: 10 } as any);
      await expect(
        service.updateOpen(
          'id123',
          { leverage: 20 },
          mockTypedData,
          mockSignature,
        ),
      ).rejects.toThrow('Không thể thay đổi đòn bẩy khi vị thế đang mở');
    });

    it(' nên lỗi nếu cố tình tăng qty', async () => {
      repo.findById.mockResolvedValue({ ...mockPosition, qty: 1 } as any);
      await expect(
        service.updateOpen('id123', { qty: 2 }, mockTypedData, mockSignature),
      ).rejects.toThrow('Không thể tăng khối lượng vị thế trực tiếp');
    });
  });

  describe('close', () => {
    it(' nên đóng toàn bộ vị thế: tính PnL ròng và trừ phí đóng', async () => {
      const existingPos = {
        ...mockPosition,
        _id: 'id123',
        entryPrice: 40000,
        qty: 1,
      } as any;
      repo.findById.mockResolvedValue(existingPos);
      marketPriceRepo.get.mockResolvedValue({
        bidPx: '42000',
        askPx: '43000',
      } as any);
      pairRepo.findByInstId.mockResolvedValue(mockPair as any);

      await service.close('id123', 0, mockTypedData, mockSignature);

      const rawPnl = (42000 - 40000) * 1; // 2000
      const closeFee = 1 * 42000 * 0.0002; // 8.4
      const netPnl = rawPnl - closeFee;

      expect(walletService.updateTradePnL).toHaveBeenCalledWith(
        walletAddress,
        expect.any(Number),
        netPnl,
      );
      expect(repo.close).toHaveBeenCalledWith('id123', netPnl, 42000, closeFee);
    });
  });
});
