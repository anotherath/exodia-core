import { Test, TestingModule } from '@nestjs/testing';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { TickerData } from 'src/shared/types/okx.type';

describe('RealtimeMarketPriceRepository', () => {
  let repository: RealtimeMarketPriceRepository;
  let redis: any;

  const mockTicker: TickerData = {
    instId: 'BTC-USDT',
    last: '50000',
    askPx: '50001',
    bidPx: '49999',
    ts: '123456789',
  } as TickerData;

  beforeEach(async () => {
    const mockRedis = {
      set: jest.fn(),
      get: jest.fn(),
      publish: jest.fn(),
      keys: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeMarketPriceRepository,
        {
          provide: getRedisConnectionToken('default'),
          useValue: mockRedis,
        },
      ],
    }).compile();

    repository = module.get<RealtimeMarketPriceRepository>(
      RealtimeMarketPriceRepository,
    );
    redis = module.get(getRedisConnectionToken('default'));
  });

  it('should store and retrieve ticker data', async () => {
    redis.get.mockResolvedValue(JSON.stringify(mockTicker));

    await repository.update(mockTicker);
    expect(redis.set).toHaveBeenCalledWith(
      'market:price:BTC-USDT',
      JSON.stringify(mockTicker),
    );
    expect(redis.publish).toHaveBeenCalledWith(
      'market:prices',
      JSON.stringify(mockTicker),
    );

    const result = await repository.get('BTC-USDT');
    expect(result).toEqual(mockTicker);
  });

  it('should return undefined for non-existent symbol', async () => {
    redis.get.mockResolvedValue(null);
    expect(await repository.get('ETH-USDT')).toBeUndefined();
  });

  it('should return numeric bid and ask prices', async () => {
    redis.get.mockResolvedValue(JSON.stringify(mockTicker));
    expect(await repository.getBidPrice('BTC-USDT')).toBe(49999);
    expect(await repository.getAskPrice('BTC-USDT')).toBe(50001);
  });

  it('should return 0 for bid/ask if symbol not cached', async () => {
    redis.get.mockResolvedValue(null);
    expect(await repository.getBidPrice('UNKNOWN')).toBe(0);
    expect(await repository.getAskPrice('UNKNOWN')).toBe(0);
  });

  it('should update existing ticker data', async () => {
    const updatedTicker = { ...mockTicker, last: '51000', bidPx: '50999' };
    redis.get.mockResolvedValue(JSON.stringify(updatedTicker));

    await repository.update(updatedTicker);
    expect(await repository.getBidPrice('BTC-USDT')).toBe(50999);
    const result = await repository.get('BTC-USDT');
    expect(result?.last).toBe('51000');
  });

  describe('getAllSymbols', () => {
    it('should return list of instrument IDs by stripping prefix', async () => {
      redis.keys.mockResolvedValue([
        'market:price:BTC-USDT',
        'market:price:ETH-USDT',
      ]);

      const symbols = await repository.getAllSymbols();

      expect(symbols).toEqual(['BTC-USDT', 'ETH-USDT']);
      expect(redis.keys).toHaveBeenCalledWith('market:price:*');
    });

    it('should return empty array if no keys found', async () => {
      redis.keys.mockResolvedValue([]);

      const symbols = await repository.getAllSymbols();

      expect(symbols).toEqual([]);
    });
  });
});
