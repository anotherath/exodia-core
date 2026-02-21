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

  // POST /wallet/deposit-trade
  @Post('deposit-trade')
  async depositToTrade(
    @Body()
    body: {
      walletAddress: HexString;
      chainId: number;
      amount: number;
    },
  ) {
    await this.walletService.depositToTrade(
      body.walletAddress,
      body.chainId,
      body.amount,
    );

    return { success: true };
  }

  // POST /wallet/withdraw-trade
  @Post('withdraw-trade')
  async withdrawFromTrade(
    @Body()
    body: {
      walletAddress: HexString;
      chainId: number;
      amount: number;
    },
  ) {
    await this.walletService.withdrawFromTrade(
      body.walletAddress,
      body.chainId,
      body.amount,
    );

    return { success: true };
  }
}
