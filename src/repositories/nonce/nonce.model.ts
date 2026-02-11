import mongoose, { Schema } from 'mongoose';
import { NonceInfo } from 'src/shared/types/nonce.type';

const NonceSchema = new Schema<NonceInfo>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // auto delete khi hết hạn
    },
  },
  { timestamps: true },
);

export const NonceModel = mongoose.model<NonceInfo>('nonce', NonceSchema);
