export interface Pair {
  instId: string;
  maxLeverage: number;
  minVolume: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
