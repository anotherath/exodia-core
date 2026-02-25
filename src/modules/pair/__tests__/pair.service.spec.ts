import { Test, TestingModule } from '@nestjs/testing';
import { PairService } from '../pair.service';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { Pair } from 'src/shared/types/pair.type';
import { PairValidationService } from '../pair-validation.service';

describe('PairService', () => {
  let service: PairService;
  let repo: PairRepository;
  let okxWs: OkxWs;
  let validation: PairValidationService;

  const mockPair: Pair = {
    instId: 'BTC-USDT',
    maxLeverage: 100,
    minVolume: 0.001,
    minAmount: 10,
    openFeeRate: 0.0001,
    closeFeeRate: 0.0001,
    isActive: true,
  };

  const mockPairRepo = {
    findAllActive: jest.fn(),
    findAll: jest.fn(),
    findByInstId: jest.fn(),
    upsert: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
  };

  const mockOkxWs = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const mockValidation = {
    validateInstId: jest.fn(),
    validateUpsertData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PairService,
        { provide: PairRepository, useValue: mockPairRepo },
        { provide: OkxWs, useValue: mockOkxWs },
        { provide: PairValidationService, useValue: mockValidation },
      ],
    }).compile();

    service = module.get<PairService>(PairService);
    repo = module.get<PairRepository>(PairRepository);
    okxWs = module.get<OkxWs>(OkxWs);
    validation = module.get<PairValidationService>(PairValidationService);

    jest.clearAllMocks();
  });

  describe('upsertPair', () => {
    it('should upsert and subscribe if pair is active', async () => {
      mockPairRepo.upsert.mockResolvedValue(mockPair);

      const result = await service.upsertPair(mockPair);

      expect(repo.upsert).toHaveBeenCalledWith(mockPair);
      expect(okxWs.subscribe).toHaveBeenCalledWith([mockPair.instId]);
      expect(okxWs.unsubscribe).not.toHaveBeenCalled();
      expect(result).toEqual(mockPair);
    });

    it('should upsert and unsubscribe if pair is inactive', async () => {
      const inactivePair = { ...mockPair, isActive: false };
      mockPairRepo.upsert.mockResolvedValue(inactivePair);

      const result = await service.upsertPair(inactivePair);

      expect(repo.upsert).toHaveBeenCalledWith(inactivePair);
      expect(okxWs.unsubscribe).toHaveBeenCalledWith([mockPair.instId]);
      expect(okxWs.subscribe).not.toHaveBeenCalled();
      expect(result).toEqual(inactivePair);
    });
  });

  describe('updateStatus', () => {
    it('should update status and subscribe if isActive is true', async () => {
      mockPairRepo.updateStatus.mockResolvedValue({
        ...mockPair,
        isActive: true,
      });

      await service.updateStatus('BTC-USDT', true);

      expect(repo.updateStatus).toHaveBeenCalledWith('BTC-USDT', true);
      expect(okxWs.subscribe).toHaveBeenCalledWith(['BTC-USDT']);
    });

    it('should update status and unsubscribe if isActive is false', async () => {
      mockPairRepo.updateStatus.mockResolvedValue({
        ...mockPair,
        isActive: false,
      });

      await service.updateStatus('BTC-USDT', false);

      expect(repo.updateStatus).toHaveBeenCalledWith('BTC-USDT', false);
      expect(okxWs.unsubscribe).toHaveBeenCalledWith(['BTC-USDT']);
    });

    it('should return null if pair not found', async () => {
      mockPairRepo.updateStatus.mockResolvedValue(null);

      const result = await service.updateStatus('UNKNOWN', true);

      expect(result).toBeNull();
      expect(okxWs.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('deletePair', () => {
    it('should delete and unsubscribe', async () => {
      mockPairRepo.delete.mockResolvedValue({ deletedCount: 1 });

      const result = await service.deletePair('BTC-USDT');

      expect(repo.delete).toHaveBeenCalledWith('BTC-USDT');
      expect(okxWs.unsubscribe).toHaveBeenCalledWith(['BTC-USDT']);
      expect(result.success).toBe(true);
    });
  });
});
