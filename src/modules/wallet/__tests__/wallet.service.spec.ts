import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../wallet.service';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { BadRequestException } from '@nestjs/common';
import { WalletModel } from 'src/repositories/wallet/wallet.model';

describe('WalletService', () => {
  let service: WalletService;
  let repo: WalletRepository;

  const WALLET = '0x1234567890123456789012345678901234567890';
  const CHAIN = 1;

  // ────────────────────────────────────────
  //  Setup / Teardown
  // ────────────────────────────────────────

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

  // ────────────────────────────────────────
  //  getWallet
  // ────────────────────────────────────────
  describe('getWallet', () => {
    it('should create a new wallet with zero balances if none exists', async () => {
      const wallet = await service.getWallet(WALLET, CHAIN);

      expect(wallet).toBeDefined();
      expect(wallet.walletAddress).toBe(WALLET.toLowerCase());
      expect(wallet.chainId).toBe(CHAIN);
      expect(wallet.balance).toBe(0);
      expect(wallet.tradeBalance).toBe(0);
      expect(wallet.totalDeposited).toBe(0);
      expect(wallet.totalWithdrawn).toBe(0);
    });

    it('should return existing wallet without resetting balances', async () => {
      await repo.deposit(WALLET, CHAIN, 500);

      const wallet = await service.getWallet(WALLET, CHAIN);

      expect(wallet.balance).toBe(500);
    });

    it('should be idempotent – calling twice returns the same wallet', async () => {
      const first = await service.getWallet(WALLET, CHAIN);
      const second = await service.getWallet(WALLET, CHAIN);

      expect(first.walletAddress).toBe(second.walletAddress);
      expect(first.chainId).toBe(second.chainId);
    });
  });

  // ────────────────────────────────────────
  //  depositToTrade
  // ────────────────────────────────────────
  describe('depositToTrade', () => {
    it('should move funds from balance to tradeBalance', async () => {
      await repo.deposit(WALLET, CHAIN, 100);

      await service.depositToTrade(WALLET, CHAIN, 30);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.balance).toBe(70);
      expect(wallet?.tradeBalance).toBe(30);
    });

    it('should move the entire balance if amount equals balance', async () => {
      await repo.deposit(WALLET, CHAIN, 100);

      await service.depositToTrade(WALLET, CHAIN, 100);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.balance).toBe(0);
      expect(wallet?.tradeBalance).toBe(100);
    });

    it('should throw BadRequestException when amount <= 0', async () => {
      await repo.deposit(WALLET, CHAIN, 100);

      await expect(service.depositToTrade(WALLET, CHAIN, 0)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.depositToTrade(WALLET, CHAIN, -10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when balance is insufficient', async () => {
      await repo.deposit(WALLET, CHAIN, 20);

      await expect(service.depositToTrade(WALLET, CHAIN, 30)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when wallet does not exist', async () => {
      await expect(service.depositToTrade(WALLET, CHAIN, 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ────────────────────────────────────────
  //  withdrawFromTrade
  // ────────────────────────────────────────
  describe('withdrawFromTrade', () => {
    it('should move funds from tradeBalance back to balance', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 60);

      await service.withdrawFromTrade(WALLET, CHAIN, 40);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.balance).toBe(80); // 40 (remaining) + 40 (withdrawn)
      expect(wallet?.tradeBalance).toBe(20); // 60 - 40
    });

    it('should withdraw the entire tradeBalance', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 50);

      await service.withdrawFromTrade(WALLET, CHAIN, 50);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.balance).toBe(100);
      expect(wallet?.tradeBalance).toBe(0);
    });

    it('should throw BadRequestException when amount <= 0', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 50);

      await expect(service.withdrawFromTrade(WALLET, CHAIN, 0)).rejects.toThrow(
        BadRequestException,
      );

      await expect(
        service.withdrawFromTrade(WALLET, CHAIN, -5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tradeBalance is insufficient', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 20);

      await expect(
        service.withdrawFromTrade(WALLET, CHAIN, 30),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when wallet does not exist', async () => {
      await expect(
        service.withdrawFromTrade(WALLET, CHAIN, 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ────────────────────────────────────────
  //  updateTradePnL
  // ────────────────────────────────────────
  describe('updateTradePnL', () => {
    it('should increase tradeBalance with positive PnL', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 50);

      await service.updateTradePnL(WALLET, CHAIN, 25);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.tradeBalance).toBe(75);
    });

    it('should decrease tradeBalance with negative PnL', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 50);

      await service.updateTradePnL(WALLET, CHAIN, -20);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.tradeBalance).toBe(30);
    });

    it('should clamp tradeBalance to 0 when loss exceeds balance', async () => {
      await repo.deposit(WALLET, CHAIN, 100);
      await repo.depositToTrade(WALLET, CHAIN, 30);

      await service.updateTradePnL(WALLET, CHAIN, -999);

      const wallet = await repo.find(WALLET, CHAIN);
      expect(wallet?.tradeBalance).toBe(0);
    });

    it('should do nothing if wallet does not exist', async () => {
      // Không throw lỗi, chỉ bỏ qua
      await expect(
        service.updateTradePnL(WALLET, CHAIN, 100),
      ).resolves.not.toThrow();
    });
  });
});
