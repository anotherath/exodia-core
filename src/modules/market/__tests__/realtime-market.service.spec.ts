import { Test, TestingModule } from '@nestjs/testing';
import { RealTimeService } from '../realtime-market.service';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { RealTimeGateway } from '../realtime-market.gateway';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { PairService } from '../../pair/pair.service';
import { TickerData } from 'src/shared/types/okx.type';
import { MarketValidationService } from '../market-validation.service';

describe('RealTimeService', () => {
  let service: RealTimeService;
  let okxWs: OkxWs;
  let gateway: RealTimeGateway;
  let marketPriceRepo: RealtimeMarketPriceRepository;
  let pairService: PairService;

  const mockOkxWs = {
    connect: jest.fn(),
    subscribe: jest.fn(),
  };

  const mockGateway = {
    emitTicker: jest.fn(),
  };

  const mockCache = {
    update: jest.fn(),
    get: jest.fn(),
  };

  const mockPairService = {
    getAllActive: jest.fn().mockResolvedValue([{ instId: 'BTC-USDT' }]),
  };

  const mockValidation = {
    validateTickerData: jest.fn().mockReturnValue({ valid: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealTimeService,
        { provide: OkxWs, useValue: mockOkxWs },
        { provide: RealTimeGateway, useValue: mockGateway },
        { provide: RealtimeMarketPriceRepository, useValue: mockCache },
        { provide: PairService, useValue: mockPairService },
        { provide: MarketValidationService, useValue: mockValidation },
      ],
    }).compile();

    service = module.get<RealTimeService>(RealTimeService);
    okxWs = module.get<OkxWs>(OkxWs);
    gateway = module.get<RealTimeGateway>(RealTimeGateway);
    marketPriceRepo = module.get<RealtimeMarketPriceRepository>(
      RealtimeMarketPriceRepository,
    );
    pairService = module.get<PairService>(PairService);

    jest.clearAllMocks();
  });

  it('should connect to OKX WSS and subscribe to active pairs on init', async () => {
    await service.onModuleInit();

    expect(okxWs.connect).toHaveBeenCalled();
    expect(pairService.getAllActive).toHaveBeenCalled();
    expect(okxWs.subscribe).toHaveBeenCalledWith(['BTC-USDT']);
  });

  it('should update cache and emit ticker when valid data arrives', async () => {
    mockValidation.validateTickerData.mockReturnValue({ valid: true });

    await service.onModuleInit();
    const onTickerCallback = mockOkxWs.connect.mock.calls[0][0];

    const mockTicker = {
      instId: 'BTC-USDT',
      last: '50000',
      bidPx: '49999',
      askPx: '50001',
    } as TickerData;

    await onTickerCallback(mockTicker);

    expect(marketPriceRepo.update).toHaveBeenCalledWith(mockTicker);
    expect(gateway.emitTicker).toHaveBeenCalledWith(mockTicker);
  });

  it('should drop ticker update if validation fails (e.g. crossed book)', async () => {
    await service.onModuleInit();
    const onTickerCallback = mockOkxWs.connect.mock.calls[0][0];

    mockValidation.validateTickerData.mockReturnValue({
      valid: false,
      reason: 'Crossed book detected: bid=50002 >= ask=50001',
    });

    const invalidTicker = {
      instId: 'BTC-USDT',
      last: '50000',
      bidPx: '50002',
      askPx: '50001',
    } as TickerData;

    await onTickerCallback(invalidTicker);

    expect(marketPriceRepo.update).not.toHaveBeenCalled();
    expect(gateway.emitTicker).not.toHaveBeenCalled();
  });

  it('should drop ticker update if bid is NaN', async () => {
    await service.onModuleInit();
    const onTickerCallback = mockOkxWs.connect.mock.calls[0][0];

    mockValidation.validateTickerData.mockReturnValue({
      valid: false,
      reason: 'bidPx không hợp lệ: abc',
    });

    const invalidTicker = {
      instId: 'BTC-USDT',
      last: '50000',
      bidPx: 'abc',
      askPx: '50001',
    } as TickerData;

    await onTickerCallback(invalidTicker);

    expect(marketPriceRepo.update).not.toHaveBeenCalled();
    expect(gateway.emitTicker).not.toHaveBeenCalled();
  });

  it('should accept ticker when last is null (no trades yet)', async () => {
    mockValidation.validateTickerData.mockReturnValue({ valid: true });

    await service.onModuleInit();
    const onTickerCallback = mockOkxWs.connect.mock.calls[0][0];

    const noTradeTicker = {
      instId: 'NEW-USDT',
      last: null,
      bidPx: '1.00',
      askPx: '1.01',
    } as unknown as TickerData;

    await onTickerCallback(noTradeTicker);

    expect(marketPriceRepo.update).toHaveBeenCalledWith(noTradeTicker);
    expect(gateway.emitTicker).toHaveBeenCalledWith(noTradeTicker);
  });
});
