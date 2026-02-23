import { PositionRepository } from '../position.repository';
import { PositionModel } from '../position.model';
import { Position } from 'src/shared/types/position.type';

// Mock PositionModel
jest.mock('../position.model');

describe('PositionRepository', () => {
  let repository: PositionRepository;

  const mockPosition: Position = {
    _id: 'pos-123',
    walletAddress: '0xabc123',
    symbol: 'BTC-USDT',
    side: 'long',
    type: 'market',
    status: 'open',
    qty: 0.1,
    entryPrice: 50000,
    leverage: 10,
    pnl: 0,
    exitPrice: null,
    sl: 49000,
    tp: 52000,
    openFee: 0.5,
    closeFee: 0,
    deletedAt: null,
  };

  const baseQuery = { deletedAt: null };

  beforeEach(() => {
    repository = new PositionRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // findById
  // ────────────────────────────────────────
  describe('findById', () => {
    it('should return position by id (not soft-deleted)', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockPosition);
      (PositionModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findById('pos-123');

      expect(PositionModel.findOne).toHaveBeenCalledWith({
        _id: 'pos-123',
        ...baseQuery,
      });
      expect(result).toEqual(mockPosition);
    });

    it('should return null when position not found', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (PositionModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should not return soft-deleted positions', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (PositionModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findById('pos-deleted');

      // baseQuery includes deletedAt: null, so soft-deleted items are excluded
      expect(PositionModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // findByWallet
  // ────────────────────────────────────────
  describe('findByWallet', () => {
    it('should return all positions for a wallet (lowercased)', async () => {
      const mockLean = jest.fn().mockResolvedValue([mockPosition]);
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findByWallet('0xABC123');

      expect(PositionModel.find).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        ...baseQuery,
      });
      expect(result).toEqual([mockPosition]);
    });

    it('should return empty array when no positions found', async () => {
      const mockLean = jest.fn().mockResolvedValue([]);
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findByWallet('0xunknown');

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────
  // findActiveByWallet
  // ────────────────────────────────────────
  describe('findActiveByWallet', () => {
    it('should return pending and open positions only', async () => {
      const pendingPosition = {
        ...mockPosition,
        _id: 'pos-456',
        status: 'pending' as const,
      };
      const mockLean = jest
        .fn()
        .mockResolvedValue([mockPosition, pendingPosition]);
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findActiveByWallet('0xABC123');

      expect(PositionModel.find).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        status: { $in: ['pending', 'open'] },
        ...baseQuery,
      });
      expect(result).toHaveLength(2);
    });

    it('should lowercase the wallet address', async () => {
      const mockLean = jest.fn().mockResolvedValue([]);
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      await repository.findActiveByWallet('0xDEF456');

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xdef456' }),
      );
    });
  });

  // ────────────────────────────────────────
  // create
  // ────────────────────────────────────────
  describe('create', () => {
    it('should create a new position with lowercased wallet', async () => {
      const { _id, ...createData } = mockPosition;
      const createdPosition = { ...mockPosition, _id: 'new-pos-id' };
      (PositionModel.create as jest.Mock) = jest
        .fn()
        .mockResolvedValue(createdPosition);

      const result = await repository.create({
        ...createData,
        walletAddress: '0xABC123',
      });

      expect(PositionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xabc123' }),
      );
      expect(result).toEqual(createdPosition);
    });

    it('should pass all position data to model', async () => {
      const { _id, ...createData } = mockPosition;
      (PositionModel.create as jest.Mock) = jest
        .fn()
        .mockResolvedValue(mockPosition);

      await repository.create(createData);

      expect(PositionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USDT',
          side: 'long',
          type: 'market',
          status: 'open',
          qty: 0.1,
          leverage: 10,
        }),
      );
    });
  });

  // ────────────────────────────────────────
  // update
  // ────────────────────────────────────────
  describe('update', () => {
    it('should update position with partial data', async () => {
      const updatedPosition = { ...mockPosition, pnl: 500 };
      const mockLean = jest.fn().mockResolvedValue(updatedPosition);
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.update('pos-123', { pnl: 500 });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { pnl: 500 } },
        { new: true },
      );
      expect(result).toEqual(updatedPosition);
    });

    it('should return null if position not found', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.update('non-existent', { pnl: 100 });

      expect(result).toBeNull();
    });

    it('should not update soft-deleted positions', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      await repository.update('pos-deleted', { status: 'open' });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // close
  // ────────────────────────────────────────
  describe('close', () => {
    it('should close position with pnl, exitPrice and closeFee', async () => {
      const closedPosition = {
        ...mockPosition,
        status: 'closed',
        pnl: 1000,
        exitPrice: 51000,
        closeFee: 0.51,
      };
      const mockLean = jest.fn().mockResolvedValue(closedPosition);
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.close('pos-123', 1000, 51000, 0.51);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        {
          $set: {
            status: 'closed',
            pnl: 1000,
            exitPrice: 51000,
            closeFee: 0.51,
          },
        },
        { new: true },
      );
      expect(result).toEqual(closedPosition);
    });

    it('should default closeFee to 0 if not provided', async () => {
      const closedPosition = {
        ...mockPosition,
        status: 'closed',
        pnl: -200,
        exitPrice: 49800,
        closeFee: 0,
      };
      const mockLean = jest.fn().mockResolvedValue(closedPosition);
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      await repository.close('pos-123', -200, 49800);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: expect.objectContaining({ closeFee: 0 }),
        },
        expect.anything(),
      );
    });

    it('should return null if position not found for close', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.close('non-existent', 100, 50100);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // softDelete
  // ────────────────────────────────────────
  describe('softDelete', () => {
    it('should set deletedAt to current date', async () => {
      const now = new Date('2026-02-23T15:00:00Z');
      jest.useFakeTimers({ now });

      (PositionModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repository.softDelete('pos-123');

      expect(PositionModel.updateOne).toHaveBeenCalledWith(
        { _id: 'pos-123' },
        { $set: { deletedAt: now } },
      );

      jest.useRealTimers();
    });

    it('should return void', async () => {
      (PositionModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repository.softDelete('pos-123');

      expect(result).toBeUndefined();
    });
  });
});
