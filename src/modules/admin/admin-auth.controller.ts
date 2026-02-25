import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';

@ApiTags('Admin Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập admin bằng username/password' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về JWT token',
  })
  @ApiResponse({ status: 401, description: 'Sai tên đăng nhập hoặc mật khẩu' })
  async login(@Body() body: AdminLoginDto) {
    const result = await this.adminAuthService.login(
      body.username,
      body.password,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin admin đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Thông tin admin hiện tại' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token hết hạn',
  })
  async me(@Req() req: any) {
    return {
      success: true,
      data: req.admin,
    };
  }
}
