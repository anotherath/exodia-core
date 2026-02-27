import {
  Controller,
  Get,
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
import { UserRepository } from 'src/repositories/user/user.repository';

@Controller('admin/users')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminUserController {
  private readonly logger = new Logger(AdminUserController.name);

  constructor(private readonly userRepo: UserRepository) {}

  @Get()
  @Roles('operator', 'support')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('walletAddress') walletAddress?: string,
    @Query('role') role?: 'user' | 'admin',
    @Query('isActive') isActive?: string,
  ) {
    const filter: any = {};
    if (walletAddress) filter.walletAddress = walletAddress;
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    return this.userRepo.findAllIncludeDeleted(
      filter,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch(':walletAddress')
  @Roles('operator')
  async updateUser(
    @Param('walletAddress') walletAddress: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    this.logger.log(
      `[Admin audit]: ${req.admin.username} updated user ${walletAddress} data: ${JSON.stringify(body)}`,
    );
    return this.userRepo.updateUser(walletAddress, body);
  }

  @Delete(':walletAddress')
  @Roles('operator')
  async deleteUser(
    @Param('walletAddress') walletAddress: string,
    @Req() req: any,
  ) {
    this.logger.warn(
      `[Admin audit]: ${req.admin.username} hard deleted user ${walletAddress}`,
    );
    await this.userRepo.hardDelete(walletAddress);
    return { success: true };
  }
}
