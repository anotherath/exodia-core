import mongoose, { Schema } from 'mongoose';
import { User } from 'src/shared/types/user.type';

const UserSchema = new Schema<User>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    chainId: Number,

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export const UserModel = mongoose.model<User>('user', UserSchema);
