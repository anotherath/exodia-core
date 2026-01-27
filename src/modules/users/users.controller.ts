import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { ISignKeyInfo } from 'src/shared/types/input.type';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('active')
  async activateUser(@Body() body: ISignKeyInfo) {
    const isActive = await this.usersService.activeUser(body);

    return {
      isActive,
      walletAddress: body.walletAddress,
    };
  }
}
