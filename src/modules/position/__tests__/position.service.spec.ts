import { PositionService } from '../position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { PositionModel } from 'src/repositories/position/position.model';
import { NonceModel } from 'src/repositories/nonce/nonce.model';
import { Position } from 'src/shared/types/position.type';
import * as eip712Util from 'src/shared/utils/eip712.util';
import { BadRequestException } from '@nestjs/common';

// Mock verifyAndConsumeNonce to avoid signature complexity in unit tests
jest.mock('src/shared/utils/eip712.util', () => ({
  verifyAndConsumeNonce: jest.fn(),
}));

describe('PositionService', () => {
  let service: PositionService;
  let repo: PositionRepository;
  let nonceRepo: NonceRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const mockTypedData = {
    walletAddress,
    nonce: 'fake_nonce',
  } as any;
  const mockSignature = '0xFAKE_SIGNATURE' as any;

  const mockPosition: Position = {
    walletAddress,
    symbol: 'BTC-USDT',
    side: 'long',
    type: 'market',
    status: 'open',
    qty: 1000,
    leverage: 10,
    pnl: 0,
  };

  beforeAll(async () => {
    await connectTestDB();
    repo = new PositionRepository();
    nonceRepo = new NonceRepository();
    service = new PositionService(repo, nonceRepo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await PositionModel.deleteMany({});
    await NonceModel.deleteMany({});
    jest.clearAllMocks();
    (eip712Util.verifyAndConsumeNonce as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  describe('openMarket', () => {
    it('should create an open position', async () => {
      const result = await service.openMarket(
        mockPosition,
        mockTypedData,
        mockSignature,
      );

      expect(result.status).toBe('open');
      expect(result.walletAddress).toBe(walletAddress);
      expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();

      const saved = await PositionModel.findById(result._id);
      expect(saved?.status).toBe('open');
    });

    it('should throw error if nonce verification fails', async () => {
      (eip712Util.verifyAndConsumeNonce as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid nonce'),
      );

      await expect(
        service.openMarket(mockPosition, mockTypedData, mockSignature),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('openLimit', () => {
    it('should create a pending position', async () => {
      const result = await service.openLimit(
        mockPosition,
        mockTypedData,
        mockSignature,
      );

      expect(result.status).toBe('pending');
      expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();

      const saved = await PositionModel.findById(result._id);
      expect(saved?.status).toBe('pending');
    });
  });

  describe('updatePending', () => {
    it('should update a pending order', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'pending',
      });
      const updateData = { qty: 2000 };

      const result = await service.updatePending(
        pos._id.toString(),
        updateData,
        mockTypedData,
        mockSignature,
      );

      expect(result!.qty).toBe(2000);
      expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();
    });

    it('should fail if position is already open', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'open',
      });

      await expect(
        service.updatePending(
          pos._id.toString(),
          {},
          mockTypedData,
          mockSignature,
        ),
      ).rejects.toThrow('Order is not pending');
    });
  });

  describe('cancelOrder', () => {
    it('should close a pending order', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'pending',
      });

      const result = await service.cancelOrder(
        pos._id.toString(),
        mockTypedData,
        mockSignature,
      );

      expect(result!.status).toBe('closed');
      expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();
    });
  });

  describe('getOpenOrders & getOrderHistory', () => {
    it('should filter orders by status', async () => {
      await PositionModel.insertMany([
        { ...mockPosition, status: 'pending', symbol: 'PENDING-1' },
        { ...mockPosition, status: 'pending', symbol: 'PENDING-2' },
        { ...mockPosition, status: 'closed', symbol: 'CLOSED-1' },
      ]);

      const openOrders = await service.getOpenOrders(walletAddress);
      expect(openOrders).toHaveLength(2);
      expect(openOrders.every((o) => o.status === 'pending')).toBe(true);

      const history = await service.getOrderHistory(walletAddress);
      expect(history).toHaveLength(1);
      expect(history[0].status === 'closed').toBe(true);
    });
  });

  describe('updateOpen', () => {
    it('should update an open position', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'open',
      });
      const updateData = { leverage: 20 };

      const result = await service.updateOpen(
        pos._id.toString(),
        updateData,
        mockTypedData,
        mockSignature,
      );

      expect(result!.leverage).toBe(20);
      expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();
    });

    it('should fail if position is pending or closed', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'pending',
      });

      await expect(
        service.updateOpen(
          pos._id.toString(),
          {},
          mockTypedData,
          mockSignature,
        ),
      ).rejects.toThrow('Position is not open');
    });
  });

  describe('close', () => {
    it('should close an open position and set pnl', async () => {
      const pos = await PositionModel.create({
        ...mockPosition,
        status: 'open',
      });
      const finalPnl = 150.5;

      const result = await service.close(
        pos._id.toString(),
        finalPnl,
        mockTypedData,
        mockSignature,
      );

      expect(result!.status).toBe('closed');
      expect(result!.pnl).toBe(finalPnl);
      expect(eip712Util.verifyAndConsumeNonce).toHaveBeenCalled();
    });
  });
});
