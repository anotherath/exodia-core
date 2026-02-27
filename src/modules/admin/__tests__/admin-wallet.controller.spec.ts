import { Test, TestingModule } from '@nestjs/testing';
import { AdminWalletController } from '../admin-wallet.controller';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';

describe('AdminWalletController', () => {
  let controller: AdminWalletController;
  let walletRepo: jest.Mocked<WalletRepository>;

  const mockAdmin = {
    username: 'test-admin',
    role: 'operator',
  };

  beforeEach(async () => {
    const mockWalletRepo = {
      findAll: jest.fn(),
      adjustBalance: jest.fn(),
      adjustTradeBalance: jest.fn(),
      setBalance: jest.fn(),
      setTradeBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWalletController],
      providers: [{ provide: WalletRepository, useValue: mockWalletRepo }],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminWalletController>(AdminWalletController);
    walletRepo = module.get(WalletRepository);
  });

  describe('getWallets', () => {
    it('should call walletRepo.findAll', async () => {
      walletRepo.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      await controller.getWallets('1', '20', '0x123', '137');
      expect(walletRepo.findAll).toHaveBeenCalledWith(
        { walletAddress: '0x123', chainId: 137 },
        1,
        20,
      );
    });
  });

  describe('adjustBalance', () => {
    it('should call adjustBalance and adjustTradeBalance if both provided', async () => {
      await controller.adjustBalance(
        '0x123',
        137,
        { admin: mockAdmin },
        10,
        20,
      );
      expect(walletRepo.adjustBalance).toHaveBeenCalledWith('0x123', 137, 10);
      expect(walletRepo.adjustTradeBalance).toHaveBeenCalledWith(
        '0x123',
        137,
        20,
      );
    });

    it('should call only adjustBalance if only deltaBalance provided', async () => {
      await controller.adjustBalance('0x123', 137, { admin: mockAdmin }, 10);
      expect(walletRepo.adjustBalance).toHaveBeenCalledWith('0x123', 137, 10);
      expect(walletRepo.adjustTradeBalance).not.toHaveBeenCalled();
    });
  });

  describe('overrideBalance', () => {
    it('should call setBalance and setTradeBalance', async () => {
      await controller.overrideBalance(
        '0x123',
        137,
        { admin: mockAdmin },
        100,
        200,
      );
      expect(walletRepo.setBalance).toHaveBeenCalledWith('0x123', 137, 100);
      expect(walletRepo.setTradeBalance).toHaveBeenCalledWith(
        '0x123',
        137,
        200,
      );
    });
  });
});
