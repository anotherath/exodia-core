import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PositionService } from '../position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { MarketPriceCache } from '../../market/market-price.cache';
import { PositionValidationService } from '../position-validation.service';
import { WalletService } from '../../wallet/wallet.service';
import { Position } from 'src/shared/types/position.type';
import { HexString } from 'src/shared/types/web3.type';

describe('PositionService', () => {
  let service: PositionService;
  let repo: jest.Mocked<PositionRepository>;
  let priceCache: jest.Mocked<MarketPriceCache>;
  let validator: jest.Mocked<PositionValidationService>;
  let walletService: jest.Mocked<WalletService>;

  const walletAddress =
    '0x1c62040b08a8e10086a603bf27c2e1e1e1e1e1e1' as HexString;
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

  beforeEach(async () => {
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
          provide: MarketPriceCache,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PositionValidationService,
          useValue: {
            verifyAndConsumeNonce: jest.fn(),
            validateLimitPrice: jest.fn(),
            validateSLTP: jest.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            updateTradePnL: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
    repo = module.get(PositionRepository);
    priceCache = module.get(MarketPriceCache);
    validator = module.get(PositionValidationService);
    walletService = module.get(WalletService);
  });

  describe('openMarket', () => {
    it(' nên mở lệnh market thành công', async () => {
      priceCache.get.mockReturnValue({ askPx: '50000', bidPx: '49000' } as any);
      repo.create.mockResolvedValue({
        ...mockPosition,
        status: 'open',
        entryPrice: 50000,
      } as any);

      const result = await service.openMarket(
        mockPosition,
        mockTypedData,
        mockSignature,
      );

      expect(validator.verifyAndConsumeNonce).toHaveBeenCalled();
      expect(priceCache.get).toHaveBeenCalledWith('BTC-USDT');
      expect(validator.validateSLTP).toHaveBeenCalledWith(
        'long',
        50000,
        undefined,
        undefined,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'open',
          entryPrice: 50000,
        }),
      );
      expect(result.status).toBe('open');
    });

    it(' nên lỗi nếu không có giá thị trường', async () => {
      priceCache.get.mockReturnValue(undefined);

      await expect(
        service.openMarket(mockPosition, mockTypedData, mockSignature),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('openLimit', () => {
    it(' nên tạo lệnh limit ở trạng thái pending', async () => {
      repo.create.mockResolvedValue({
        ...mockPosition,
        status: 'pending',
        entryPrice: null,
      } as any);

      const result = await service.openLimit(
        mockPosition,
        mockTypedData,
        mockSignature,
      );

      expect(validator.verifyAndConsumeNonce).toHaveBeenCalled();
      expect(validator.validateLimitPrice).toHaveBeenCalledWith(mockPosition);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          entryPrice: null,
        }),
      );
      expect(result.status).toBe('pending');
    });
  });

  describe('updatePending', () => {
    it(' nên cập nhật lệnh chờ thành công', async () => {
      const existingPos = {
        ...mockPosition,
        status: 'pending',
        _id: 'id123',
      } as any;
      repo.findById.mockResolvedValue(existingPos);
      const updateData = { qty: 2, price: 45000 };

      await service.updatePending(
        'id123',
        updateData,
        mockTypedData,
        mockSignature,
      );

      expect(validator.verifyAndConsumeNonce).toHaveBeenCalled();
      expect(validator.validateLimitPrice).toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        'id123',
        expect.objectContaining({
          qty: 2,
          price: 45000,
        }),
      );
    });
  });

  describe('close', () => {
    it(' nên đóng vị thế thành công, tính PnL và cập nhật Wallet', async () => {
      const existingPos = {
        ...mockPosition,
        status: 'open',
        _id: 'id123',
        entryPrice: 40000,
        qty: 1,
      } as any;
      repo.findById.mockResolvedValue(existingPos);
      priceCache.get.mockReturnValue({ bidPx: '45000', askPx: '46000' } as any);
      walletService.updateTradePnL.mockResolvedValue(undefined);

      await service.close('id123', 0, mockTypedData, mockSignature);

      const expectedPnl = (45000 - 40000) * 1;
      expect(walletService.updateTradePnL).toHaveBeenCalledWith(
        walletAddress,
        expect.any(Number),
        expectedPnl,
      );
      expect(repo.close).toHaveBeenCalledWith('id123', expectedPnl, 45000);
    });
  });

  describe('Queries', () => {
    it('getOpenOrders nên filter đúng status pending', async () => {
      repo.findActiveByWallet.mockResolvedValue([
        { status: 'pending' },
        { status: 'open' },
      ] as any);
      const result = await service.getOpenOrders(walletAddress);
      expect(result.length).toBe(1);
      expect(result[0].status).toBe('pending');
    });

    it('getActivePositions nên filter đúng status open', async () => {
      repo.findActiveByWallet.mockResolvedValue([
        { status: 'pending' },
        { status: 'open' },
      ] as any);
      const result = await service.getActivePositions(walletAddress);
      expect(result.length).toBe(1);
      expect(result[0].status).toBe('open');
    });
  });
});
