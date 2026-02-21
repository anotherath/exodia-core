import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../wallet.service';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { BadRequestException } from '@nestjs/common';
import { WalletModel } from 'src/repositories/wallet/wallet.model';

describe('WalletService', () => {
  let service: WalletService;
  let repo: WalletRepository;

  const WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';
  const CHAIN_ID = 1;

  beforeAll(async () => {
    await connectTestDB();

    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService, WalletRepository],
    }).compile();

    service = module.get<WalletService>(WalletService);
    repo = module.get<WalletRepository>(WalletRepository);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await WalletModel.deleteMany({});
  });

  describe('getWallet', () => {
    it('should create and return a new wallet if it does not exist', async () => {
      const wallet = await service.getWallet(WALLET_ADDRESS, CHAIN_ID);

      expect(wallet).toBeDefined();
      expect(wallet.walletAddress).toBe(WALLET_ADDRESS.toLowerCase());
      expect(wallet.chainId).toBe(CHAIN_ID);
      expect(wallet.balance).toBe(0);
      expect(wallet.tradeBalance).toBe(0);
    });

    it('should return existing wallet if it already exists', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 100);

      const wallet = await service.getWallet(WALLET_ADDRESS, CHAIN_ID);

      expect(wallet.balance).toBe(100);
    });
  });

  describe('depositToTrade', () => {
    it('should deposit to trade successfully when sufficient funds exist', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 100);

      await service.depositToTrade(WALLET_ADDRESS, CHAIN_ID, 30);

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.balance).toBe(70);
      expect(wallet?.tradeBalance).toBe(30);
    });

    it('should throw BadRequestException if balance is insufficient', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 20);

      await expect(
        service.depositToTrade(WALLET_ADDRESS, CHAIN_ID, 30),
      ).rejects.toThrow(new BadRequestException('Insufficient balance'));
    });
  });

  describe('withdrawFromTrade', () => {
    it('should withdraw from trade successfully', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 100);
      await service.depositToTrade(WALLET_ADDRESS, CHAIN_ID, 40);

      await service.withdrawFromTrade(WALLET_ADDRESS, CHAIN_ID, 40);

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.balance).toBe(100);
      expect(wallet?.tradeBalance).toBe(0);
    });

    it('should throw BadRequestException if trade balance is insufficient', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 100);
      await service.depositToTrade(WALLET_ADDRESS, CHAIN_ID, 20);

      await expect(
        service.withdrawFromTrade(WALLET_ADDRESS, CHAIN_ID, 30),
      ).rejects.toThrow(new BadRequestException('Insufficient trade balance'));
    });
  });

  describe('updateTradePnL', () => {
    it('should update trade balance with positive PnL', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 100);
      await service.depositToTrade(WALLET_ADDRESS, CHAIN_ID, 50);

      await service.updateTradePnL(WALLET_ADDRESS, CHAIN_ID, 20);

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.tradeBalance).toBe(70);
    });

    it('should update trade balance with negative PnL', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, 100);
      await service.depositToTrade(WALLET_ADDRESS, CHAIN_ID, 50);

      await service.updateTradePnL(WALLET_ADDRESS, CHAIN_ID, -20);

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.tradeBalance).toBe(30);
    });
  });
});
