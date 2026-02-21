import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from '../wallet.controller';
import { WalletService } from '../wallet.service';
import { HexString } from 'src/shared/types/web3.type';

describe('WalletController', () => {
  let controller: WalletController;
  let service: jest.Mocked<WalletService>;

  const walletAddress =
    '0x1234567890123456789012345678901234567890' as HexString;
  const chainId = 1;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: {
            getWallet: jest.fn(),
            depositToTrade: jest.fn(),
            withdrawFromTrade: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
    service = module.get(WalletService);
  });

  describe('getWallet', () => {
    it('should return wallet info', async () => {
      const mockResult = {
        walletAddress,
        chainId,
        balance: 100,
        tradeBalance: 0,
      };
      service.getWallet.mockResolvedValue(mockResult as any);

      const result = await controller.getWallet(walletAddress, chainId);

      expect(service.getWallet).toHaveBeenCalledWith(walletAddress, chainId);
      expect(result).toEqual({
        walletAddress,
        chainId,
        wallet: mockResult,
      });
    });
  });

  describe('depositToTrade', () => {
    it('should deposit to trade and return success', async () => {
      const body = { walletAddress, chainId, amount: 50 };
      service.depositToTrade.mockResolvedValue(undefined);

      const result = await controller.depositToTrade(body);

      expect(service.depositToTrade).toHaveBeenCalledWith(
        walletAddress,
        chainId,
        50,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('withdrawFromTrade', () => {
    it('should withdraw from trade and return success', async () => {
      const body = {
        walletAddress,
        chainId,
        amount: 50,
      };
      service.withdrawFromTrade.mockResolvedValue(undefined);

      const result = await controller.withdrawFromTrade(body);

      expect(service.withdrawFromTrade).toHaveBeenCalledWith(
        walletAddress,
        chainId,
        50,
      );
      expect(result).toEqual({ success: true });
    });
  });
});
