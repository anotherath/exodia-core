export const ADMIN_CONFIG = {
  // JWT secret – nên đặt trong .env, fallback cho dev
  JWT_SECRET: process.env.ADMIN_JWT_SECRET,

  // Access token hết hạn sau 8 giờ
  JWT_EXPIRES_IN: process.env.ADMIN_JWT_EXPIRES_IN,

  // Số vòng hash bcrypt
  BCRYPT_ROUNDS: 12,

  // Số lần đăng nhập sai tối đa trước khi bị khóa
  MAX_LOGIN_ATTEMPTS: 5,

  // Thời gian khóa (phút)
  LOCKOUT_DURATION_MINUTES: 15,
};
