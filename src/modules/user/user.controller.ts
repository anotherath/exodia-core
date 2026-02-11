import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { UserService } from './user.service';
import type { HexString } from 'src/shared/types/web3.type';
import type { ActivateUserValue } from 'src/shared/types/eip712.type';

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
  async activateUser(
    @Body() body: ActivateUserValue & { signature: HexString },
  ) {
    const { signature, ...typedData } = body;
    const isActive = await this.usersService.activeUser(
      typedData as ActivateUserValue,
      signature,
    );

    return {
      walletAddress: typedData.walletAddress,
      isActive,
    };
  }
}
