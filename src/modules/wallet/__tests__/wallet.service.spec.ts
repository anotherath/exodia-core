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
      expect(wallet.lockedBalance).toBe(0);
    });

    it('should return existing wallet if it already exists', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, '100');

      const wallet = await service.getWallet(WALLET_ADDRESS, CHAIN_ID);

      expect(wallet.balance).toBe(100);
    });

    it('should be case-insensitive for wallet address', async () => {
      const upperAddress = WALLET_ADDRESS.toUpperCase();
      const wallet = await service.getWallet(upperAddress, CHAIN_ID);

      expect(wallet.walletAddress).toBe(WALLET_ADDRESS.toLowerCase());
    });
  });

  describe('lockBalance', () => {
    it('should lock balance successfully when sufficient funds exist', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, '100');

      await service.lockBalance(WALLET_ADDRESS, CHAIN_ID, '30');

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.balance).toBe(70);
      expect(wallet?.lockedBalance).toBe(30);
    });

    it('should throw BadRequestException if wallet does not exist', async () => {
      await expect(
        service.lockBalance(WALLET_ADDRESS, CHAIN_ID, '10'),
      ).rejects.toThrow(new BadRequestException('Insufficient balance'));
    });

    it('should throw BadRequestException if balance is insufficient', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, '20');

      await expect(
        service.lockBalance(WALLET_ADDRESS, CHAIN_ID, '30'),
      ).rejects.toThrow(new BadRequestException('Insufficient balance'));
    });

    it('should handle string amounts correctly', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, '100.5');

      await service.lockBalance(WALLET_ADDRESS, CHAIN_ID, '50.2');

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.balance).toBe(50.3);
      expect(wallet?.lockedBalance).toBe(50.2);
    });
  });

  describe('unlockBalance', () => {
    it('should unlock balance successfully', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, '100');
      await service.lockBalance(WALLET_ADDRESS, CHAIN_ID, '40');

      await service.unlockBalance(WALLET_ADDRESS, CHAIN_ID, '40');

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.balance).toBe(100);
      expect(wallet?.lockedBalance).toBe(0);
    });

    it('should partial unlock balance successfully', async () => {
      await repo.deposit(WALLET_ADDRESS, CHAIN_ID, '100');
      await service.lockBalance(WALLET_ADDRESS, CHAIN_ID, '40');

      await service.unlockBalance(WALLET_ADDRESS, CHAIN_ID, '10');

      const wallet = await repo.find(WALLET_ADDRESS, CHAIN_ID);
      expect(wallet?.balance).toBe(70);
      expect(wallet?.lockedBalance).toBe(30);
    });
  });
});
