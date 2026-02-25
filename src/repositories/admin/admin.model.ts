import mongoose, { Schema } from 'mongoose';
import { Admin } from 'src/shared/types/admin.type';

const AdminSchema = new Schema<Admin>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['super_admin', 'operator', 'support'],
      default: 'operator',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const AdminModel = mongoose.model<Admin>('admin', AdminSchema);
