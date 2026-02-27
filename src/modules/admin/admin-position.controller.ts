import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { RolesGuard } from 'src/shared/guards/roles.guard';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { PositionRepository } from 'src/repositories/position/position.repository';

@Controller('admin/positions')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminPositionController {
  private readonly logger = new Logger(AdminPositionController.name);

  constructor(private readonly positionRepo: PositionRepository) {}

  @Get()
  @Roles('operator', 'support')
  async getPositions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('walletAddress') walletAddress?: string,
    @Query('symbol') symbol?: string,
    @Query('status') status?: any,
  ) {
    const filter: any = {};
    if (walletAddress) filter.walletAddress = walletAddress;
    if (symbol) filter.symbol = symbol;
    if (status) filter.status = status;

    return this.positionRepo.findAllIncludeDeleted(
      filter,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }
}
