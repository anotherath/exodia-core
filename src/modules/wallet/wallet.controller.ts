import { Controller, Get, Post, Body, Query } from '@nestjs/common';
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

  // POST /wallet/lock
  @Post('lock')
  async lockBalance(
    @Body()
    body: {
      walletAddress: HexString;
      chainId: number;
      amount: string;
    },
  ) {
    await this.walletService.lockBalance(
      body.walletAddress,
      body.chainId,
      body.amount,
    );

    return { success: true };
  }

  // POST /wallet/unlock
  @Post('unlock')
  async unlockBalance(
    @Body()
    body: {
      walletAddress: HexString;
      chainId: number;
      lockedAmount: string;
      finalAmount: string;
    },
  ) {
    await this.walletService.unlockBalance(
      body.walletAddress,
      body.chainId,
      body.lockedAmount,
      body.finalAmount,
    );

    return { success: true };
  }
}
