export type PositionStatus = 'pending' | 'open' | 'closed';
export type PositionSide = 'long' | 'short';
export type PositionType = 'market' | 'limit';

export interface Position {
  _id?: string;

  // ví người dùng (key chính)
  walletAddress: string;

  // cặp giao dịch
  symbol: string;

  // hướng vị thế
  side: PositionSide;

  // loại lệnh ban đầu
  type: PositionType;

  // trạng thái vòng đời
  status: PositionStatus;

  // khối lượng mong muốn ban đầu
  qty: number;

  // giá đặt (limit)
  price?: number | null;

  // giá khớp trung bình
  entryPrice?: number | null;

  // đòn bẩy
  leverage: number;

  // pnl hiện tại / cuối cùng
  pnl: number;

  // soft delete
  deletedAt?: Date | null;

  // timestamps (mongoose)
  createdAt?: Date;
  updatedAt?: Date;
}
