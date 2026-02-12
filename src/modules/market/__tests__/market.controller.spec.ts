import { Test, TestingModule } from '@nestjs/testing';
import { MarketController } from '../market.controller';
import { MarketService } from '../market.service';

describe('MarketController', () => {
  let controller: MarketController;
  let service: jest.Mocked<MarketService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [
        {
          provide: MarketService,
          useValue: {
            getCandles: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MarketController>(MarketController);
    service = module.get(MarketService);
  });

  describe('getCandles', () => {
    it('nên gọi marketService.getCandles với đúng tham số', async () => {
      const mockResult = [
        { ts: '123', o: '50000', h: '51000', l: '49000', c: '50500', v: '10' },
      ];
      service.getCandles.mockResolvedValue(mockResult as any);

      const result = await controller.getCandles(
        'BTC-USDT',
        '1m',
        100,
        undefined,
      );

      expect(service.getCandles).toHaveBeenCalledWith({
        instId: 'BTC-USDT',
        bar: '1m',
        limit: 100,
        before: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it('nên xử lý chuyển đổi kiểu dữ liệu cho limit', async () => {
      await controller.getCandles('BTC-USDT', '1h', '50' as any);
      expect(service.getCandles).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        }),
      );
    });
  });
});
