import { Injectable, BadRequestException } from '@nestjs/common';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';

@Injectable()
export class WalletService {
  constructor(private readonly repo: WalletRepository) {}

  async getWallet(walletAddress: string, chainId: number) {
    return this.repo.upsert(walletAddress, chainId);
  }

  async lockBalance(walletAddress: string, chainId: number, amount: string) {
    const wallet = await this.repo.find(walletAddress, chainId);
    if (!wallet || Number(wallet.balance) < Number(amount)) {
      throw new BadRequestException('Insufficient balance');
    }

    await this.repo.lockBalance(walletAddress, chainId, amount);
  }

  async unlockBalance(
    walletAddress: string,
    chainId: number,
    lockedAmount: string,
  ) {
    await this.repo.unlockBalance(walletAddress, chainId, lockedAmount);
  }
}
