export interface Wallet {
  walletAddress: string;
  chainId: number;

  balance: number; // USDT khả dụng
  lockedBalance: number; // USDT đang vào vị thế

  totalDeposited: number;
  totalWithdrawn: number;

  updatedAt?: Date;
  createdAt?: Date;
}
