import { Test, TestingModule } from '@nestjs/testing';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import {
  MarketHistoryCacheRepository,
  OkxCandle,
} from '../market-history.cache';

describe('MarketHistoryCacheRepository', () => {
  let repository: MarketHistoryCacheRepository;
  let redis: any;

  // Helper: tạo 1 cây nến giả
  const makeCandle = (ts: number, confirm: string = '1'): OkxCandle => [
    String(ts), // ts
    '42000.0', // o
    '42100.0', // h
    '41900.0', // l
    '42050.0', // c
    '100.5', // vol
    '4200000', // volUsd
    confirm, // confirm
  ];

  beforeEach(async () => {
    const mockRedis = {
      zrevrangebyscore: jest.fn().mockResolvedValue([]),
      zadd: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zremrangebyrank: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketHistoryCacheRepository,
        {
          provide: getRedisConnectionToken('default'),
          useValue: mockRedis,
        },
      ],
    }).compile();

    repository = module.get<MarketHistoryCacheRepository>(
      MarketHistoryCacheRepository,
    );
    redis = module.get(getRedisConnectionToken('default'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ────────────────────────────────────────
  // getCandles
  // ────────────────────────────────────────
  describe('getCandles', () => {
    it('should return empty array when cache is empty', async () => {
      redis.zrevrangebyscore.mockResolvedValue([]);

      const result = await repository.getCandles('BTC-USDT', '1m', 100);

      expect(result).toEqual([]);
      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('should return parsed candles when cache has data', async () => {
      const candle = makeCandle(1708675200000);
      redis.zrevrangebyscore.mockResolvedValue([JSON.stringify(candle)]);

      const result = await repository.getCandles('BTC-USDT', '1m', 100);

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe('1708675200000');
      expect(result[0][7]).toBe('1'); // confirm
    });

    it('should renew TTL on cache hit', async () => {
      const candle = makeCandle(1708675200000);
      redis.zrevrangebyscore.mockResolvedValue([JSON.stringify(candle)]);

      await repository.getCandles('BTC-USDT', '1m', 100);

      expect(redis.expire).toHaveBeenCalledWith(
        'market:candles:history:BTC-USDT:1m',
        24 * 60 * 60,
      );
    });

    it('should use correct key format', async () => {
      await repository.getCandles('ETH-USDT', '1h', 50);

      expect(redis.zrevrangebyscore).toHaveBeenCalledWith(
        'market:candles:history:ETH-USDT:1h',
        '+inf',
        '-inf',
        'LIMIT',
        0,
        50,
      );
    });

    it('should use "before" as exclusive upper bound when provided', async () => {
      await repository.getCandles('BTC-USDT', '1m', 100, '1708675200000');

      expect(redis.zrevrangebyscore).toHaveBeenCalledWith(
        'market:candles:history:BTC-USDT:1m',
        '(1708675200000',
        '-inf',
        'LIMIT',
        0,
        100,
      );
    });
  });

  // ────────────────────────────────────────
  // addCandles
  // ────────────────────────────────────────
  describe('addCandles', () => {
    it('should do nothing when candles array is empty', async () => {
      await repository.addCandles('BTC-USDT', '1m', []);

      expect(redis.zadd).not.toHaveBeenCalled();
    });

    it('should store candles with timestamp as score', async () => {
      const candles = [makeCandle(1708675200000), makeCandle(1708675260000)];

      redis.zcard.mockResolvedValue(2);

      await repository.addCandles('BTC-USDT', '1m', candles);

      expect(redis.zadd).toHaveBeenCalledWith(
        'market:candles:history:BTC-USDT:1m',
        1708675200000,
        JSON.stringify(candles[0]),
        1708675260000,
        JSON.stringify(candles[1]),
      );
    });

    it('should trim old candles when exceeding max limit', async () => {
      const candle = makeCandle(1708675200000);
      redis.zcard.mockResolvedValue(10_001);

      await repository.addCandles('BTC-USDT', '1m', [candle]);

      expect(redis.zremrangebyrank).toHaveBeenCalledWith(
        'market:candles:history:BTC-USDT:1m',
        0,
        0, // 10001 - 10000 - 1 = 0
      );
    });

    it('should not trim when under max limit', async () => {
      const candle = makeCandle(1708675200000);
      redis.zcard.mockResolvedValue(100);

      await repository.addCandles('BTC-USDT', '1m', [candle]);

      expect(redis.zremrangebyrank).not.toHaveBeenCalled();
    });

    it('should set TTL after adding candles', async () => {
      const candle = makeCandle(1708675200000);
      redis.zcard.mockResolvedValue(1);

      await repository.addCandles('BTC-USDT', '1m', [candle]);

      expect(redis.expire).toHaveBeenCalledWith(
        'market:candles:history:BTC-USDT:1m',
        24 * 60 * 60,
      );
    });
  });

  // ────────────────────────────────────────
  // acquireLock / releaseLock
  // ────────────────────────────────────────
  describe('acquireLock', () => {
    it('should return true when lock is acquired successfully', async () => {
      redis.set.mockResolvedValue('OK');

      const result = await repository.acquireLock('BTC-USDT', '1m');

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'lock:candles:BTC-USDT:1m',
        '1',
        'PX',
        5000,
        'NX',
      );
    });

    it('should return false when lock is already held', async () => {
      redis.set.mockResolvedValue(null);

      const result = await repository.acquireLock('BTC-USDT', '1m');

      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should delete the lock key', async () => {
      await repository.releaseLock('BTC-USDT', '1m');

      expect(redis.del).toHaveBeenCalledWith('lock:candles:BTC-USDT:1m');
    });
  });
});
