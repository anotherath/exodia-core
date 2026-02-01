export interface User {
  walletAddress: string;
  isActive: boolean;
  role: 'user' | 'admin';
  chainId?: number;

  deletedAt?: Date; // soft delete

  createdAt?: Date;
  updatedAt?: Date;
}
