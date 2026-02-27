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

  @Patch(':id')
  @Roles('operator')
  async updatePosition(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    this.logger.warn(
      `[Admin audit]: ${req.admin.username} updated position ${id} with: ${JSON.stringify(body)}`,
    );
    return this.positionRepo.adminUpdate(id, body);
  }

  @Post(':id/close-force')
  @Roles('operator')
  async forceClosePosition(
    @Param('id') id: string,
    @Req() req: any,
    @Body('pnl') pnl: number = 0,
  ) {
    this.logger.warn(
      `[Admin audit]: ${req.admin.username} force closed position ${id} with pnl ${pnl}`,
    );
    await this.positionRepo.bulkClose([id], pnl);
    return { success: true };
  }
}
