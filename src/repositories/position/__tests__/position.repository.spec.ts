import { PositionRepository } from '../position.repository';
import { PositionModel } from '../position.model';
import { Position } from 'src/shared/types/position.type';

// Mock PositionModel
jest.mock('../position.model');

// ─── Helper ──────────────────────────────────────
const mockLeanReturn = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value),
});

const mockChainReturn = (value: unknown) => ({
  sort: jest.fn().mockReturnValue({
    skip: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
      }),
    }),
  }),
});

describe('PositionRepository', () => {
  let repo: PositionRepository;

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
    repo = new PositionRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // QUERY – findById
  // ────────────────────────────────────────
  describe('findById', () => {
    it('should return position by id (not soft-deleted)', async () => {
      (PositionModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockPosition));

      const result = await repo.findById('pos-123');

      expect(PositionModel.findOne).toHaveBeenCalledWith({
        _id: 'pos-123',
        ...baseQuery,
      });
      expect(result).toEqual(mockPosition);
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should not return soft-deleted positions', async () => {
      (PositionModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      await repo.findById('pos-deleted');

      expect(PositionModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
    });
  });

  // ────────────────────────────────────────
  // QUERY – findByWallet
  // ────────────────────────────────────────
  describe('findByWallet', () => {
    it('should return all positions for a wallet (lowercased)', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([mockPosition]));

      const result = await repo.findByWallet('0xABC123');

      expect(PositionModel.find).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        ...baseQuery,
      });
      expect(result).toEqual([mockPosition]);
    });

    it('should return empty array when no positions found', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([]));

      const result = await repo.findByWallet('0xunknown');

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────
  // QUERY – findActiveByWallet
  // ────────────────────────────────────────
  describe('findActiveByWallet', () => {
    it('should return pending and open positions only', async () => {
      const pendingPos = {
        ...mockPosition,
        _id: 'pos-456',
        status: 'pending' as const,
      };
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([mockPosition, pendingPos]));

      const result = await repo.findActiveByWallet('0xABC123');

      expect(PositionModel.find).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        status: { $in: ['pending', 'open'] },
        ...baseQuery,
      });
      expect(result).toHaveLength(2);
    });

    it('should lowercase the wallet address', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([]));

      await repo.findActiveByWallet('0xDEF456');

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xdef456' }),
      );
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAll (paginated)
  // ────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results with default params', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([mockPosition]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(1);

      const result = await repo.findAll();

      expect(PositionModel.find).toHaveBeenCalledWith({ ...baseQuery });
      expect(PositionModel.countDocuments).toHaveBeenCalledWith({
        ...baseQuery,
      });
      expect(result).toEqual({
        data: [mockPosition],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should apply walletAddress filter (lowercased)', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ walletAddress: '0xUPPER' });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper', ...baseQuery }),
      );
    });

    it('should apply symbol filter', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ symbol: 'ETH-USDT' });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'ETH-USDT' }),
      );
    });

    it('should apply side filter', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ side: 'short' });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ side: 'short' }),
      );
    });

    it('should apply type filter', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ type: 'limit' });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'limit' }),
      );
    });

    it('should apply status filter', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll({ status: 'closed' });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'closed' }),
      );
    });

    it('should calculate correct skip for page 3 with limit 10', async () => {
      const mockSort = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ sort: mockSort });
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(50);

      const result = await repo.findAll({}, 3, 10);

      const skipFn = mockSort.mock.results[0].value.skip;
      expect(skipFn).toHaveBeenCalledWith(20);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('should exclude soft-deleted positions', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAll();

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAllIncludeDeleted
  // ────────────────────────────────────────
  describe('findAllIncludeDeleted', () => {
    it('should return all positions including soft-deleted', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([mockPosition]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(1);

      const result = await repo.findAllIncludeDeleted();

      expect(PositionModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual({
        data: [mockPosition],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should NOT include deletedAt filter', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAllIncludeDeleted();

      const calledQuery = (PositionModel.find as jest.Mock).mock.calls[0][0];
      expect(calledQuery).not.toHaveProperty('deletedAt');
    });

    it('should apply walletAddress filter (lowercased)', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAllIncludeDeleted({ walletAddress: '0xMIXED' });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
      );
    });

    it('should apply symbol and status filters', async () => {
      (PositionModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(0);

      await repo.findAllIncludeDeleted({
        symbol: 'BTC-USDT',
        status: 'closed',
      });

      expect(PositionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTC-USDT', status: 'closed' }),
      );
    });
  });

  // ────────────────────────────────────────
  // QUERY – count
  // ────────────────────────────────────────
  describe('count', () => {
    it('should count non-deleted positions with empty filter', async () => {
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(25);

      const result = await repo.count();

      expect(PositionModel.countDocuments).toHaveBeenCalledWith({
        ...baseQuery,
      });
      expect(result).toBe(25);
    });

    it('should count positions matching filter', async () => {
      (PositionModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(5);

      const result = await repo.count({ status: 'open' });

      expect(PositionModel.countDocuments).toHaveBeenCalledWith({
        ...baseQuery,
        status: 'open',
      });
      expect(result).toBe(5);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – create
  // ────────────────────────────────────────
  describe('create', () => {
    it('should create a new position with lowercased wallet', async () => {
      const { _id, ...createData } = mockPosition;
      const createdPosition = { ...mockPosition, _id: 'new-pos-id' };
      (PositionModel.create as jest.Mock) = jest
        .fn()
        .mockResolvedValue(createdPosition);

      const result = await repo.create({
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

      await repo.create(createData);

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
  // MUTATION – update
  // ────────────────────────────────────────
  describe('update', () => {
    it('should update position with partial data', async () => {
      const updated = { ...mockPosition, pnl: 500 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.update('pos-123', { pnl: 500 });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { pnl: 500 } },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should return null if position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.update('non-existent', { pnl: 100 });

      expect(result).toBeNull();
    });

    it('should not update soft-deleted positions', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      await repo.update('pos-deleted', { status: 'open' });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // MUTATION – close
  // ────────────────────────────────────────
  describe('close', () => {
    it('should close position with pnl, exitPrice and closeFee', async () => {
      const closed = {
        ...mockPosition,
        status: 'closed',
        pnl: 1000,
        exitPrice: 51000,
        closeFee: 0.51,
      };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(closed));

      const result = await repo.close('pos-123', 1000, 51000, 0.51);

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
      expect(result).toEqual(closed);
    });

    it('should default closeFee to 0 if not provided', async () => {
      const closed = {
        ...mockPosition,
        status: 'closed',
        pnl: -200,
        exitPrice: 49800,
        closeFee: 0,
      };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(closed));

      await repo.close('pos-123', -200, 49800);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: expect.objectContaining({ closeFee: 0 }),
        },
        expect.anything(),
      );
    });

    it('should return null if position not found for close', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.close('non-existent', 100, 50100);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // MUTATION – softDelete
  // ────────────────────────────────────────
  describe('softDelete', () => {
    it('should set deletedAt to current date', async () => {
      const now = new Date('2026-02-23T15:00:00Z');
      jest.useFakeTimers({ now });

      (PositionModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.softDelete('pos-123');

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

      const result = await repo.softDelete('pos-123');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setSlTp
  // ────────────────────────────────────────
  describe('setSlTp', () => {
    it('should set sl and tp values', async () => {
      const updated = { ...mockPosition, sl: 48000, tp: 55000 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setSlTp('pos-123', 48000, 55000);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { sl: 48000, tp: 55000 } },
        { new: true },
      );
      expect(result!.sl).toBe(48000);
      expect(result!.tp).toBe(55000);
    });

    it('should allow setting sl/tp to null (remove)', async () => {
      const updated = { ...mockPosition, sl: null, tp: null };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setSlTp('pos-123', null, null);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { sl: null, tp: null } },
        expect.anything(),
      );
      expect(result!.sl).toBeNull();
      expect(result!.tp).toBeNull();
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setSlTp('ghost', 48000, 55000);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setLeverage
  // ────────────────────────────────────────
  describe('setLeverage', () => {
    it('should set leverage for a position', async () => {
      const updated = { ...mockPosition, leverage: 20 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setLeverage('pos-123', 20);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { leverage: 20 } },
        { new: true },
      );
      expect(result!.leverage).toBe(20);
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setLeverage('ghost', 50);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setStatus
  // ────────────────────────────────────────
  describe('setStatus', () => {
    it('should set status to closed', async () => {
      const updated = { ...mockPosition, status: 'closed' as const };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setStatus('pos-123', 'closed');

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { status: 'closed' } },
        { new: true },
      );
      expect(result!.status).toBe('closed');
    });

    it('should set status to pending', async () => {
      const updated = { ...mockPosition, status: 'pending' as const };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setStatus('pos-123', 'pending');

      expect(result!.status).toBe('pending');
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setStatus('ghost', 'open');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setEntryPrice
  // ────────────────────────────────────────
  describe('setEntryPrice', () => {
    it('should set entryPrice for a position', async () => {
      const updated = { ...mockPosition, entryPrice: 48500 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setEntryPrice('pos-123', 48500);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { entryPrice: 48500 } },
        { new: true },
      );
      expect(result!.entryPrice).toBe(48500);
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setEntryPrice('ghost', 50000);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setPnl
  // ────────────────────────────────────────
  describe('setPnl', () => {
    it('should set pnl for a position', async () => {
      const updated = { ...mockPosition, pnl: 1500 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setPnl('pos-123', 1500);

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { pnl: 1500 } },
        { new: true },
      );
      expect(result!.pnl).toBe(1500);
    });

    it('should allow negative pnl', async () => {
      const updated = { ...mockPosition, pnl: -500 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setPnl('pos-123', -500);

      expect(result!.pnl).toBe(-500);
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setPnl('ghost', 100);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – adminUpdate
  // ────────────────────────────────────────
  describe('adminUpdate', () => {
    it('should update multiple fields with $set', async () => {
      const updated = { ...mockPosition, pnl: 200, leverage: 5, sl: 47000 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.adminUpdate('pos-123', {
        pnl: 200,
        leverage: 5,
        sl: 47000,
      });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'pos-123', ...baseQuery },
        { $set: { pnl: 200, leverage: 5, sl: 47000 } },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should allow updating a single field', async () => {
      const updated = { ...mockPosition, openFee: 1.0 };
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      await repo.adminUpdate('pos-123', { openFee: 1.0 });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { openFee: 1.0 } },
        expect.anything(),
      );
    });

    it('should return null when position not found', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.adminUpdate('ghost', { pnl: 0 });

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted positions', async () => {
      (PositionModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      await repo.adminUpdate('pos-123', { status: 'closed' });

      expect(PositionModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – restore
  // ────────────────────────────────────────
  describe('restore', () => {
    it('should clear deletedAt for a position', async () => {
      (PositionModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.restore('pos-123');

      expect(PositionModel.updateOne).toHaveBeenCalledWith(
        { _id: 'pos-123' },
        { $set: { deletedAt: null } },
      );
    });

    it('should return void', async () => {
      (PositionModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repo.restore('pos-123');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – hardDelete
  // ────────────────────────────────────────
  describe('hardDelete', () => {
    it('should return true when position is deleted', async () => {
      (PositionModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const result = await repo.hardDelete('pos-123');

      expect(PositionModel.deleteOne).toHaveBeenCalledWith({ _id: 'pos-123' });
      expect(result).toBe(true);
    });

    it('should return false when position does not exist', async () => {
      (PositionModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.hardDelete('ghost');

      expect(result).toBe(false);
    });
  });

  // ────────────────────────────────────────
  // ADMIN – bulkClose
  // ────────────────────────────────────────
  describe('bulkClose', () => {
    it('should close multiple positions with default pnl=0', async () => {
      (PositionModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 3 });

      const ids = ['pos-1', 'pos-2', 'pos-3'];
      const result = await repo.bulkClose(ids);

      expect(PositionModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ids }, ...baseQuery },
        { $set: { status: 'closed', pnl: 0 } },
      );
      expect(result).toBe(3);
    });

    it('should close with custom pnl', async () => {
      (PositionModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 2 });

      const result = await repo.bulkClose(['pos-1', 'pos-2'], -100);

      expect(PositionModel.updateMany).toHaveBeenCalledWith(expect.anything(), {
        $set: { status: 'closed', pnl: -100 },
      });
      expect(result).toBe(2);
    });

    it('should return 0 when no positions matched', async () => {
      (PositionModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.bulkClose(['ghost-1']);

      expect(result).toBe(0);
    });

    it('should exclude soft-deleted positions', async () => {
      (PositionModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      await repo.bulkClose(['pos-1']);

      expect(PositionModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – bulkSoftDelete
  // ────────────────────────────────────────
  describe('bulkSoftDelete', () => {
    it('should soft-delete multiple positions', async () => {
      const now = new Date('2026-02-25T10:00:00Z');
      jest.useFakeTimers({ now });

      (PositionModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 2 });

      const ids = ['pos-1', 'pos-2'];
      const result = await repo.bulkSoftDelete(ids);

      expect(PositionModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ids } },
        { $set: { deletedAt: now } },
      );
      expect(result).toBe(2);

      jest.useRealTimers();
    });

    it('should return 0 when no positions matched', async () => {
      (PositionModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.bulkSoftDelete(['ghost']);

      expect(result).toBe(0);
    });
  });

  // ────────────────────────────────────────
  // ADMIN – bulkHardDelete
  // ────────────────────────────────────────
  describe('bulkHardDelete', () => {
    it('should permanently delete multiple positions', async () => {
      (PositionModel.deleteMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 3 });

      const ids = ['pos-1', 'pos-2', 'pos-3'];
      const result = await repo.bulkHardDelete(ids);

      expect(PositionModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ids },
      });
      expect(result).toBe(3);
    });

    it('should return 0 when no positions matched', async () => {
      (PositionModel.deleteMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.bulkHardDelete(['ghost']);

      expect(result).toBe(0);
    });

    it('should handle empty array', async () => {
      (PositionModel.deleteMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.bulkHardDelete([]);

      expect(PositionModel.deleteMany).toHaveBeenCalledWith({
        _id: { $in: [] },
      });
      expect(result).toBe(0);
    });
  });
});
