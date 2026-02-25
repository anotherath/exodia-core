import { PairRepository } from '../pair.repository';
import { PairModel } from '../pair.model';
import { Pair } from 'src/shared/types/pair.type';

// Mock PairModel
jest.mock('../pair.model');

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

describe('PairRepository', () => {
  let repo: PairRepository;

  const mockPair: Pair = {
    instId: 'BTC-USDT',
    maxLeverage: 100,
    minVolume: 10,
    minAmount: 10,
    openFeeRate: 0.0001,
    closeFeeRate: 0.0001,
    isActive: true,
  };

  const mockPairETH: Pair = {
    instId: 'ETH-USDT',
    maxLeverage: 50,
    minVolume: 5,
    minAmount: 5,
    openFeeRate: 0.0002,
    closeFeeRate: 0.0002,
    isActive: true,
  };

  beforeEach(() => {
    repo = new PairRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // QUERY – findAllActive
  // ────────────────────────────────────────
  describe('findAllActive', () => {
    it('should return all active pairs', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([mockPair]));

      const result = await repo.findAllActive();

      expect(PairModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual([mockPair]);
    });

    it('should return empty array when no active pairs', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([]));

      const result = await repo.findAllActive();

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────
  // QUERY – findByInstId
  // ────────────────────────────────────────
  describe('findByInstId', () => {
    it('should return pair by instId', async () => {
      (PairModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockPair));

      const result = await repo.findByInstId('BTC-USDT');

      expect(PairModel.findOne).toHaveBeenCalledWith({ instId: 'BTC-USDT' });
      expect(result).toEqual(mockPair);
    });

    it('should return null when pair not found', async () => {
      (PairModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findByInstId('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // QUERY – findById
  // ────────────────────────────────────────
  describe('findById', () => {
    it('should return pair by MongoDB _id', async () => {
      (PairModel.findById as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockPair));

      const result = await repo.findById('64a1b2c3d4e5f6a7b8c9d0e1');

      expect(PairModel.findById).toHaveBeenCalledWith(
        '64a1b2c3d4e5f6a7b8c9d0e1',
      );
      expect(result).toEqual(mockPair);
    });

    it('should return null when id does not exist', async () => {
      (PairModel.findById as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAll
  // ────────────────────────────────────────
  describe('findAll', () => {
    it('should return all pairs (active and inactive)', async () => {
      const inactivePair = { ...mockPair, instId: 'ETH-USDT', isActive: false };
      const allPairs = [mockPair, inactivePair];
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(allPairs));

      const result = await repo.findAll();

      expect(PairModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(allPairs);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no pairs exist', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn([]));

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAllPaginated
  // ────────────────────────────────────────
  describe('findAllPaginated', () => {
    it('should return paginated results with default params', async () => {
      const pairs = [mockPair];
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn(pairs));
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(1);

      const result = await repo.findAllPaginated();

      expect(PairModel.find).toHaveBeenCalledWith({});
      expect(PairModel.countDocuments).toHaveBeenCalledWith({});
      expect(result).toEqual({ data: pairs, total: 1, page: 1, limit: 20 });
    });

    it('should apply instId filter', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllPaginated({ instId: 'BTC-USDT' });

      expect(PairModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ instId: 'BTC-USDT' }),
      );
    });

    it('should apply isActive filter', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllPaginated({ isActive: false });

      expect(PairModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should apply minLeverage and maxLeverage filters', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllPaginated({ minLeverage: 10, maxLeverage: 100 });

      expect(PairModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          maxLeverage: { $gte: 10, $lte: 100 },
        }),
      );
    });

    it('should apply only minLeverage when maxLeverage is absent', async () => {
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllPaginated({ minLeverage: 20 });

      expect(PairModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          maxLeverage: { $gte: 20 },
        }),
      );
    });

    it('should calculate correct skip for page 2 with limit 5', async () => {
      const mockSort = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ sort: mockSort });
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(20);

      const result = await repo.findAllPaginated({}, 2, 5);

      // skip = (2-1) * 5 = 5
      const skipFn = mockSort.mock.results[0].value.skip;
      expect(skipFn).toHaveBeenCalledWith(5);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });

  // ────────────────────────────────────────
  // QUERY – count
  // ────────────────────────────────────────
  describe('count', () => {
    it('should count all pairs with empty filter', async () => {
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(10);

      const result = await repo.count();

      expect(PairModel.countDocuments).toHaveBeenCalledWith({});
      expect(result).toBe(10);
    });

    it('should count pairs matching filter', async () => {
      (PairModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(3);

      const result = await repo.count({ isActive: true });

      expect(PairModel.countDocuments).toHaveBeenCalledWith({ isActive: true });
      expect(result).toBe(3);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should upsert pair data', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockPair));

      const result = await repo.upsert(mockPair);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: mockPair.instId },
        { $set: mockPair },
        { upsert: true, new: true },
      );
      expect(result).toEqual(mockPair);
    });

    it('should create new pair if not exists', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockPairETH));

      const result = await repo.upsert(mockPairETH);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'ETH-USDT' },
        { $set: mockPairETH },
        { upsert: true, new: true },
      );
      expect(result).toEqual(mockPairETH);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – updateStatus
  // ────────────────────────────────────────
  describe('updateStatus', () => {
    it('should deactivate a pair', async () => {
      const deactivated = { ...mockPair, isActive: false };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(deactivated));

      const result = await repo.updateStatus('BTC-USDT', false);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { isActive: false } },
        { new: true },
      );
      expect(result).toEqual(deactivated);
    });

    it('should activate a pair', async () => {
      const activated = { ...mockPair, isActive: true };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(activated));

      const result = await repo.updateStatus('BTC-USDT', true);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { isActive: true } },
        { new: true },
      );
      expect(result).toEqual(activated);
    });

    it('should return null when pair not found', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.updateStatus('UNKNOWN', true);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // MUTATION – delete
  // ────────────────────────────────────────
  describe('delete', () => {
    it('should delete a pair by instId', async () => {
      const deleteResult = { deletedCount: 1, acknowledged: true };
      (PairModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue(deleteResult);

      const result = await repo.delete('BTC-USDT');

      expect(PairModel.deleteOne).toHaveBeenCalledWith({ instId: 'BTC-USDT' });
      expect(result).toEqual(deleteResult);
    });

    it('should return deletedCount 0 if pair not found', async () => {
      const deleteResult = { deletedCount: 0, acknowledged: true };
      (PairModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue(deleteResult);

      const result = await repo.delete('UNKNOWN');

      expect(PairModel.deleteOne).toHaveBeenCalledWith({ instId: 'UNKNOWN' });
      expect(result.deletedCount).toBe(0);
    });
  });

  // ────────────────────────────────────────
  // ADMIN – updatePair
  // ────────────────────────────────────────
  describe('updatePair', () => {
    it('should update partial pair data with $set', async () => {
      const updated = { ...mockPair, maxLeverage: 50, minVolume: 20 };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.updatePair('BTC-USDT', {
        maxLeverage: 50,
        minVolume: 20,
      });

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { maxLeverage: 50, minVolume: 20 } },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should allow updating a single field', async () => {
      const updated = { ...mockPair, openFeeRate: 0.0005 };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      await repo.updatePair('BTC-USDT', { openFeeRate: 0.0005 });

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { openFeeRate: 0.0005 } },
        expect.anything(),
      );
    });

    it('should return null when pair not found', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.updatePair('UNKNOWN', { maxLeverage: 50 });

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setMaxLeverage
  // ────────────────────────────────────────
  describe('setMaxLeverage', () => {
    it('should set maxLeverage for a pair', async () => {
      const updated = { ...mockPair, maxLeverage: 200 };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setMaxLeverage('BTC-USDT', 200);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { maxLeverage: 200 } },
        { new: true },
      );
      expect(result!.maxLeverage).toBe(200);
    });

    it('should return null when pair not found', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setMaxLeverage('UNKNOWN', 50);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setFeeRates
  // ────────────────────────────────────────
  describe('setFeeRates', () => {
    it('should set both openFeeRate and closeFeeRate', async () => {
      const updated = {
        ...mockPair,
        openFeeRate: 0.0005,
        closeFeeRate: 0.0003,
      };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setFeeRates('BTC-USDT', 0.0005, 0.0003);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { openFeeRate: 0.0005, closeFeeRate: 0.0003 } },
        { new: true },
      );
      expect(result!.openFeeRate).toBe(0.0005);
      expect(result!.closeFeeRate).toBe(0.0003);
    });

    it('should return null when pair not found', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setFeeRates('UNKNOWN', 0.001, 0.001);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setMinimums
  // ────────────────────────────────────────
  describe('setMinimums', () => {
    it('should set both minVolume and minAmount', async () => {
      const updated = { ...mockPair, minVolume: 25, minAmount: 50 };
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setMinimums('BTC-USDT', 25, 50);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { minVolume: 25, minAmount: 50 } },
        { new: true },
      );
      expect(result!.minVolume).toBe(25);
      expect(result!.minAmount).toBe(50);
    });

    it('should return null when pair not found', async () => {
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setMinimums('UNKNOWN', 1, 1);

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – bulkActivate
  // ────────────────────────────────────────
  describe('bulkActivate', () => {
    it('should activate multiple pairs and return modifiedCount', async () => {
      (PairModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 3 });

      const instIds = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
      const result = await repo.bulkActivate(instIds);

      expect(PairModel.updateMany).toHaveBeenCalledWith(
        { instId: { $in: instIds } },
        { $set: { isActive: true } },
      );
      expect(result).toBe(3);
    });

    it('should return 0 when no pairs matched', async () => {
      (PairModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.bulkActivate(['UNKNOWN-1', 'UNKNOWN-2']);

      expect(result).toBe(0);
    });

    it('should handle empty array', async () => {
      (PairModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.bulkActivate([]);

      expect(PairModel.updateMany).toHaveBeenCalledWith(
        { instId: { $in: [] } },
        { $set: { isActive: true } },
      );
      expect(result).toBe(0);
    });
  });

  // ────────────────────────────────────────
  // ADMIN – bulkDeactivate
  // ────────────────────────────────────────
  describe('bulkDeactivate', () => {
    it('should deactivate multiple pairs and return modifiedCount', async () => {
      (PairModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 2 });

      const instIds = ['BTC-USDT', 'ETH-USDT'];
      const result = await repo.bulkDeactivate(instIds);

      expect(PairModel.updateMany).toHaveBeenCalledWith(
        { instId: { $in: instIds } },
        { $set: { isActive: false } },
      );
      expect(result).toBe(2);
    });

    it('should return 0 when no pairs matched', async () => {
      (PairModel.updateMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 0 });

      const result = await repo.bulkDeactivate(['UNKNOWN']);

      expect(result).toBe(0);
    });
  });

  // ────────────────────────────────────────
  // ADMIN – bulkDelete
  // ────────────────────────────────────────
  describe('bulkDelete', () => {
    it('should delete multiple pairs and return deletedCount', async () => {
      (PairModel.deleteMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 3 });

      const instIds = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'];
      const result = await repo.bulkDelete(instIds);

      expect(PairModel.deleteMany).toHaveBeenCalledWith({
        instId: { $in: instIds },
      });
      expect(result).toBe(3);
    });

    it('should return 0 when no pairs matched', async () => {
      (PairModel.deleteMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.bulkDelete(['UNKNOWN']);

      expect(result).toBe(0);
    });

    it('should handle empty array', async () => {
      (PairModel.deleteMany as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.bulkDelete([]);

      expect(PairModel.deleteMany).toHaveBeenCalledWith({
        instId: { $in: [] },
      });
      expect(result).toBe(0);
    });
  });
});
