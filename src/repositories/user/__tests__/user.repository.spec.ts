import { UserRepository } from '../user.repository';
import { UserModel } from '../user.model';
import { User } from 'src/shared/types/user.type';

// Mock UserModel
jest.mock('../user.model');

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

describe('UserRepository', () => {
  let repo: UserRepository;

  const mockUser: User = {
    walletAddress: '0xabc123',
    isActive: true,
    role: 'user',
    chainId: 1,
  };

  const baseQuery = { deletedAt: null };

  beforeEach(() => {
    repo = new UserRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // QUERY – findByWallet
  // ────────────────────────────────────────
  describe('findByWallet', () => {
    it('should return user by wallet address (lowercased)', async () => {
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      const result = await repo.findByWallet('0xABC123');

      expect(UserModel.findOne).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        ...baseQuery,
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findByWallet('0xunknown');

      expect(result).toBeNull();
    });

    it('should not return soft-deleted users', async () => {
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      await repo.findByWallet('0xdeleted');

      expect(UserModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
    });
  });

  // ────────────────────────────────────────
  // QUERY – findById
  // ────────────────────────────────────────
  describe('findById', () => {
    it('should return user by MongoDB _id', async () => {
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      const result = await repo.findById('64a1b2c3d4e5f6a7b8c9d0e1');

      expect(UserModel.findOne).toHaveBeenCalledWith({
        _id: '64a1b2c3d4e5f6a7b8c9d0e1',
        ...baseQuery,
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when id does not exist', async () => {
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted users', async () => {
      (UserModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      await repo.findById('64a1b2c3d4e5f6a7b8c9d0e1');

      expect(UserModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAll
  // ────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results with default params', async () => {
      const users = [mockUser];
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn(users));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(1);

      const result = await repo.findAll();

      expect(UserModel.find).toHaveBeenCalledWith({ ...baseQuery });
      expect(UserModel.countDocuments).toHaveBeenCalledWith({ ...baseQuery });
      expect(result).toEqual({ data: users, total: 1, page: 1, limit: 20 });
    });

    it('should apply walletAddress filter (lowercased)', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAll({ walletAddress: '0xUPPER' });

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper', ...baseQuery }),
      );
    });

    it('should apply role filter', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAll({ role: 'admin' });

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin', ...baseQuery }),
      );
    });

    it('should apply isActive filter', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAll({ isActive: false });

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, ...baseQuery }),
      );
    });

    it('should apply chainId filter', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAll({ chainId: 56 });

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: 56, ...baseQuery }),
      );
    });

    it('should exclude soft-deleted users', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAll();

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
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
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ sort: mockSort });
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(50);

      const result = await repo.findAll({}, 3, 10);

      // skip = (3-1) * 10 = 20
      const skipFn = mockSort.mock.results[0].value.skip;
      expect(skipFn).toHaveBeenCalledWith(20);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });
  });

  // ────────────────────────────────────────
  // QUERY – findAllIncludeDeleted
  // ────────────────────────────────────────
  describe('findAllIncludeDeleted', () => {
    it('should return all users including soft-deleted', async () => {
      const users = [mockUser];
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn(users));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(1);

      const result = await repo.findAllIncludeDeleted();

      // Không có baseQuery (deletedAt: null)
      expect(UserModel.find).toHaveBeenCalledWith({});
      expect(result).toEqual({ data: users, total: 1, page: 1, limit: 20 });
    });

    it('should NOT include deletedAt filter', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllIncludeDeleted();

      const calledQuery = (UserModel.find as jest.Mock).mock.calls[0][0];
      expect(calledQuery).not.toHaveProperty('deletedAt');
    });

    it('should apply walletAddress filter (lowercased)', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllIncludeDeleted({ walletAddress: '0xMIXED' });

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
      );
    });

    it('should apply role filter', async () => {
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockChainReturn([]));
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      await repo.findAllIncludeDeleted({ role: 'admin' });

      expect(UserModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
      );
    });

    it('should calculate correct pagination', async () => {
      const mockSort = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (UserModel.find as jest.Mock) = jest
        .fn()
        .mockReturnValue({ sort: mockSort });
      (UserModel.countDocuments as jest.Mock) = jest
        .fn()
        .mockResolvedValue(100);

      const result = await repo.findAllIncludeDeleted({}, 5, 15);

      // skip = (5-1) * 15 = 60
      const skipFn = mockSort.mock.results[0].value.skip;
      expect(skipFn).toHaveBeenCalledWith(60);
      expect(result.page).toBe(5);
      expect(result.limit).toBe(15);
    });
  });

  // ────────────────────────────────────────
  // QUERY – count
  // ────────────────────────────────────────
  describe('count', () => {
    it('should count active (non-deleted) users with empty filter', async () => {
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(42);

      const result = await repo.count();

      expect(UserModel.countDocuments).toHaveBeenCalledWith({
        ...baseQuery,
      });
      expect(result).toBe(42);
    });

    it('should count users matching filter (merged with baseQuery)', async () => {
      (UserModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(5);

      const result = await repo.count({ role: 'admin' });

      expect(UserModel.countDocuments).toHaveBeenCalledWith({
        ...baseQuery,
        role: 'admin',
      });
      expect(result).toBe(5);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – create
  // ────────────────────────────────────────
  describe('create', () => {
    it('should create a new user with lowercased wallet', async () => {
      (UserModel.create as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

      const result = await repo.create('0xABC123', 1);

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

      const result = await repo.create('0xABC123');

      expect(UserModel.create).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
        chainId: undefined,
      });
      expect(result).toEqual(userWithoutChain);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should upsert user data with lowercased wallet', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      const updateData: Partial<User> = { isActive: true, role: 'admin' };
      const result = await repo.upsert('0xABC123', updateData);

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
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(newUser));

      const result = await repo.upsert('0xDEF456', { isActive: true });

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xdef456' },
        expect.objectContaining({ $setOnInsert: { deletedAt: null } }),
        { upsert: true, new: true },
      );
      expect(result).toEqual(newUser);
    });
  });

  // ────────────────────────────────────────
  // MUTATION – softDelete
  // ────────────────────────────────────────
  describe('softDelete', () => {
    it('should set deletedAt and deactivate user', async () => {
      const now = new Date('2026-02-23T15:00:00Z');
      jest.useFakeTimers({ now });

      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.softDelete('0xABC123');

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

      await repo.softDelete('0xUPPER');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xupper' },
        expect.anything(),
      );
    });

    it('should return void', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repo.softDelete('0xabc');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // MUTATION – restore
  // ────────────────────────────────────────
  describe('restore', () => {
    it('should restore user by clearing deletedAt and activating', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.restore('0xABC123');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { deletedAt: null, isActive: true } },
      );
    });

    it('should lowercase wallet address', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.restore('0xMIXEDcase');

      expect(UserModel.updateOne).toHaveBeenCalledWith(
        { walletAddress: '0xmixedcase' },
        expect.anything(),
      );
    });

    it('should return void', async () => {
      (UserModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repo.restore('0xabc');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // ADMIN – updateUser
  // ────────────────────────────────────────
  describe('updateUser', () => {
    it('should update partial user data with $set', async () => {
      const updated = { ...mockUser, role: 'admin' as const };
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.updateUser('0xABC123', {
        role: 'admin',
      });

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { role: 'admin' } },
        { new: true },
      );
      expect(result).toEqual(updated);
    });

    it('should allow updating multiple fields', async () => {
      const updated = {
        ...mockUser,
        isActive: false,
        chainId: 56,
      };
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      await repo.updateUser('0xABC123', {
        isActive: false,
        chainId: 56,
      });

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { isActive: false, chainId: 56 } },
        expect.anything(),
      );
    });

    it('should return null when user not found', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.updateUser('0xghost', { role: 'admin' });

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      await repo.updateUser('0xMIXED', { role: 'user' });

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – setRole
  // ────────────────────────────────────────
  describe('setRole', () => {
    it('should set user role to admin', async () => {
      const updated = { ...mockUser, role: 'admin' as const };
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(updated));

      const result = await repo.setRole('0xABC123', 'admin');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { role: 'admin' } },
        { new: true },
      );
      expect(result!.role).toBe('admin');
    });

    it('should set user role to user', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      const result = await repo.setRole('0xABC123', 'user');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { role: 'user' } },
        { new: true },
      );
      expect(result!.role).toBe('user');
    });

    it('should return null when user not found', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.setRole('0xghost', 'admin');

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      await repo.setRole('0xUPPER', 'admin');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – activate
  // ────────────────────────────────────────
  describe('activate', () => {
    it('should set isActive to true', async () => {
      const activated = { ...mockUser, isActive: true };
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(activated));

      const result = await repo.activate('0xABC123');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { isActive: true } },
        { new: true },
      );
      expect(result!.isActive).toBe(true);
    });

    it('should return null when user not found', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.activate('0xghost');

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      await repo.activate('0xMIXED');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xmixed' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – deactivate
  // ────────────────────────────────────────
  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      const deactivated = { ...mockUser, isActive: false };
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(deactivated));

      const result = await repo.deactivate('0xABC123');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        { walletAddress: '0xabc123' },
        { $set: { isActive: false } },
        { new: true },
      );
      expect(result!.isActive).toBe(false);
    });

    it('should return null when user not found', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.deactivate('0xghost');

      expect(result).toBeNull();
    });

    it('should lowercase wallet address', async () => {
      (UserModel.findOneAndUpdate as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockUser));

      await repo.deactivate('0xUPPER');

      expect(UserModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xupper' }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ────────────────────────────────────────
  // ADMIN – hardDelete
  // ────────────────────────────────────────
  describe('hardDelete', () => {
    it('should return true when user is deleted', async () => {
      (UserModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      const result = await repo.hardDelete('0xABC123');

      expect(UserModel.deleteOne).toHaveBeenCalledWith({
        walletAddress: '0xabc123',
      });
      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      (UserModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 0 });

      const result = await repo.hardDelete('0xghost');

      expect(result).toBe(false);
    });

    it('should lowercase wallet address', async () => {
      (UserModel.deleteOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ deletedCount: 1 });

      await repo.hardDelete('0xDELETE_ME');

      expect(UserModel.deleteOne).toHaveBeenCalledWith(
        expect.objectContaining({ walletAddress: '0xdelete_me' }),
      );
    });
  });
});
