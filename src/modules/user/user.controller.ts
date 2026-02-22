import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import type { HexString } from 'src/shared/types/web3.type';
import type { ActivateUserValue } from 'src/shared/types/eip712.type';
import { ActivateUserDto } from './dto/activate-user.dto';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly usersService: UserService) {}

  @Get('get-active-status')
  @ApiOperation({ summary: 'Kiểm tra trạng thái kích hoạt của người dùng' })
  @ApiResponse({ status: 200, description: 'Trả về trạng thái isActive' })
  async isActiveUser(@Query('walletAddress') walletAddress: HexString) {
    const isActive = await this.usersService.isActiveUser(walletAddress);

    return {
      walletAddress,
      isActive,
    };
  }

  @Post('post-active-user')
  @ApiOperation({ summary: 'Kích hoạt người dùng bằng chữ ký EIP-712' })
  @ApiResponse({ status: 201, description: 'Kích hoạt thành công' })
  async activateUser(@Body() body: ActivateUserDto) {
    const { signature, ...typedData } = body;
    const isActive = await this.usersService.activeUser(
      typedData as ActivateUserValue,
      signature as HexString,
    );

    return {
      walletAddress: typedData.walletAddress,
      isActive,
    };
  }
}
