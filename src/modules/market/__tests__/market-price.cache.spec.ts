import { MarketPriceCache } from '../market-price.cache';
import { TickerData } from 'src/shared/types/okx.type';

describe('MarketPriceCache', () => {
  let cache: MarketPriceCache;

  const mockTicker: TickerData = {
    instId: 'BTC-USDT',
    last: '50000',
    askPx: '50001',
    bidPx: '49999',
    ts: '123456789',
    // ... các trường khác có thể gán chuỗi rỗng
  } as TickerData;

  beforeEach(() => {
    cache = new MarketPriceCache();
  });

  it('should store and retrieve ticker data', () => {
    cache.update(mockTicker);
    expect(cache.get('BTC-USDT')).toEqual(mockTicker);
  });

  it('should return undefined for non-existent symbol', () => {
    expect(cache.get('ETH-USDT')).toBeUndefined();
  });

  it('should return numeric bid and ask prices', () => {
    cache.update(mockTicker);
    expect(cache.getBidPrice('BTC-USDT')).toBe(49999);
    expect(cache.getAskPrice('BTC-USDT')).toBe(50001);
  });

  it('should return 0 for bid/ask if symbol not cached', () => {
    expect(cache.getBidPrice('UNKNOWN')).toBe(0);
    expect(cache.getAskPrice('UNKNOWN')).toBe(0);
  });

  it('should update existing ticker data', () => {
    cache.update(mockTicker);
    const updatedTicker = { ...mockTicker, last: '51000', bidPx: '50999' };
    cache.update(updatedTicker);

    expect(cache.getBidPrice('BTC-USDT')).toBe(50999);
    expect(cache.get('BTC-USDT')?.last).toBe('51000');
  });
});
