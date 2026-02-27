import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
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
}
