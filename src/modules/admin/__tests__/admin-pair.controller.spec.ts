import { Test, TestingModule } from '@nestjs/testing';
import { AdminPairController } from '../admin-pair.controller';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { Logger } from '@nestjs/common';

describe('AdminPairController', () => {
  let controller: AdminPairController;
  let pairRepo: jest.Mocked<PairRepository>;

  const mockAdmin = {
    username: 'test-admin',
    role: 'operator',
  };

  beforeEach(async () => {
    const mockPairRepo = {
      findAllPaginated: jest.fn(),
      upsert: jest.fn(),
      updatePair: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPairController],
      providers: [{ provide: PairRepository, useValue: mockPairRepo }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminPairController>(AdminPairController);
    pairRepo = module.get(PairRepository);
  });

  describe('getPairs', () => {
    it('should call pairRepo.findAllPaginated with correct filters', async () => {
      const mockResult = { data: [], total: 0, page: 1, limit: 20 };
      pairRepo.findAllPaginated.mockResolvedValue(mockResult);

      const result = await controller.getPairs('1', '20', 'BTCUSDT', 'true');

      expect(pairRepo.findAllPaginated).toHaveBeenCalledWith(
        { instId: 'BTCUSDT', isActive: true },
        1,
        20,
      );
      expect(result).toBe(mockResult);
    });

    it('should use default pagination values', async () => {
      pairRepo.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      await controller.getPairs();
      expect(pairRepo.findAllPaginated).toHaveBeenCalledWith({}, 1, 20);
    });
  });

  describe('createPair', () => {
    it('should call pairRepo.upsert', async () => {
      const pairData = { instId: 'ETHUSDT', isActive: true };
      pairRepo.upsert.mockResolvedValue(pairData as any);

      const result = await controller.createPair(pairData, {
        admin: mockAdmin,
      });

      expect(pairRepo.upsert).toHaveBeenCalledWith(pairData);
      expect(result).toBe(pairData);
    });
  });

  describe('updatePair', () => {
    it('should call pairRepo.updatePair', async () => {
      const updateData = { maxLeverage: 50 };
      pairRepo.updatePair.mockResolvedValue({
        instId: 'BTCUSDT',
        ...updateData,
      } as any);

      const result = await controller.updatePair('BTCUSDT', updateData, {
        admin: mockAdmin,
      });

      expect(pairRepo.updatePair).toHaveBeenCalledWith('BTCUSDT', updateData);
      expect(result.maxLeverage).toBe(50);
    });
  });

  describe('deletePair', () => {
    it('should call pairRepo.delete', async () => {
      pairRepo.delete.mockResolvedValue({ deletedCount: 1 } as any);

      const result = await controller.deletePair('BTCUSDT', {
        admin: mockAdmin,
      });

      expect(pairRepo.delete).toHaveBeenCalledWith('BTCUSDT');
      expect(result).toEqual({ success: true });
    });
  });
});
