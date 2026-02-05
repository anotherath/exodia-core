import { WalletService } from '../wallet.service';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';
import { connectTestDB, closeTestDB } from 'test/mongo-memory';
import { BadRequestException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let repo: WalletRepository;

  const walletAddress = '0x1111111111111111111111111111111111111111';
  const walletAddress1 = '0x1111111111111111111111111111111111111112';
  const chainId = 1;

  beforeAll(async () => {
    await connectTestDB();
    repo = new WalletRepository();
    service = new WalletService(repo);
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    if ((repo as any).model) {
      await (repo as any).model.deleteMany({});
    }
  });

  it('should create wallet if not exists', async () => {
    const wallet = await service.getWallet(walletAddress, chainId);

    expect(wallet.walletAddress).toBe(walletAddress.toLowerCase());
    expect(wallet.chainId).toBe(chainId);
    expect(Number(wallet.balance)).toBe(0);
    expect(Number(wallet.lockedBalance)).toBe(0);
  });

  it('should lock balance correctly', async () => {
    await service.getWallet(walletAddress, chainId);
    await repo.deposit(walletAddress, chainId, '100');

    await service.lockBalance(walletAddress, chainId, '40');

    const wallet = await repo.find(walletAddress, chainId);

    expect(Number(wallet?.balance)).toBe(60);
    expect(Number(wallet?.lockedBalance)).toBe(40);
  });

  it('should throw error when balance is insufficient', async () => {
    await service.getWallet(walletAddress, chainId);
    await repo.deposit(walletAddress, chainId, '10');

    await expect(
      service.lockBalance(walletAddress, chainId, '1000'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should unlock balance correctly', async () => {
    await repo.deposit(walletAddress1, chainId, '100');
    await service.lockBalance(walletAddress1, chainId, '40');

    await service.unlockBalance(walletAddress1, chainId, '30');

    const wallet = await repo.find(walletAddress1, chainId);

    expect(Number(wallet?.balance)).toBe(90);
    expect(Number(wallet?.lockedBalance)).toBe(10);
  });
});
