// src/repositories/wallet.repository.ts
import { Injectable } from '@nestjs/common';
import { WalletModel } from './wallet.model';
import { Wallet } from 'src/shared/types/wallet.type';

@Injectable()
export class WalletRepository {
  // Lấy wallet theo (wallet + chain)
  async find(walletAddress: string, chainId: number): Promise<Wallet | null> {
    return WalletModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
    }).lean();
  }

  // Tạo wallet nếu chưa có
  async upsert(walletAddress: string, chainId: number): Promise<Wallet> {
    return WalletModel.findOneAndUpdate(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
      {
        $setOnInsert: {
          balance: 0,
          tradeBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
        },
      },
      { upsert: true, new: true },
    ).lean();
  }

  // Nạp tiền vào balance
  async deposit(walletAddress: string, chainId: number, amount: number) {
    await WalletModel.updateOne(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
      {
        $inc: {
          balance: amount,
          totalDeposited: amount,
        },
        $setOnInsert: {
          tradeBalance: 0,
          totalWithdrawn: 0,
        },
      },
      { upsert: true },
    );
  }

  // Chuyển tiền từ quỹ khả dụng (balance) sang quỹ giao dịch (tradeBalance)
  async depositToTrade(walletAddress: string, chainId: number, amount: number) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          balance: -amount,
          tradeBalance: amount,
        },
      },
    );
  }

  // Rút tiền từ quỹ giao dịch (tradeBalance) về quỹ khả dụng (balance)
  async withdrawFromTrade(
    walletAddress: string,
    chainId: number,
    amount: number,
  ) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          balance: amount,
          tradeBalance: -amount,
        },
      },
    );
  }

  // Cập nhật lợi nhuận/thua lỗ trực tiếp vào tradeBalance
  async updateTradePnL(walletAddress: string, chainId: number, pnl: number) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          tradeBalance: pnl,
        },
      },
    );
  }

  // Rút tiền khỏi hệ thống
  async withdraw(walletAddress: string, chainId: number, amount: number) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          balance: -amount,
          totalWithdrawn: amount,
        },
      },
    );
  }
}
