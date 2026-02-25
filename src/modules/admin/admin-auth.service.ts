import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AdminRepository } from 'src/repositories/admin/admin.repository';
import { ADMIN_CONFIG } from 'src/config/admin.config';
import { AdminRole } from 'src/shared/types/admin.type';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminRepo: AdminRepository,
    private readonly jwtService: JwtService,
  ) {}

  // ════════════════════════════════════════
  //  Đăng nhập
  // ════════════════════════════════════════

  async login(
    username: string,
    password: string,
  ): Promise<{
    accessToken: string;
    admin: { username: string; role: AdminRole };
  }> {
    // 1. Tìm admin theo username
    const admin = await this.adminRepo.findByUsername(username);
    if (!admin) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }

    // 2. Kiểm tra tài khoản có active không
    if (!admin.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    // 3. So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }

    // 4. Tạo JWT
    const payload = {
      sub: admin._id,
      username: admin.username,
      role: admin.role,
      type: 'admin', // phân biệt với user token
    };

    const accessToken = this.jwtService.sign(payload);

    // 5. Cập nhật thời gian đăng nhập cuối
    await this.adminRepo.updateLastLogin(admin._id!);

    return {
      accessToken,
      admin: {
        username: admin.username,
        role: admin.role,
      },
    };
  }

  // ════════════════════════════════════════
  //  Xác thực JWT (dùng bởi Guard)
  // ════════════════════════════════════════

  async validateToken(payload: {
    sub: string;
    type: string;
  }): Promise<{ id: string; username: string; role: AdminRole } | null> {
    // Kiểm tra token type
    if (payload.type !== 'admin') {
      return null;
    }

    const admin = await this.adminRepo.findById(payload.sub);
    if (!admin || !admin.isActive) {
      return null;
    }

    return {
      id: admin._id!,
      username: admin.username,
      role: admin.role,
    };
  }

  // ════════════════════════════════════════
  //  Tạo admin mới (chỉ gọi từ seeder/CLI)
  // ════════════════════════════════════════

  async createAdmin(
    username: string,
    password: string,
    role: AdminRole = 'operator',
  ): Promise<{ username: string; role: AdminRole }> {
    // Kiểm tra trùng username
    const exists = await this.adminRepo.existsByUsername(username);
    if (exists) {
      throw new ConflictException(`Username "${username}" đã tồn tại`);
    }

    // Hash mật khẩu
    const passwordHash = await bcrypt.hash(
      password,
      ADMIN_CONFIG.BCRYPT_ROUNDS,
    );

    const admin = await this.adminRepo.create(username, passwordHash, role);

    return {
      username: admin.username,
      role: admin.role,
    };
  }

  // ════════════════════════════════════════
  //  Đổi mật khẩu
  // ════════════════════════════════════════

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const admin = await this.adminRepo.findById(adminId);
    if (!admin) {
      throw new UnauthorizedException('Admin không tồn tại');
    }

    // Xác nhận mật khẩu hiện tại
    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    // Hash mật khẩu mới
    const newHash = await bcrypt.hash(newPassword, ADMIN_CONFIG.BCRYPT_ROUNDS);
    await this.adminRepo.updatePassword(admin._id!, newHash);
  }
}
