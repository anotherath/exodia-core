import { PairRepository } from '../pair.repository';
import { PairModel } from '../pair.model';
import { Pair } from 'src/shared/types/pair.type';

// Mock PairModel
jest.mock('../pair.model');

describe('PairRepository', () => {
  let repository: PairRepository;

  const mockPair: Pair = {
    instId: 'BTC-USDT',
    maxLeverage: 100,
    minVolume: 10,
    openFeeRate: 0.0001,
    closeFeeRate: 0.0001,
    isActive: true,
  };

  beforeEach(() => {
    repository = new PairRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // findAllActive
  // ────────────────────────────────────────
  describe('findAllActive', () => {
    it('should return all active pairs', async () => {
      const mockLean = jest.fn().mockResolvedValue([mockPair]);
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findAllActive();

      expect(PairModel.find).toHaveBeenCalledWith({ isActive: true });
      expect(mockLean).toHaveBeenCalled();
      expect(result).toEqual([mockPair]);
    });

    it('should return empty array when no active pairs', async () => {
      const mockLean = jest.fn().mockResolvedValue([]);
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findAllActive();

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────
  // findByInstId
  // ────────────────────────────────────────
  describe('findByInstId', () => {
    it('should return pair by instId', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockPair);
      (PairModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findByInstId('BTC-USDT');

      expect(PairModel.findOne).toHaveBeenCalledWith({ instId: 'BTC-USDT' });
      expect(result).toEqual(mockPair);
    });

    it('should return null when pair not found', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (PairModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findByInstId('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should upsert pair data', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockPair);
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.upsert(mockPair);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: mockPair.instId },
        { $set: mockPair },
        { upsert: true, new: true },
      );
      expect(result).toEqual(mockPair);
    });

    it('should create new pair if not exists', async () => {
      const newPair: Pair = {
        instId: 'ETH-USDT',
        maxLeverage: 50,
        minVolume: 5,
        openFeeRate: 0.0002,
        closeFeeRate: 0.0002,
        isActive: true,
      };
      const mockLean = jest.fn().mockResolvedValue(newPair);
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.upsert(newPair);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'ETH-USDT' },
        { $set: newPair },
        { upsert: true, new: true },
      );
      expect(result).toEqual(newPair);
    });
  });

  // ────────────────────────────────────────
  // updateStatus
  // ────────────────────────────────────────
  describe('updateStatus', () => {
    it('should deactivate a pair', async () => {
      const deactivatedPair = { ...mockPair, isActive: false };
      const mockLean = jest.fn().mockResolvedValue(deactivatedPair);
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.updateStatus('BTC-USDT', false);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { isActive: false } },
        { new: true },
      );
      expect(result).toEqual(deactivatedPair);
    });

    it('should activate a pair', async () => {
      const activatedPair = { ...mockPair, isActive: true };
      const mockLean = jest.fn().mockResolvedValue(activatedPair);
      (PairModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.updateStatus('BTC-USDT', true);

      expect(PairModel.findOneAndUpdate).toHaveBeenCalledWith(
        { instId: 'BTC-USDT' },
        { $set: { isActive: true } },
        { new: true },
      );
      expect(result).toEqual(activatedPair);
    });
  });

  // ────────────────────────────────────────
  // delete
  // ────────────────────────────────────────
  describe('delete', () => {
    it('should delete a pair by instId', async () => {
      const deleteResult = { deletedCount: 1, acknowledged: true };
      (PairModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue(deleteResult);

      const result = await repository.delete('BTC-USDT');

      expect(PairModel.deleteOne).toHaveBeenCalledWith({ instId: 'BTC-USDT' });
      expect(result).toEqual(deleteResult);
    });

    it('should return deletedCount 0 if pair not found', async () => {
      const deleteResult = { deletedCount: 0, acknowledged: true };
      (PairModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue(deleteResult);

      const result = await repository.delete('UNKNOWN');

      expect(PairModel.deleteOne).toHaveBeenCalledWith({ instId: 'UNKNOWN' });
      expect(result.deletedCount).toBe(0);
    });
  });

  // ────────────────────────────────────────
  // findAll
  // ────────────────────────────────────────
  describe('findAll', () => {
    it('should return all pairs (active and inactive)', async () => {
      const inactivePair = { ...mockPair, instId: 'ETH-USDT', isActive: false };
      const allPairs = [mockPair, inactivePair];
      const mockLean = jest.fn().mockResolvedValue(allPairs);
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findAll();

      expect(PairModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual(allPairs);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no pairs exist', async () => {
      const mockLean = jest.fn().mockResolvedValue([]);
      (PairModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });
});
