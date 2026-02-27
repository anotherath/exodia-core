import { Test, TestingModule } from '@nestjs/testing';
import { AdminPositionController } from '../admin-position.controller';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';

describe('AdminPositionController', () => {
  let controller: AdminPositionController;
  let positionRepo: jest.Mocked<PositionRepository>;

  const mockAdmin = {
    username: 'test-admin',
    role: 'operator',
  };

  beforeEach(async () => {
    const mockPositionRepo = {
      findAllIncludeDeleted: jest.fn(),
      adminUpdate: jest.fn(),
      bulkClose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPositionController],
      providers: [{ provide: PositionRepository, useValue: mockPositionRepo }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminPositionController>(AdminPositionController);
    positionRepo = module.get(PositionRepository);
  });

  describe('getPositions', () => {
    it('should call positionRepo.findAllIncludeDeleted', async () => {
      await controller.getPositions('1', '20', '0x123', 'BTC-USDT', 'open');
      expect(positionRepo.findAllIncludeDeleted).toHaveBeenCalledWith(
        { walletAddress: '0x123', symbol: 'BTC-USDT', status: 'open' },
        1,
        20,
      );
    });
  });

  describe('updatePosition', () => {
    it('should call positionRepo.adminUpdate', async () => {
      const updateData = { pnl: 50 };
      await controller.updatePosition('pos-123', updateData, {
        admin: mockAdmin,
      });
      expect(positionRepo.adminUpdate).toHaveBeenCalledWith(
        'pos-123',
        updateData,
      );
    });
  });

  describe('forceClosePosition', () => {
    it('should call positionRepo.bulkClose', async () => {
      await controller.forceClosePosition('pos-123', { admin: mockAdmin }, 10);
      expect(positionRepo.bulkClose).toHaveBeenCalledWith(['pos-123'], 10);
    });
  });
});
