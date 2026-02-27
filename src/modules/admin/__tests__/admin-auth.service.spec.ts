import { AdminAuthService } from '../admin-auth.service';
import { AdminRepository } from 'src/repositories/admin/admin.repository';
import { AdminAuthCacheRepository } from 'src/repositories/cache/admin-auth.cache';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

// Mock dependencies
jest.mock('src/repositories/admin/admin.repository');
jest.mock('src/repositories/cache/admin-auth.cache');
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Import AFTER mock declaration
import * as bcrypt from 'bcryptjs';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let adminRepo: jest.Mocked<AdminRepository>;
  let adminAuthCacheRepo: jest.Mocked<AdminAuthCacheRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const mockAdmin = {
    _id: 'admin-123',
    username: 'admin',
    passwordHash: '$2a$12$hashedpassword',
    role: 'super_admin' as const,
    isActive: true,
    lastLoginAt: null,
  };

  beforeEach(() => {
    adminRepo = new AdminRepository() as jest.Mocked<AdminRepository>;
    adminAuthCacheRepo = new AdminAuthCacheRepository(
      {} as any,
    ) as jest.Mocked<AdminAuthCacheRepository>;

    // Mock cache repo methods
    adminAuthCacheRepo.getLockoutRemainingTimeSeconds = jest
      .fn()
      .mockResolvedValue(0);
    adminAuthCacheRepo.incrementFailedLogin = jest.fn().mockResolvedValue(1);
    adminAuthCacheRepo.resetFailedLogin = jest
      .fn()
      .mockResolvedValue(undefined);

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    } as any;

    service = new AdminAuthService(adminRepo, adminAuthCacheRepo, jwtService);
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────
  // login
  // ────────────────────────────────────────
  describe('login', () => {
    it('should return accessToken and admin info on successful login', async () => {
      adminRepo.findByUsername = jest.fn().mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      adminRepo.updateLastLogin = jest.fn().mockResolvedValue(undefined);

      const result = await service.login('admin', 'correct-password');

      expect(adminRepo.findByUsername).toHaveBeenCalledWith('admin');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        mockAdmin.passwordHash,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'admin-123',
        username: 'admin',
        role: 'super_admin',
        type: 'admin',
      });
      expect(adminRepo.updateLastLogin).toHaveBeenCalledWith('admin-123');
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        admin: { username: 'admin', role: 'super_admin' },
      });
    });

    it('should throw UnauthorizedException when username not found', async () => {
      adminRepo.findByUsername = jest.fn().mockResolvedValue(null);

      await expect(service.login('unknown', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when admin is inactive', async () => {
      adminRepo.findByUsername = jest
        .fn()
        .mockResolvedValue({ ...mockAdmin, isActive: false });

      await expect(service.login('admin', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      adminRepo.findByUsername = jest.fn().mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('admin', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should not reveal whether username or password is wrong', async () => {
      // Username wrong
      adminRepo.findByUsername = jest.fn().mockResolvedValue(null);
      try {
        await service.login('unknown', 'password');
      } catch (e: any) {
        expect(e.message).toBe('Tài khoản hoặc mật khẩu không đúng');
      }

      // Password wrong
      adminRepo.findByUsername = jest.fn().mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      try {
        await service.login('admin', 'wrong');
      } catch (e: any) {
        expect(e.message).toBe('Tài khoản hoặc mật khẩu không đúng');
      }
    });
  });

  // ────────────────────────────────────────
  // validateToken
  // ────────────────────────────────────────
  describe('validateToken', () => {
    it('should return admin info for valid token payload', async () => {
      adminRepo.findById = jest.fn().mockResolvedValue(mockAdmin);

      const result = await service.validateToken({
        sub: 'admin-123',
        type: 'admin',
      });

      expect(adminRepo.findById).toHaveBeenCalledWith('admin-123');
      expect(result).toEqual({
        id: 'admin-123',
        username: 'admin',
        role: 'super_admin',
      });
    });

    it('should return null for non-admin token type', async () => {
      const result = await service.validateToken({
        sub: 'user-123',
        type: 'user',
      });

      expect(result).toBeNull();
    });

    it('should return null when admin not found', async () => {
      adminRepo.findById = jest.fn().mockResolvedValue(null);

      const result = await service.validateToken({
        sub: 'deleted-123',
        type: 'admin',
      });

      expect(result).toBeNull();
    });

    it('should return null when admin is inactive', async () => {
      adminRepo.findById = jest
        .fn()
        .mockResolvedValue({ ...mockAdmin, isActive: false });

      const result = await service.validateToken({
        sub: 'admin-123',
        type: 'admin',
      });

      expect(result).toBeNull();
    });
  });

  // ────────────────────────────────────────
  // createAdmin
  // ────────────────────────────────────────
  describe('createAdmin', () => {
    it('should create a new admin with hashed password', async () => {
      adminRepo.existsByUsername = jest.fn().mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$newhashedpassword');
      adminRepo.create = jest.fn().mockResolvedValue({
        username: 'newadmin',
        role: 'operator',
      });

      const result = await service.createAdmin('newadmin', 'SecurePass123');

      expect(adminRepo.existsByUsername).toHaveBeenCalledWith('newadmin');
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123', 12);
      expect(adminRepo.create).toHaveBeenCalledWith(
        'newadmin',
        '$2a$12$newhashedpassword',
        'operator',
      );
      expect(result).toEqual({ username: 'newadmin', role: 'operator' });
    });

    it('should create admin with specified role', async () => {
      adminRepo.existsByUsername = jest.fn().mockResolvedValue(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      adminRepo.create = jest.fn().mockResolvedValue({
        username: 'support1',
        role: 'support',
      });

      const result = await service.createAdmin(
        'support1',
        'Pass123',
        'support',
      );

      expect(adminRepo.create).toHaveBeenCalledWith(
        'support1',
        'hash',
        'support',
      );
      expect(result.role).toBe('support');
    });

    it('should throw ConflictException when username already exists', async () => {
      adminRepo.existsByUsername = jest.fn().mockResolvedValue(true);

      await expect(service.createAdmin('admin', 'password')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ────────────────────────────────────────
  // changePassword
  // ────────────────────────────────────────
  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      adminRepo.findById = jest.fn().mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$newhash');
      adminRepo.updatePassword = jest.fn().mockResolvedValue(undefined);

      await service.changePassword('admin-123', 'old-pass', 'new-pass');

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'old-pass',
        mockAdmin.passwordHash,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('new-pass', 12);
      expect(adminRepo.updatePassword).toHaveBeenCalledWith(
        'admin-123',
        '$2a$12$newhash',
      );
    });

    it('should throw UnauthorizedException when admin not found', async () => {
      adminRepo.findById = jest.fn().mockResolvedValue(null);

      await expect(
        service.changePassword('ghost', 'old', 'new'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      adminRepo.findById = jest.fn().mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('admin-123', 'wrong-pass', 'new-pass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
