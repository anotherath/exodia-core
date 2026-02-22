import { Test, TestingModule } from '@nestjs/testing';
import { RealTimeService } from '../realtime-market.service';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { RealTimeGateway } from '../realtime-market.gateway';
import { MarketPriceCache } from '../market-price.cache';
import { PairService } from '../../pair/pair.service';
import { TickerData } from 'src/shared/types/okx.type';

describe('RealTimeService', () => {
  let service: RealTimeService;
  let okxWs: OkxWs;
  let gateway: RealTimeGateway;
  let cache: MarketPriceCache;
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
  };

  const mockPairService = {
    getAllActive: jest.fn().mockResolvedValue([{ instId: 'BTC-USDT' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealTimeService,
        { provide: OkxWs, useValue: mockOkxWs },
        { provide: RealTimeGateway, useValue: mockGateway },
        { provide: MarketPriceCache, useValue: mockCache },
        { provide: PairService, useValue: mockPairService },
      ],
    }).compile();

    service = module.get<RealTimeService>(RealTimeService);
    okxWs = module.get<OkxWs>(OkxWs);
    gateway = module.get<RealTimeGateway>(RealTimeGateway);
    cache = module.get<MarketPriceCache>(MarketPriceCache);
    pairService = module.get<PairService>(PairService);

    jest.clearAllMocks();
  });

  it('should connect to OKX WSS and subscribe to active pairs on init', async () => {
    await service.onModuleInit();

    expect(okxWs.connect).toHaveBeenCalled();
    expect(pairService.getAllActive).toHaveBeenCalled();
    expect(okxWs.subscribe).toHaveBeenCalledWith(['BTC-USDT']);
  });

  it('should update cache and emit ticker when a new ticker arrives', async () => {
    // Lấy callback được truyền vào okxWs.connect
    await service.onModuleInit();
    const onTickerCallback = mockOkxWs.connect.mock.calls[0][0];

    const mockTicker = { instId: 'BTC-USDT', last: '50000' } as TickerData;

    // Giả lập OKX bắn giá về
    await onTickerCallback(mockTicker);

    expect(cache.update).toHaveBeenCalledWith(mockTicker);
    expect(gateway.emitTicker).toHaveBeenCalledWith(mockTicker);
  });
});
