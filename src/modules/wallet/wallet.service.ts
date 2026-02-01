import { Injectable } from '@nestjs/common';
import type { HexString } from 'src/shared/types/web3.type';
import { WalletRepository } from 'src/repositories/wallet.repository';

@Injectable()
export class WalletService {
  constructor(private readonly walletRepo: WalletRepository) {}

  async getWallet(walletAddress: HexString, chainId: number) {
    return this.walletRepo.find(walletAddress, chainId);
  }
}
