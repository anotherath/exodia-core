import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { PairRepository } from 'src/repositories/pair/pair.repository';

@Controller('admin/pairs')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminPairController {
  private readonly logger = new Logger(AdminPairController.name);

  constructor(private readonly pairRepo: PairRepository) {}

  @Get()
  @Roles('operator', 'support')
  async getPairs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('instId') instId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filter: any = {};
    if (instId) filter.instId = instId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    return this.pairRepo.findAllPaginated(
      filter,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post()
  @Roles('operator')
  async createPair(@Body() body: any, @Req() req: any) {
    this.logger.log(
      `[Admin]: ${req.admin.username} crated pair ${body.instId}`,
    );
    return this.pairRepo.upsert(body);
  }

  @Patch(':instId')
  @Roles('operator')
  async updatePair(
    @Param('instId') instId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    this.logger.log(
      `[Admin audit]: ${req.admin.username} updated pair ${instId} with data: ${JSON.stringify(body)}`,
    );
    return this.pairRepo.updatePair(instId, body);
  }

  @Delete(':instId')
  @Roles('operator')
  async deletePair(@Param('instId') instId: string, @Req() req: any) {
    this.logger.log(
      `[Admin audit]: ${req.admin.username} deleted pair ${instId}`,
    );
    await this.pairRepo.delete(instId);
    return { success: true };
  }
}
