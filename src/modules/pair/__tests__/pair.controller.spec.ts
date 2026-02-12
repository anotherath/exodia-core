import { Test, TestingModule } from '@nestjs/testing';
import { PairController } from '../pair.controller';
import { PairService } from '../pair.service';
import { Pair } from 'src/shared/types/pair.type';

describe('PairController', () => {
  let controller: PairController;
  let service: jest.Mocked<PairService>;

  const mockPair: Pair = {
    instId: 'BTC-USDT',
    instType: 'SPOT',
    isActive: true,
  } as unknown as Pair;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PairController],
      providers: [
        {
          provide: PairService,
          useValue: {
            getAll: jest.fn(),
            getAllActive: jest.fn(),
            upsertPair: jest.fn(),
            updateStatus: jest.fn(),
            deletePair: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PairController>(PairController);
    service = module.get(PairService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAll', () => {
    it('应返回所有交易对', async () => {
      service.getAll.mockResolvedValue([mockPair] as any);
      const result = await controller.getAll();
      expect(service.getAll).toHaveBeenCalled();
      expect(result).toEqual([mockPair]);
    });
  });

  describe('getAllActive', () => {
    it('应返回所有激活的交易对', async () => {
      service.getAllActive.mockResolvedValue([mockPair] as any);
      const result = await controller.getAllActive();
      expect(service.getAllActive).toHaveBeenCalled();
      expect(result).toEqual([mockPair]);
    });
  });

  describe('upsert', () => {
    it('应更新或插入交易对', async () => {
      service.upsertPair.mockResolvedValue(mockPair as any);
      const result = await controller.upsert(mockPair);
      expect(service.upsertPair).toHaveBeenCalledWith(mockPair);
      expect(result).toEqual(mockPair);
    });
  });

  describe('updateStatus', () => {
    it('应更新交易对状态', async () => {
      service.updateStatus.mockResolvedValue({
        ...mockPair,
        isActive: false,
      } as any);
      const result = await controller.updateStatus('BTC-USDT', false);
      expect(service.updateStatus).toHaveBeenCalledWith('BTC-USDT', false);
      expect(result!.isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('应删除交易对', async () => {
      service.deletePair.mockResolvedValue({ success: true } as any);
      const result = await controller.delete('BTC-USDT');
      expect(service.deletePair).toHaveBeenCalledWith('BTC-USDT');
      expect(result).toEqual({ success: true });
    });
  });
});
