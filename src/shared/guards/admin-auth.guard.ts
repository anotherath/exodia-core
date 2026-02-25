import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ADMIN_CONFIG } from 'src/config/admin.config';
import { AdminAuthService } from 'src/modules/admin/admin-auth.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Lấy token từ header Authorization: Bearer <token>
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token không được cung cấp');
    }

    const token = authHeader.split(' ')[1];

    try {
      // 2. Verify JWT
      const payload = this.jwtService.verify(token, {
        secret: ADMIN_CONFIG.JWT_SECRET,
      });

      // 3. Validate admin còn active không
      const admin = await this.adminAuthService.validateToken(payload);
      if (!admin) {
        throw new UnauthorizedException(
          'Token không hợp lệ hoặc admin bị vô hiệu hóa',
        );
      }

      // 4. Gắn admin info vào request để controller dùng
      request.admin = admin;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}
