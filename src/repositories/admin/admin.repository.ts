import { Injectable } from '@nestjs/common';
import { AdminModel } from './admin.model';
import { Admin, AdminRole } from 'src/shared/types/admin.type';

@Injectable()
export class AdminRepository {
  // Tìm admin theo username (để login)
  async findByUsername(username: string): Promise<Admin | null> {
    return AdminModel.findOne({
      username: username.toLowerCase().trim(),
    }).lean();
  }

  // Tìm admin theo id (để verify JWT)
  async findById(id: string): Promise<Admin | null> {
    return AdminModel.findOne({ _id: id, isActive: true }).lean();
  }

  // Tạo admin mới
  async create(
    username: string,
    passwordHash: string,
    role: AdminRole = 'operator',
  ): Promise<Admin> {
    return AdminModel.create({
      username: username.toLowerCase().trim(),
      passwordHash,
      role,
    });
  }

  // Cập nhật thời gian đăng nhập cuối
  async updateLastLogin(id: string): Promise<void> {
    await AdminModel.updateOne(
      { _id: id },
      { $set: { lastLoginAt: new Date() } },
    );
  }

  // Cập nhật mật khẩu
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await AdminModel.updateOne({ _id: id }, { $set: { passwordHash } });
  }

  // Kiểm tra username đã tồn tại chưa
  async existsByUsername(username: string): Promise<boolean> {
    const count = await AdminModel.countDocuments({
      username: username.toLowerCase().trim(),
    });
    return count > 0;
  }
}
