import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { HexString } from 'src/shared/types/web3.type';
import { WalletService } from './wallet.service';
import { WalletTransactionDto } from './dto/wallet-transaction.dto';
import { throttlerConfig } from 'src/config/throttler.config';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @Throttle(throttlerConfig.wallet.read)
  @ApiOperation({ summary: 'Lấy thông tin ví và số dư của người dùng' })
  @ApiQuery({
    name: 'walletAddress',
    description: 'Địa chỉ ví',
    example: '0x123...',
  })
  @ApiQuery({ name: 'chainId', description: 'ID của mạng (chain)', example: 1 })
  @ApiResponse({ status: 200, description: 'Trả về thông tin ví và số dư' })
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

  @Post('deposit-trade')
  @Throttle(throttlerConfig.wallet.transaction)
  @ApiOperation({
    summary: 'Nạp tiền từ ví chính vào tài khoản giao dịch (Trade Balance)',
  })
  @ApiResponse({ status: 201, description: 'Nạp tiền thành công' })
  async depositToTrade(@Body() body: WalletTransactionDto) {
    await this.walletService.depositToTrade(
      body.walletAddress as HexString,
      body.chainId,
      body.amount,
    );

    return { success: true };
  }

  @Post('withdraw-trade')
  @Throttle(throttlerConfig.wallet.transaction)
  @ApiOperation({ summary: 'Rút tiền từ tài khoản giao dịch về ví chính' })
  @ApiResponse({ status: 201, description: 'Rút tiền thành công' })
  async withdrawFromTrade(@Body() body: WalletTransactionDto) {
    await this.walletService.withdrawFromTrade(
      body.walletAddress as HexString,
      body.chainId,
      body.amount,
    );

    return { success: true };
  }
}
