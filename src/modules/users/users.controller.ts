import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import type { HexString, ISignKeyInfo } from 'src/shared/types/web3.type';
import { isHexString } from 'src/shared/utils/web3.util';

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
  async getNonce(@Query('walletAddress') walletAddress: HexString) {
    if (!isHexString(walletAddress)) {
      throw new BadRequestException('walletAddress is required');
    }

    const nounce = await this.usersService.getNonce(walletAddress);

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
