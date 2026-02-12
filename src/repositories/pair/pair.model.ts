import mongoose, { Schema } from 'mongoose';
import { Pair } from 'src/shared/types/pair.type';

const PairSchema = new Schema<Pair>(
  {
    instId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    maxLeverage: {
      type: Number,
      required: true,
      min: 1,
      default: 100,
    },
    minVolume: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const PairModel = mongoose.model<Pair>('pair', PairSchema);
