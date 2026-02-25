export const ADMIN_CONFIG = {
  // JWT secret – nên đặt trong .env, fallback cho dev
  JWT_SECRET: process.env.ADMIN_JWT_SECRET || 'exodia-admin-secret-change-me',

  // Access token hết hạn sau 8 giờ
  JWT_EXPIRES_IN: process.env.ADMIN_JWT_EXPIRES_IN || '8h',

  // Số vòng hash bcrypt
  BCRYPT_ROUNDS: 12,
};
