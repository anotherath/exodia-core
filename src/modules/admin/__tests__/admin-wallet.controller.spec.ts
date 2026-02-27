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
});
