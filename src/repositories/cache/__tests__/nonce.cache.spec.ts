import { Test, TestingModule } from '@nestjs/testing';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { NonceRepository } from '../nonce.cache';
import { NonceInfo } from 'src/shared/types/nonce.type';
import * as web3Util from 'src/shared/utils/web3.util';

// Mock generateNonce
jest.mock('src/shared/utils/web3.util', () => ({
  ...jest.requireActual('src/shared/utils/web3.util'),
  generateNonce: jest.fn(),
}));

describe('NonceRepository', () => {
  let repository: NonceRepository;
  let redis: any;

  const walletAddress = '0xABC123';
  const lowerWallet = '0xabc123';
  const mockNonce = 'mock-nonce-hex-value-1234';
  const TTL_SECONDS = 2 * 60; // 2 minutes

  beforeEach(async () => {
    const mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NonceRepository,
        {
          provide: getRedisConnectionToken('default'),
          useValue: mockRedis,
        },
      ],
    }).compile();

    repository = module.get<NonceRepository>(NonceRepository);
    redis = module.get(getRedisConnectionToken('default'));

    (web3Util.generateNonce as jest.Mock).mockReturnValue(mockNonce);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ────────────────────────────────────────
  // buildNonceInfo
  // ────────────────────────────────────────
  describe('buildNonceInfo', () => {
    it('should build nonce info with lowercased wallet', () => {
      const now = new Date('2026-02-23T15:00:00Z');
      jest.useFakeTimers({ now });

      const result = repository.buildNonceInfo(walletAddress);

      expect(result.walletAddress).toBe(lowerWallet);
      expect(result.nonce).toBe(mockNonce);
      expect(result.expiresAt).toEqual(
        new Date(now.getTime() + TTL_SECONDS * 1000),
      );

      jest.useRealTimers();
    });

    it('should call generateNonce', () => {
      repository.buildNonceInfo(walletAddress);

      expect(web3Util.generateNonce).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // upsert
  // ────────────────────────────────────────
  describe('upsert', () => {
    it('should store nonce in Redis with TTL', async () => {
      const now = new Date('2026-02-23T15:00:00Z');
      jest.useFakeTimers({ now });

      const result = await repository.upsert(walletAddress);

      const expectedKey = `nonce:${lowerWallet}`;
      const expectedNonceInfo: NonceInfo = {
        walletAddress: lowerWallet,
        nonce: mockNonce,
        expiresAt: new Date(now.getTime() + TTL_SECONDS * 1000),
      };

      expect(redis.set).toHaveBeenCalledWith(
        expectedKey,
        JSON.stringify(expectedNonceInfo),
        'EX',
        TTL_SECONDS,
      );
      expect(result).toEqual(expectedNonceInfo);

      jest.useRealTimers();
    });

    it('should overwrite existing nonce for same wallet', async () => {
      await repository.upsert(walletAddress);
      await repository.upsert(walletAddress);

      expect(redis.set).toHaveBeenCalledTimes(2);
    });

    it('should return the generated nonce info', async () => {
      const result = await repository.upsert(walletAddress);

      expect(result.walletAddress).toBe(lowerWallet);
      expect(result.nonce).toBe(mockNonce);
      expect(result.expiresAt).toBeDefined();
    });
  });

  // ────────────────────────────────────────
  // findValid
  // ────────────────────────────────────────
  describe('findValid', () => {
    it('should return nonce info if found in Redis', async () => {
      const nonceInfo: NonceInfo = {
        walletAddress: lowerWallet,
        nonce: mockNonce,
        expiresAt: new Date('2026-02-23T15:02:00Z'),
      };
      redis.get.mockResolvedValue(JSON.stringify(nonceInfo));

      const result = await repository.findValid(walletAddress);

      expect(redis.get).toHaveBeenCalledWith(`nonce:${lowerWallet}`);
      // JSON.parse returns expiresAt as string, not Date
      expect(result).toEqual({
        ...nonceInfo,
        expiresAt: nonceInfo.expiresAt.toISOString(),
      });
    });

    it('should return null if nonce not found (expired or never set)', async () => {
      redis.get.mockResolvedValue(null);

      const result = await repository.findValid(walletAddress);

      expect(result).toBeNull();
    });

    it('should lowercase wallet address for key lookup', async () => {
      redis.get.mockResolvedValue(null);

      await repository.findValid('0xUPPER');

      expect(redis.get).toHaveBeenCalledWith('nonce:0xupper');
    });
  });

  // ────────────────────────────────────────
  // delete
  // ────────────────────────────────────────
  describe('delete', () => {
    it('should delete nonce from Redis', async () => {
      await repository.delete(walletAddress);

      expect(redis.del).toHaveBeenCalledWith(`nonce:${lowerWallet}`);
    });

    it('should lowercase wallet address for key', async () => {
      await repository.delete('0xMIXEDcase');

      expect(redis.del).toHaveBeenCalledWith('nonce:0xmixedcase');
    });

    it('should return void', async () => {
      const result = await repository.delete(walletAddress);

      expect(result).toBeUndefined();
    });
  });
});
