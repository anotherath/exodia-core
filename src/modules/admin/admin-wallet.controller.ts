import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';

@Controller('admin/wallets')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminWalletController {
  private readonly logger = new Logger(AdminWalletController.name);

  constructor(private readonly walletRepo: WalletRepository) {}

  @Get()
  @Roles('operator', 'support')
  async getWallets(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('walletAddress') walletAddress?: string,
    @Query('chainId') chainId?: string,
  ) {
    const filter: any = {};
    if (walletAddress) filter.walletAddress = walletAddress;
    if (chainId) filter.chainId = parseInt(chainId, 10);

    return this.walletRepo.findAll(
      filter,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post(':walletAddress/adjust')
  @Roles('operator')
  async adjustBalance(
    @Param('walletAddress') walletAddress: string,
    @Body('chainId') chainId: number,
    @Req() req: any,
    @Body('deltaBalance') deltaBalance?: number,
    @Body('deltaTradeBalance') deltaTradeBalance?: number,
  ) {
    this.logger.warn(
      `[Admin audit]: ${req.admin.username} adjusting balance for ${walletAddress}. Balance delta: ${deltaBalance}, Trade Balance delta: ${deltaTradeBalance}`,
    );

    let result: any = null;
    if (deltaBalance) {
      result = await this.walletRepo.adjustBalance(
        walletAddress,
        chainId,
        deltaBalance,
      );
    }
    if (deltaTradeBalance) {
      result = await this.walletRepo.adjustTradeBalance(
        walletAddress,
        chainId,
        deltaTradeBalance,
      );
    }
    return result || { success: true };
  }

  @Patch(':walletAddress/override')
  @Roles('operator')
  async overrideBalance(
    @Param('walletAddress') walletAddress: string,
    @Body('chainId') chainId: number,
    @Req() req: any,
    @Body('balance') balance?: number,
    @Body('tradeBalance') tradeBalance?: number,
  ) {
    this.logger.warn(
      `[Admin audit]: ${req.admin.username} overridden balance for ${walletAddress}. Balance: ${balance}, Trade balance: ${tradeBalance}`,
    );

    let result: any = null;
    if (balance !== undefined) {
      result = await this.walletRepo.setBalance(
        walletAddress,
        chainId,
        balance,
      );
    }
    if (tradeBalance !== undefined) {
      result = await this.walletRepo.setTradeBalance(
        walletAddress,
        chainId,
        tradeBalance,
      );
    }
    return result || { success: true };
  }
}
