// src/repositories/wallet.repository.ts
import { WalletModel } from './wallet.model';
import { Wallet } from 'src/shared/types/wallet.type';

export class WalletRepository {
  // Lấy wallet theo (wallet + chain)
  // Trả về null nếu chưa tồn tại
  async find(walletAddress: string, chainId: number): Promise<Wallet | null> {
    return WalletModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
    }).lean(); // dùng lean để trả plain object (nhẹ, nhanh)
  }

  // Tạo wallet nếu chưa có
  // Nếu đã tồn tại thì chỉ trả về document hiện tại (không thay đổi số dư)
  async upsert(walletAddress: string, chainId: number): Promise<Wallet> {
    return WalletModel.findOneAndUpdate(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
      {
        // Chỉ set khi INSERT lần đầu
        $setOnInsert: {
          balance: '0',
          lockedBalance: '0',
          totalDeposited: '0',
          totalWithdrawn: '0',
        },
      },
      { upsert: true, new: true }, // new=true trả doc sau update/insert
    ).lean();
  }

  // Nạp tiền:
  // - Nếu wallet CHƯA tồn tại → tạo mới
  // - Nếu ĐÃ tồn tại → cộng tiền vào balance
  async deposit(walletAddress: string, chainId: number, amount: string) {
    await WalletModel.updateOne(
      {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      },
      {
        $inc: {
          balance: Number(amount), // tiền khả dụng
          totalDeposited: Number(amount), // tổng tiền đã nạp
        },
        $setOnInsert: {
          lockedBalance: '0',
          totalWithdrawn: '0',
        },
      },
      { upsert: true },
    );
  }

  // Khi mở position:
  // chuyển tiền từ balance -> lockedBalance
  async lockBalance(walletAddress: string, chainId: number, amount: string) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          balance: -Number(amount), // trừ tiền khả dụng
          lockedBalance: Number(amount), // khoá tiền vào lệnh
        },
      },
    );
  }

  // Khi đóng position:
  // - Giải phóng lockedAmount khỏi lockedBalance
  // - Cộng finalAmount vào balance
  async unlockBalance(
    walletAddress: string,
    chainId: number,
    lockedAmount: string,
    finalAmount: string,
  ) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          balance: Number(finalAmount), // số tiền thực nhận
          lockedBalance: -Number(lockedAmount), // giải phóng tiền khoá
        },
      },
    );
  }

  // Khi user rút tiền
  // Trừ balance và cộng tổng tiền đã rút
  async withdraw(walletAddress: string, chainId: number, amount: string) {
    await WalletModel.updateOne(
      { walletAddress: walletAddress.toLowerCase(), chainId },
      {
        $inc: {
          balance: -Number(amount), // trừ tiền khả dụng
          totalWithdrawn: Number(amount), // tổng tiền đã rút
        },
      },
    );
  }
}
