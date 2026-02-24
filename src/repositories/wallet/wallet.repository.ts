// src/repositories/wallet.repository.ts
import { Injectable } from '@nestjs/common';
import { WalletModel } from './wallet.model';
import { Wallet } from 'src/shared/types/wallet.type';
import { roundWithPrecision } from 'src/shared/utils/math.util';
import { BALANCE_CONFIG } from 'src/config/balance.config';

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
    const roundedAmount = roundWithPrecision(
      amount,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    await WalletModel.updateOne(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
      {
        $inc: {
          balance: roundedAmount,
          totalDeposited: roundedAmount,
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
    const roundedAmount = roundWithPrecision(
      amount,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    const result = await WalletModel.updateOne(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
        balance: { $gte: roundedAmount },
      },
      {
        $inc: {
          balance: -roundedAmount,
          tradeBalance: roundedAmount,
        },
      },
    );

    if (result.modifiedCount === 0) {
      throw new Error('Insufficient balance for deposit to trade');
    }
  }

  // Rút tiền từ quỹ giao dịch (tradeBalance) về quỹ khả dụng (balance)
  async withdrawFromTrade(
    walletAddress: string,
    chainId: number,
    amount: number,
  ) {
    const roundedAmount = roundWithPrecision(
      amount,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    const result = await WalletModel.updateOne(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
        tradeBalance: { $gte: roundedAmount },
      },
      {
        $inc: {
          balance: roundedAmount,
          tradeBalance: -roundedAmount,
        },
      },
    );

    if (result.modifiedCount === 0) {
      throw new Error('Insufficient trade balance');
    }
  }

  // Cập nhật lợi nhuận/thua lỗ trực tiếp vào tradeBalance
  async updateTradePnL(walletAddress: string, chainId: number, pnl: number) {
    // Làm tròn PnL theo cấu hình trước khi cộng vào tradeBalance
    const roundedPnL = roundWithPrecision(pnl, BALANCE_CONFIG.PRECISION, false);

    // Sử dụng aggregation pipeline để cập nhật tradeBalance theo kiểu: max(0, tradeBalance + pnl)
    // Giúp chặn số dư âm một cách nguyên tử (atomic)
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      [
        {
          $set: {
            tradeBalance: {
              $max: [0, { $add: ['$tradeBalance', roundedPnL] }],
            },
          },
        },
      ],
    );
  }
}
