import mongoose, { Schema } from 'mongoose';
import { Position } from 'src/shared/types/position.type';

const PositionSchema = new Schema<Position>(
  {
    // ví người dùng – key chính thay cho userId
    walletAddress: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
    },

    // cặp giao dịch: BTCUSDT, ETHUSDT...
    symbol: {
      type: String,
      required: true,
      index: true,
    },

    // hướng vị thế
    side: {
      type: String,
      enum: ['long', 'short'],
      required: true,
    },

    // loại lệnh ban đầu
    type: {
      type: String,
      enum: ['market', 'limit'],
      required: true,
    },

    // trạng thái vòng đời position
    // pending: chưa khớp
    // open: đã khớp (1 phần hoặc full)
    // closed: đóng toàn bộ
    status: {
      type: String,
      enum: ['pending', 'open', 'closed'],
      required: true,
      index: true,
    },

    // khối lượng mong muốn ban đầu
    qty: {
      type: Number,
      required: true,
    },

    // giá đặt (chỉ dùng cho limit)
    price: {
      type: Number,
      default: null,
    },

    // giá khớp trung bình
    entryPrice: {
      type: Number,
      default: null,
    },

    // đòn bẩy
    leverage: {
      type: Number,
      required: true,
    },

    // pnl hiện tại / cuối cùng
    pnl: {
      type: Number,
      default: 0,
    },

    // giá khi đóng lệnh
    exitPrice: {
      type: Number,
      default: null,
    },

    // stop loss / take profit
    sl: {
      type: Number,
      default: null,
    },
    tp: {
      type: Number,
      default: null,
    },

    // soft delete (nếu cần)
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  },
);

export const PositionModel = mongoose.model<Position>(
  'position',
  PositionSchema,
);
