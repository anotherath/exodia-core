import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { UserService } from './user.service';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';

@Controller('user')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get('get-active-status')
  async isActiveUser(@Query('walletAddress') walletAddress: HexString) {
    const isActive = await this.usersService.isActiveUser(walletAddress);

    return {
      walletAddress,
      isActive,
    };
  }

  @Post('post-active-user')
  async activateUser(@Body() body: ISignKeyInfo) {
    const isActive = await this.usersService.activeUser(body);

    return {
      walletAddress: body.walletAddress,
      isActive,
    };
  }
}
