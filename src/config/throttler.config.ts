/**
 * Cấu hình Rate Limiting (Chống Spam API)
 * ttl: thời gian tính bằng miliseconds (ms)
 * limit: số lượng request tối đa trong khoảng ttl đó
 */
export const throttlerConfig = {
  // Mặc định global
  global: {
    ip: { ttl: 60000, limit: 100 },
    wallet: { ttl: 60000, limit: 100 },
  },

  // Module Nonce
  nonce: {
    ip: { ttl: 60000, limit: 60 },
    wallet: { ttl: 60000, limit: 60 },
  },

  // Module Position (Trading)
  trading: {
    market: {
      ip: { ttl: 10000, limit: 10 },
      wallet: { ttl: 10000, limit: 3 },
    },
    limit: {
      ip: { ttl: 10000, limit: 15 },
      wallet: { ttl: 10000, limit: 5 },
    },
    update: {
      ip: { ttl: 10000, limit: 15 },
      wallet: { ttl: 10000, limit: 5 },
    },
    cancel: {
      ip: { ttl: 10000, limit: 15 },
      wallet: { ttl: 10000, limit: 5 },
    },
    close: {
      ip: { ttl: 10000, limit: 10 },
      wallet: { ttl: 10000, limit: 3 },
    },
    read: {
      ip: { ttl: 60000, limit: 60 },
      wallet: { ttl: 60000, limit: 30 },
    },
    history: {
      ip: { ttl: 60000, limit: 40 },
      wallet: { ttl: 60000, limit: 20 },
    },
  },

  // Module Market
  market: {
    candles: {
      ip: { ttl: 60000, limit: 30 },
      wallet: { ttl: 60000, limit: 30 },
    },
  },

  // Module User
  user: {
    status: {
      ip: { ttl: 60000, limit: 20 },
      wallet: { ttl: 60000, limit: 20 },
    },
    activate: {
      ip: { ttl: 60000, limit: 10 },
      wallet: { ttl: 60000, limit: 3 },
    },
  },

  // Module Wallet
  wallet: {
    read: {
      ip: { ttl: 60000, limit: 40 },
      wallet: { ttl: 60000, limit: 20 },
    },
    transaction: {
      ip: { ttl: 60000, limit: 15 },
      wallet: { ttl: 60000, limit: 5 },
    },
  },

  // Module Pairs (Public)
  pairs: {
    read: {
      ip: { ttl: 60000, limit: 60 },
      wallet: { ttl: 60000, limit: 60 },
    },
  },
};
