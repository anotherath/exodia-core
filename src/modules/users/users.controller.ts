import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { ISignKeyInfo } from 'src/shared/types/input.type';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('active')
  activateUser(@Body() body: ISignKeyInfo) {
    let isActive = this.usersService.activeUser(body);

    return {
      isActive: isActive,
      walletAddress: body.walletAddress,
    };
  }
}
