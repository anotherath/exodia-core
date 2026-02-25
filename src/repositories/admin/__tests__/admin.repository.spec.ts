import { AdminRepository } from '../admin.repository';
import { AdminModel } from '../admin.model';

// Mock AdminModel
jest.mock('../admin.model');

// ─── Helper ──────────────────────────────────────
const mockLeanReturn = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe('AdminRepository', () => {
  let repo: AdminRepository;

  const mockAdmin = {
    _id: 'admin-123',
    username: 'admin',
    passwordHash: '$2a$12$hashedpassword',
    role: 'super_admin' as const,
    isActive: true,
    lastLoginAt: null,
  };

  beforeEach(() => {
    repo = new AdminRepository();
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // findByUsername
  // ────────────────────────────────────────
  describe('findByUsername', () => {
    it('should return admin by username (lowercased and trimmed)', async () => {
      (AdminModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockAdmin));

      const result = await repo.findByUsername('  ADMIN  ');

      expect(AdminModel.findOne).toHaveBeenCalledWith({
        username: 'admin',
      });
      expect(result).toEqual(mockAdmin);
    });

    it('should return null when admin not found', async () => {
      (AdminModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findByUsername('unknown');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // findById
  // ────────────────────────────────────────
  describe('findById', () => {
    it('should return active admin by id', async () => {
      (AdminModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(mockAdmin));

      const result = await repo.findById('admin-123');

      expect(AdminModel.findOne).toHaveBeenCalledWith({
        _id: 'admin-123',
        isActive: true,
      });
      expect(result).toEqual(mockAdmin);
    });

    it('should return null for inactive admin', async () => {
      (AdminModel.findOne as jest.Mock) = jest
        .fn()
        .mockReturnValue(mockLeanReturn(null));

      const result = await repo.findById('inactive-admin');

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // create
  // ────────────────────────────────────────
  describe('create', () => {
    it('should create admin with lowercased username', async () => {
      (AdminModel.create as jest.Mock) = jest.fn().mockResolvedValue(mockAdmin);

      const result = await repo.create('ADMIN', '$2a$12$hash', 'super_admin');

      expect(AdminModel.create).toHaveBeenCalledWith({
        username: 'admin',
        passwordHash: '$2a$12$hash',
        role: 'super_admin',
      });
      expect(result).toEqual(mockAdmin);
    });

    it('should default role to operator', async () => {
      (AdminModel.create as jest.Mock) = jest.fn().mockResolvedValue({
        ...mockAdmin,
        role: 'operator',
      });

      await repo.create('newadmin', '$2a$12$hash');

      expect(AdminModel.create).toHaveBeenCalledWith({
        username: 'newadmin',
        passwordHash: '$2a$12$hash',
        role: 'operator',
      });
    });
  });

  // ────────────────────────────────────────
  // updateLastLogin
  // ────────────────────────────────────────
  describe('updateLastLogin', () => {
    it('should update lastLoginAt to current time', async () => {
      const now = new Date('2026-02-25T10:00:00Z');
      jest.useFakeTimers({ now });

      (AdminModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.updateLastLogin('admin-123');

      expect(AdminModel.updateOne).toHaveBeenCalledWith(
        { _id: 'admin-123' },
        { $set: { lastLoginAt: now } },
      );

      jest.useRealTimers();
    });

    it('should return void', async () => {
      (AdminModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repo.updateLastLogin('admin-123');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // updatePassword
  // ────────────────────────────────────────
  describe('updatePassword', () => {
    it('should update passwordHash', async () => {
      (AdminModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      await repo.updatePassword('admin-123', '$2a$12$newhash');

      expect(AdminModel.updateOne).toHaveBeenCalledWith(
        { _id: 'admin-123' },
        { $set: { passwordHash: '$2a$12$newhash' } },
      );
    });

    it('should return void', async () => {
      (AdminModel.updateOne as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ modifiedCount: 1 });

      const result = await repo.updatePassword('admin-123', 'hash');

      expect(result).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // existsByUsername
  // ────────────────────────────────────────
  describe('existsByUsername', () => {
    it('should return true when username exists', async () => {
      (AdminModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(1);

      const result = await repo.existsByUsername('admin');

      expect(AdminModel.countDocuments).toHaveBeenCalledWith({
        username: 'admin',
      });
      expect(result).toBe(true);
    });

    it('should return false when username does not exist', async () => {
      (AdminModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(0);

      const result = await repo.existsByUsername('unknown');

      expect(result).toBe(false);
    });

    it('should lowercase and trim username', async () => {
      (AdminModel.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(1);

      await repo.existsByUsername('  ADMIN  ');

      expect(AdminModel.countDocuments).toHaveBeenCalledWith({
        username: 'admin',
      });
    });
  });
});
