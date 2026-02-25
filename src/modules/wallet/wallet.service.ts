import { Injectable, BadRequestException } from '@nestjs/common';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';
import { WalletValidationService } from './wallet-validation.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly repo: WalletRepository,
    private readonly walletValidation: WalletValidationService,
  ) {}

  async getWallet(walletAddress: string, chainId: number) {
    this.walletValidation.validateWalletAddress(walletAddress);
    this.walletValidation.validateChainId(chainId);
    return this.repo.upsert(walletAddress, chainId);
  }

  // Chuyển tiền vào quỹ giao dịch
  async depositToTrade(walletAddress: string, chainId: number, amount: number) {
    this.walletValidation.validateTransaction({
      walletAddress,
      chainId,
      amount,
    });

    const wallet = await this.repo.find(walletAddress, chainId);
    if (!wallet || wallet.balance < amount) {
      throw new BadRequestException('Số dư khả dụng không đủ');
    }
    await this.repo.depositToTrade(walletAddress, chainId, amount);
  }

  // Rút tiền từ quỹ giao dịch về số dư khả dụng
  async withdrawFromTrade(
    walletAddress: string,
    chainId: number,
    amount: number,
  ) {
    this.walletValidation.validateTransaction({
      walletAddress,
      chainId,
      amount,
    });

    const wallet = await this.repo.find(walletAddress, chainId);
    if (!wallet || wallet.tradeBalance < amount) {
      throw new BadRequestException('Số dư giao dịch không đủ');
    }
    await this.repo.withdrawFromTrade(walletAddress, chainId, amount);
  }

  // Cập nhật PnL khi đóng lệnh
  async updateTradePnL(walletAddress: string, chainId: number, pnl: number) {
    // Không cần validation phức tạp ở đây vì hệ thống gọi ngầm, nhưng kiểm tra địa chỉ cho chắc
    this.walletValidation.validateWalletAddress(walletAddress);
    this.walletValidation.validateChainId(chainId);

    const wallet = await this.repo.find(walletAddress, chainId);
    if (!wallet) return;

    // Nếu PnL âm (thua lỗ) và lớn hơn số dư hiện tại, chỉ trừ tối đa về 0
    let pnlToApply = pnl;
    if (pnl < 0 && Math.abs(pnl) > wallet.tradeBalance) {
      pnlToApply = -wallet.tradeBalance;
    }

    await this.repo.updateTradePnL(walletAddress, chainId, pnlToApply);
  }
}
