// src/repositories/wallet.repository.ts
import { Injectable } from '@nestjs/common';
import { WalletModel } from './wallet.model';
import { Wallet } from 'src/shared/types/wallet.type';
import { roundWithPrecision } from 'src/shared/utils/math.util';
import { BALANCE_CONFIG } from 'src/config/balance.config';

@Injectable()
export class WalletRepository {
  // ════════════════════════════════════════
  //  QUERY (Đọc dữ liệu)
  // ════════════════════════════════════════

  // Lấy wallet theo (wallet + chain)
  async find(walletAddress: string, chainId: number): Promise<Wallet | null> {
    return WalletModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
    }).lean();
  }

  // Lấy wallet theo MongoDB _id
  async findById(id: string): Promise<Wallet | null> {
    return WalletModel.findById(id).lean();
  }

  // Lấy danh sách wallets có phân trang và bộ lọc tùy chọn
  async findAll(
    filter: {
      walletAddress?: string;
      chainId?: number;
      minBalance?: number;
      maxBalance?: number;
    } = {},
    page = 1,
    limit = 20,
  ): Promise<{ data: Wallet[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = {};

    if (filter.walletAddress) {
      query.walletAddress = filter.walletAddress.toLowerCase();
    }
    if (filter.chainId !== undefined) {
      query.chainId = filter.chainId;
    }
    if (filter.minBalance !== undefined || filter.maxBalance !== undefined) {
      query.balance = {};
      if (filter.minBalance !== undefined) {
        (query.balance as Record<string, number>).$gte = filter.minBalance;
      }
      if (filter.maxBalance !== undefined) {
        (query.balance as Record<string, number>).$lte = filter.maxBalance;
      }
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      WalletModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  // Đếm tổng số wallets (có thể truyền filter tùy chọn)
  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return WalletModel.countDocuments(filter);
  }

  // ════════════════════════════════════════
  //  MUTATION (User flow – ghi dữ liệu)
  // ════════════════════════════════════════

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
      { updatePipeline: true },
    );
  }

  // ════════════════════════════════════════
  //  ADMIN – Rút tiền
  // ════════════════════════════════════════

  // Rút tiền từ balance (có kiểm tra số dư đủ, cập nhật totalWithdrawn)
  async withdraw(walletAddress: string, chainId: number, amount: number) {
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
          totalWithdrawn: roundedAmount,
        },
      },
    );

    if (result.modifiedCount === 0) {
      throw new Error('Insufficient balance for withdrawal');
    }
  }

  // ════════════════════════════════════════
  //  ADMIN – Đặt số dư trực tiếp (override)
  // ════════════════════════════════════════

  // Đặt trực tiếp balance (bỏ qua logic deposit/withdraw, dành cho admin)
  async setBalance(
    walletAddress: string,
    chainId: number,
    newBalance: number,
  ): Promise<Wallet | null> {
    const rounded = roundWithPrecision(
      newBalance,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    return WalletModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      { $set: { balance: rounded } },
      { new: true },
    ).lean();
  }

  // Đặt trực tiếp tradeBalance (bỏ qua logic deposit/withdraw, dành cho admin)
  async setTradeBalance(
    walletAddress: string,
    chainId: number,
    newTradeBalance: number,
  ): Promise<Wallet | null> {
    const rounded = roundWithPrecision(
      newTradeBalance,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    return WalletModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      { $set: { tradeBalance: rounded } },
      { new: true },
    ).lean();
  }

  // ════════════════════════════════════════
  //  ADMIN – Điều chỉnh số dư (cộng/trừ tùy ý)
  // ════════════════════════════════════════

  // Điều chỉnh balance (cộng/trừ không giới hạn, dành cho admin)
  // Sử dụng $max để chặn balance âm
  async adjustBalance(
    walletAddress: string,
    chainId: number,
    delta: number,
  ): Promise<Wallet | null> {
    const roundedDelta = roundWithPrecision(
      delta,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    return WalletModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      [
        {
          $set: {
            balance: {
              $max: [0, { $add: ['$balance', roundedDelta] }],
            },
          },
        },
      ],
      { new: true },
    ).lean();
  }

  // Điều chỉnh tradeBalance (cộng/trừ không giới hạn, dành cho admin)
  // Sử dụng $max để chặn tradeBalance âm
  async adjustTradeBalance(
    walletAddress: string,
    chainId: number,
    delta: number,
  ): Promise<Wallet | null> {
    const roundedDelta = roundWithPrecision(
      delta,
      BALANCE_CONFIG.PRECISION,
      false,
    );
    return WalletModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      [
        {
          $set: {
            tradeBalance: {
              $max: [0, { $add: ['$tradeBalance', roundedDelta] }],
            },
          },
        },
      ],
      { new: true },
    ).lean();
  }

  // ════════════════════════════════════════
  //  ADMIN – Cập nhật & Xoá
  // ════════════════════════════════════════

  // Cập nhật thông tin wallet bằng dữ liệu partial (admin)
  async updateWallet(
    walletAddress: string,
    chainId: number,
    data: Partial<
      Pick<
        Wallet,
        'balance' | 'tradeBalance' | 'totalDeposited' | 'totalWithdrawn'
      >
    >,
  ): Promise<Wallet | null> {
    return WalletModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      { $set: data },
      { new: true },
    ).lean();
  }

  // Reset lại tổng nạp/rút về 0 (dành cho admin)
  async resetTotals(
    walletAddress: string,
    chainId: number,
  ): Promise<Wallet | null> {
    return WalletModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      { $set: { totalDeposited: 0, totalWithdrawn: 0 } },
      { new: true },
    ).lean();
  }

  // Xoá wallet hoàn toàn khỏi database (dành cho admin)
  async deleteWallet(walletAddress: string, chainId: number): Promise<boolean> {
    const result = await WalletModel.deleteOne({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
    });
    return result.deletedCount > 0;
  }
}
