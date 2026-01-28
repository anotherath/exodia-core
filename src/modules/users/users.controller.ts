import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('active-status')
  async isActiveUser(@Query('walletAddress') walletAddress: HexString) {
    const isActive = await this.usersService.isActiveUser(walletAddress);

    return {
      walletAddress,
      isActive,
    };
  }

  @Get('nounce')
  async getNounce(@Query('walletAddress') walletAddress: HexString) {
    const nounce = await this.getNounce(walletAddress);

    return {
      nounce: nounce,
    };
  }

  @Post('active')
  async activateUser(@Body() body: ISignKeyInfo) {
    const isActive = await this.usersService.activeUser(body);

    return {
      walletAddress: body.walletAddress,
      isActive,
    };
  }
}
