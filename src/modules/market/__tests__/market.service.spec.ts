import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from '../market.service';
import { OkxRest } from '../../../infra/okx/okx.rest';
import { MarketHistoryCacheRepository } from '../../../repositories/cache/market-history.cache';
import { MarketValidationService } from '../market-validation.service';

describe('MarketService', () => {
  let service: MarketService;
  let okxRest: jest.Mocked<OkxRest>;
  let cacheRepo: jest.Mocked<MarketHistoryCacheRepository>;
  let marketValidation: jest.Mocked<MarketValidationService>;

  beforeEach(async () => {
    const mockOkxRest = {
      getCandles: jest.fn(),
      getHistoryCandles: jest.fn(),
    };

    const mockCacheRepo = {
      getCandles: jest.fn(),
      acquireLock: jest.fn(),
      addCandles: jest.fn(),
      releaseLock: jest.fn(),
    };

    const mockMarketValidation = {
      validateCandleParams: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: OkxRest, useValue: mockOkxRest },
        { provide: MarketHistoryCacheRepository, useValue: mockCacheRepo },
        { provide: MarketValidationService, useValue: mockMarketValidation },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
    okxRest = module.get(OkxRest);
    cacheRepo = module.get(MarketHistoryCacheRepository);
    marketValidation = module.get(MarketValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCandles', () => {
    const defaultParams = {
      instId: 'BTC-USDT',
      bar: '1m',
      limit: 2,
    };

    it('should validate params on call', async () => {
      cacheRepo.getCandles.mockResolvedValue([]);
      cacheRepo.acquireLock.mockResolvedValue(true);
      okxRest.getCandles.mockResolvedValue({ data: { data: [] } } as any);

      await service.getCandles(defaultParams);

      expect(marketValidation.validateCandleParams).toHaveBeenCalledWith(
        defaultParams,
      );
    });

    it('should return cached candles if cache meets limit', async () => {
      const mockCachedCandles: any[] = [
        ['1000', '1', '2', '0.5', '1.5', '100', '1000', '1'],
        ['2000', '1', '2', '0.5', '1.5', '100', '1000', '1'],
      ];
      cacheRepo.getCandles.mockResolvedValue(mockCachedCandles);

      const result = await service.getCandles(defaultParams);

      expect(result).toEqual(mockCachedCandles);
      expect(cacheRepo.acquireLock).not.toHaveBeenCalled();
      expect(okxRest.getCandles).not.toHaveBeenCalled();
    });

    it('should fetch from okx, filter closed candles and save to cache when cache miss', async () => {
      cacheRepo.getCandles.mockResolvedValue([]);
      cacheRepo.acquireLock.mockResolvedValue(true);
      const okxResponseData = [
        ['1000', '1', '2', '0.5', '1.5', '100', '1000', '1'], // closed
        ['2000', '1', '2', '0.5', '1.5', '100', '1000', '0'], // open
      ];
      okxRest.getCandles.mockResolvedValue({
        data: { data: okxResponseData },
      } as any);

      const result = await service.getCandles(defaultParams);

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe('1000');
      expect(cacheRepo.addCandles).toHaveBeenCalledWith('BTC-USDT', '1m', [
        okxResponseData[0],
      ]);
      expect(cacheRepo.releaseLock).toHaveBeenCalledWith('BTC-USDT', '1m');
    });

    it('should fetch history candles when before param is provided', async () => {
      cacheRepo.getCandles.mockResolvedValue([]);
      cacheRepo.acquireLock.mockResolvedValue(true);
      const okxResponseData = [
        ['1000', '1', '2', '0.5', '1.5', '100', '1000', '1'],
      ];
      okxRest.getHistoryCandles.mockResolvedValue({
        data: { data: okxResponseData },
      } as any);

      const paramsWithBefore = { ...defaultParams, before: '1000' };
      await service.getCandles(paramsWithBefore);

      expect(okxRest.getHistoryCandles).toHaveBeenCalledWith(
        'BTC-USDT',
        '1m',
        '1000',
        2,
      );
    });

    it('should wait and retry from cache if lock is blocked', async () => {
      // Return empty cache initially
      cacheRepo.getCandles.mockResolvedValueOnce([]);
      // Lock fails -> means another request is fetching
      cacheRepo.acquireLock.mockResolvedValue(false);

      // On retry, cache returns data
      const mockCachedCandles: any[] = [
        ['1000', '1', '2', '0.5', '1.5', '100', '1000', '1'],
        ['2000', '1', '2', '0.5', '1.5', '100', '1000', '1'],
      ];
      cacheRepo.getCandles.mockResolvedValueOnce(mockCachedCandles);

      const result = await service.getCandles(defaultParams);

      expect(result).toEqual(mockCachedCandles);
      expect(cacheRepo.getCandles).toHaveBeenCalledTimes(2);
      expect(okxRest.getCandles).not.toHaveBeenCalled();
    });

    it('should fallback to okx if wait and retry exhausts', async () => {
      // Cache empty every time
      cacheRepo.getCandles.mockResolvedValue([]);
      cacheRepo.acquireLock.mockResolvedValue(false);

      const okxResponseData = [
        ['1000', '1', '2', '0.5', '1.5', '100', '1000', '1'],
      ];
      okxRest.getCandles.mockResolvedValue({
        data: { data: okxResponseData },
      } as any);

      const result = await service.getCandles(defaultParams);

      expect(result).toHaveLength(1);
      // getCandles called 1 time initially + 3 times during retry = 4 times
      expect(cacheRepo.getCandles).toHaveBeenCalledTimes(4);
      expect(okxRest.getCandles).toHaveBeenCalled();
    });

    it('should use fallback duration for filtering unclosed candles if confirm flag is missing', async () => {
      cacheRepo.getCandles.mockResolvedValue([]);
      cacheRepo.acquireLock.mockResolvedValue(true);

      const now = Date.now();
      const pastTimeStr = (now - 120_000).toString(); // fully closed (older than 1 minute)
      const futureTimeStr = (now - 10_000).toString(); // still open (less than 1m old)

      // No confirm flag (index 7)
      const okxResponseData = [
        [pastTimeStr, '1', '2', '0.5', '1.5', '100', '1000'],
        [futureTimeStr, '1', '2', '0.5', '1.5', '100', '1000'],
      ];
      okxRest.getCandles.mockResolvedValue({
        data: { data: okxResponseData },
      } as any);

      const result = await service.getCandles(defaultParams);

      expect(result).toHaveLength(1);
      expect(result[0][0]).toBe(pastTimeStr);
    });
  });
});
