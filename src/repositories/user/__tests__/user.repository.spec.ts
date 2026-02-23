import { UserRepository } from '../user.repository';
import { UserModel } from '../user.model';
import { User } from 'src/shared/types/user.type';

// Mock UserModel
jest.mock('../user.model');

describe('UserRepository', () => {
  let repository: UserRepository;

  const mockUser: User = {
    walletAddress: '0xabc123',
    isActive: true,
    role: 'user',
    chainId: 1,
  };

  const baseQuery = { deletedAt: null };

  beforeEach(() => {
    repository = new UserRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // findByWallet
  // ────────────────────────────────────────
  describe('findByWallet', () => {
    it('should return user by wallet address (lowercased)', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockUser);
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findByWallet('0xABC123');

      expect(UserModel.findOne).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        ...baseQuery,
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.findByWallet('0xunknown');

      expect(result).toBeNull();
    });

    it('should not return soft-deleted users', async () => {
      const mockLean = jest.fn().mockResolvedValue(null);
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      await repository.findByWallet('0xdeleted');

      expect(UserModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
    });
  });

  // ────────────────────────────────────────
  // create
  // ────────────────────────────────────────
  describe('create', () => {
    it('should create a new user with lowercased wallet', async () => {
      (UserModel.create as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

      const result = await repository.create('0xABC123', 1);

      expect(UserModel.create).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        chainId: 1,
      });
      expect(result).toEqual(mockUser);
    });

    it('should create user without chainId', async () => {
      const userWithoutChain = { ...mockUser, chainId: undefined };
      (UserModel.create as jest.Mock) = jest
        .fn()
        .mockResolvedValue(userWithoutChain);

      const result = await repository.create('0xABC123');

      expect(UserModel.create).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        chainId: undefined,
      });
      expect(result).toEqual(userWithoutChain);
    });
  });

  // ────────────────────────────────────────
  // upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should upsert user data with lowercased wallet', async () => {
      const mockLean = jest.fn().mockResolvedValue(mockUser);
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const updateData: Partial<User> = { isActive: true, role: 'admin' };
      const result = await repository.upsert('0xABC123', updateData);

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: updateData, $setOnInsert: { deletedAt: null } },
        { upsert: true, new: true },
      );
      expect(result).toEqual(mockUser);
    });

    it('should create new user if not exists', async () => {
      const newUser: User = {
        walletAddress: '0xdef456',
        isActive: true,
        role: 'user',
        chainId: 56,
      };
      const mockLean = jest.fn().mockResolvedValue(newUser);
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue({ lean: mockLean });

      const result = await repository.upsert('0xDEF456', { isActive: true });

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xdef456' },
        expect.objectContaining({ $setOnInsert: { deletedAt: null } }),
        { upsert: true, new: true },
      );
      expect(result).toEqual(newUser);
    });
  });

  // ────────────────────────────────────────
  // softDelete
  // ────────────────────────────────────────
  describe('softDelete', () => {
    it('should set deletedAt and deactivate user', async () => {
      const now = new Date('2026-02-23T15:00:00Z');
      jest.useFakeTimers({ now });

      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repository.softDelete('0xABC123');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { deletedAt: now, isActive: false } },
      );

      jest.useRealTimers();
    });

    it('should lowercase wallet address', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repository.softDelete('0xUPPER');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xupper' },
        expect.anything(),
      );
    });

    it('should return void', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repository.softDelete('0xabc');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // restore
  // ────────────────────────────────────────
  describe('restore', () => {
    it('should restore user by clearing deletedAt and activating', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repository.restore('0xABC123');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { deletedAt: null, isActive: true } },
      );
    });

    it('should lowercase wallet address', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repository.restore('0xMIXEDcase');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xmixedcase' },
        expect.anything(),
      );
    });

    it('should return void', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repository.restore('0xabc');

      expect(result).toBeUndefined();
    });
  });
});
