export const eip712Config = {
  name: 'Exodia', // Hardcode, khớp với Smart Contract
  version: '1', // Hardcode, khớp với Smart Contract
  chainId: Number(process.env.EIP712_CHAIN_ID) || 1, // Bắt buộc đọc từ Env
} as const;
