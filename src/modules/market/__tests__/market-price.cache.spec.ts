import { Test, TestingModule } from '@nestjs/testing';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { MarketPriceCache } from '../market-price.cache';
import { TickerData } from 'src/shared/types/okx.type';

describe('MarketPriceCache', () => {
  let cache: MarketPriceCache;
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
        MarketPriceCache,
        {
          provide: getRedisConnectionToken('default'),
          useValue: mockRedis,
        },
      ],
    }).compile();

    cache = module.get<MarketPriceCache>(MarketPriceCache);
    redis = module.get(getRedisConnectionToken('default'));
  });

  it('should store and retrieve ticker data', async () => {
    redis.get.mockResolvedValue(JSON.stringify(mockTicker));

    await cache.update(mockTicker);
    expect(redis.set).toHaveBeenCalledWith(
      'market:price:BTC-USDT',
      JSON.stringify(mockTicker),
    );
    expect(redis.publish).toHaveBeenCalledWith(
      'market:prices',
      JSON.stringify(mockTicker),
    );

    const result = await cache.get('BTC-USDT');
    expect(result).toEqual(mockTicker);
  });

  it('should return undefined for non-existent symbol', async () => {
    redis.get.mockResolvedValue(null);
    expect(await cache.get('ETH-USDT')).toBeUndefined();
  });

  it('should return numeric bid and ask prices', async () => {
    redis.get.mockResolvedValue(JSON.stringify(mockTicker));
    expect(await cache.getBidPrice('BTC-USDT')).toBe(49999);
    expect(await cache.getAskPrice('BTC-USDT')).toBe(50001);
  });

  it('should return 0 for bid/ask if symbol not cached', async () => {
    redis.get.mockResolvedValue(null);
    expect(await cache.getBidPrice('UNKNOWN')).toBe(0);
    expect(await cache.getAskPrice('UNKNOWN')).toBe(0);
  });

  it('should update existing ticker data', async () => {
    const updatedTicker = { ...mockTicker, last: '51000', bidPx: '50999' };
    redis.get.mockResolvedValue(JSON.stringify(updatedTicker));

    await cache.update(updatedTicker);
    expect(await cache.getBidPrice('BTC-USDT')).toBe(50999);
    const result = await cache.get('BTC-USDT');
    expect(result?.last).toBe('51000');
  });
});
