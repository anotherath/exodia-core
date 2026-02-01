import { Controller, Get, Query } from '@nestjs/common';
import type { HexString } from 'src/shared/types/web3.type';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // GET /wallet?walletAddress=0x...&chainId=1
  @Get()
  async getWallet(
    @Query('walletAddress') walletAddress: HexString,
    @Query('chainId') chainId: number,
  ) {
    const wallet = await this.walletService.getWallet(
      walletAddress,
      Number(chainId),
    );

    return {
      walletAddress,
      chainId: Number(chainId),
      wallet,
    };
  }
}
