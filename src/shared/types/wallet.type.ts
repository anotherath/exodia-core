export interface Wallet {
  walletAddress: string;
  chainId: number;

  balance: number; // USDT khả dụng
  tradeBalance: number; // USDT dùng để giao dịch (số dư giao dịch)

  totalDeposited: number;
  totalWithdrawn: number;

  updatedAt?: Date;
  createdAt?: Date;
}
