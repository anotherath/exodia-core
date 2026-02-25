import { Injectable } from '@nestjs/common';
import { UserModel } from './user.model';
import { User } from 'src/shared/types/user.type';

@Injectable()
export class UserRepository {
  private baseQuery() {
    return { deletedAt: null };
  }

  // ════════════════════════════════════════
  //  QUERY (Đọc dữ liệu)
  // ════════════════════════════════════════

  // Tìm user theo wallet address (chỉ user chưa bị soft-delete)
  async findByWallet(walletAddress: string): Promise<User | null> {
    return UserModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
      ...this.baseQuery(),
    }).lean();
  }

  // Tìm user theo MongoDB _id (chỉ user chưa bị soft-delete)
  async findById(id: string): Promise<User | null> {
    return UserModel.findOne({
      _id: id,
      ...this.baseQuery(),
    }).lean();
  }

  // Lấy danh sách users có phân trang và bộ lọc tùy chọn (chỉ user chưa bị soft-delete)
  async findAll(
    filter: {
      walletAddress?: string;
      role?: 'user' | 'admin';
      isActive?: boolean;
      chainId?: number;
    } = {},
    page = 1,
    limit = 20,
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = { ...this.baseQuery() };

    if (filter.walletAddress) {
      query.walletAddress = filter.walletAddress.toLowerCase();
    }
    if (filter.role !== undefined) {
      query.role = filter.role;
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    if (filter.chainId !== undefined) {
      query.chainId = filter.chainId;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      UserModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  // Lấy danh sách tất cả users kể cả đã soft-delete (admin)
  async findAllIncludeDeleted(
    filter: {
      walletAddress?: string;
      role?: 'user' | 'admin';
      isActive?: boolean;
      chainId?: number;
    } = {},
    page = 1,
    limit = 20,
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = {};

    if (filter.walletAddress) {
      query.walletAddress = filter.walletAddress.toLowerCase();
    }
    if (filter.role !== undefined) {
      query.role = filter.role;
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    if (filter.chainId !== undefined) {
      query.chainId = filter.chainId;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      UserModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  // Đếm tổng số users chưa bị soft-delete
  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return UserModel.countDocuments({ ...this.baseQuery(), ...filter });
  }

  // ════════════════════════════════════════
  //  MUTATION (User flow – ghi dữ liệu)
  // ════════════════════════════════════════

  // Tạo user mới
  async create(walletAddress: string, chainId?: number): Promise<User> {
    return UserModel.create({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
    });
  }

  // Tìm kiếm thông tin user
  // Nếu có thì thay đổi thông tin theo dữ liệu truyền vào
  // Nếu không thì tạo user mới
  async upsert(walletAddress: string, data: Partial<User>): Promise<User> {
    return UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: data, $setOnInsert: { deletedAt: null } },
      { upsert: true, new: true },
    ).lean();
  }

  // Soft-delete user (đánh dấu xóa)
  async softDelete(walletAddress: string): Promise<void> {
    await UserModel.updateOne(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { deletedAt: new Date(), isActive: false } },
    );
  }

  // Khôi phục user đã bị soft-delete
  async restore(walletAddress: string): Promise<void> {
    await UserModel.updateOne(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { deletedAt: null, isActive: true } },
    );
  }

  // ════════════════════════════════════════
  //  ADMIN – Cập nhật thông tin
  // ════════════════════════════════════════

  // Cập nhật partial thông tin user (admin)
  async updateUser(
    walletAddress: string,
    data: Partial<Pick<User, 'isActive' | 'role' | 'chainId'>>,
  ): Promise<User | null> {
    return UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: data },
      { new: true },
    ).lean();
  }

  // Thay đổi role của user (admin)
  async setRole(
    walletAddress: string,
    role: 'user' | 'admin',
  ): Promise<User | null> {
    return UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { role } },
      { new: true },
    ).lean();
  }

  // Kích hoạt user (admin)
  async activate(walletAddress: string): Promise<User | null> {
    return UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { isActive: true } },
      { new: true },
    ).lean();
  }

  // Vô hiệu hóa user (admin) – khác soft-delete, không set deletedAt
  async deactivate(walletAddress: string): Promise<User | null> {
    return UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { $set: { isActive: false } },
      { new: true },
    ).lean();
  }

  // ════════════════════════════════════════
  //  ADMIN – Xóa vĩnh viễn
  // ════════════════════════════════════════

  // Xóa user hoàn toàn khỏi database (admin)
  async hardDelete(walletAddress: string): Promise<boolean> {
    const result = await UserModel.deleteOne({
      walletAddress: walletAddress.toLowerCase(),
    });
    return result.deletedCount > 0;
  }
}
