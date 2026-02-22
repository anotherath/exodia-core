export interface Pair {
  instId: string;
  maxLeverage: number;
  minVolume: number;
  openFeeRate: number; // Phí mở lệnh (e.g., 0.0001 = 0.01%)
  closeFeeRate: number; // Phí đóng lệnh (e.g., 0.0001 = 0.01%)
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
