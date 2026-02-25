export type AdminRole = 'super_admin' | 'operator' | 'support';

export interface Admin {
  _id?: string;

  // Tên đăng nhập (unique)
  username: string;

  // Mật khẩu đã hash (bcrypt)
  passwordHash: string;

  // Vai trò trong hệ thống
  role: AdminRole;

  // Trạng thái tài khoản
  isActive: boolean;

  // Đăng nhập lần cuối
  lastLoginAt?: Date | null;

  // Timestamps (mongoose)
  createdAt?: Date;
  updatedAt?: Date;
}
