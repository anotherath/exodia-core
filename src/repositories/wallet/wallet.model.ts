import { Schema, model } from 'mongoose';
import { Wallet } from 'src/shared/types/wallet.type';

const WalletSchema = new Schema<Wallet>(
  {
    walletAddress: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
    },
    chainId: {
      type: Number,
      required: true,
    },

    balance: {
      type: Number,
      default: 0,
    },
    tradeBalance: {
      type: Number,
      default: 0,
    },

    totalDeposited: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

WalletSchema.index({ walletAddress: 1, chainId: 1 }, { unique: true });

export const WalletModel = model<Wallet>('wallet', WalletSchema);
