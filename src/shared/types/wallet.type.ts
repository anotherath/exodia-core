export interface Wallet {
  walletAddress: string;
  chainId: number;

  balance: string; // USDT khả dụng
  lockedBalance: string; // USDT đang vào vị thế

  totalDeposited: string;
  totalWithdrawn: string;

  updatedAt?: Date;
  createdAt?: Date;
}
