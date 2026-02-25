/**
 * Script tạo admin đầu tiên cho hệ thống.
 *
 * Chạy: npx ts-node -r tsconfig-paths/register src/scripts/seed-admin.ts
 *
 * Sau khi chạy xong, bạn có thể đăng nhập bằng:
 *   username: admin
 *   password: Admin@123456
 *
 * ⚠️  HÃY ĐỔI MẬT KHẨU NGAY sau khi đăng nhập lần đầu.
 */

import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { connectMongoDB } from '../infra/mongodb/mongodb';
import { AdminModel } from '../repositories/admin/admin.model';
import { ADMIN_CONFIG } from '../config/admin.config';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'Admin@123456';
const DEFAULT_ROLE = 'super_admin';

async function seedAdmin() {
  await connectMongoDB();

  const existing = await AdminModel.findOne({ username: DEFAULT_USERNAME });
  if (existing) {
    console.log(`⚠️  Admin "${DEFAULT_USERNAME}" đã tồn tại. Bỏ qua.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(
    DEFAULT_PASSWORD,
    ADMIN_CONFIG.BCRYPT_ROUNDS,
  );

  await AdminModel.create({
    username: DEFAULT_USERNAME,
    passwordHash,
    role: DEFAULT_ROLE,
    isActive: true,
  });

  console.log(`✅ Tạo admin thành công!`);
  console.log(`   Username: ${DEFAULT_USERNAME}`);
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log(`   Role:     ${DEFAULT_ROLE}`);
  console.log(`\n⚠️  Hãy đổi mật khẩu ngay sau khi đăng nhập!`);

  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Lỗi khi seed admin:', err);
  process.exit(1);
});
