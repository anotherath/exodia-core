import { Injectable, BadRequestException } from '@nestjs/common';
import { isAddress } from 'viem';
import { HexString } from 'src/shared/types/web3.type';

@Injectable()
export class WalletValidationService {
  /**
   * Validate địa chỉ ví (Ethereum address)
   */
  validateWalletAddress(walletAddress: string): HexString {
    if (!walletAddress) {
      throw new BadRequestException('Địa chỉ ví không được để trống');
    }

    if (!isAddress(walletAddress)) {
      throw new BadRequestException('Địa chỉ ví không hợp lệ');
    }

    return walletAddress.toLowerCase() as HexString;
  }

  /**
   * Validate chainId
   */
  validateChainId(chainId: unknown): number {
    const id = Number(chainId);
    if (isNaN(id) || id <= 0 || !isFinite(id)) {
      throw new BadRequestException('Chain ID không hợp lệ');
    }
    return id;
  }

  /**
   * Validate số tiền nạp/rút
   */
  validateAmount(amount: unknown): number {
    const num = Number(amount);
    if (isNaN(num) || num <= 0 || !isFinite(num)) {
      throw new BadRequestException('Số tiền phải là số lớn hơn 0');
    }
    return num;
  }

  /**
   * Validate thông tin transaction (deposit/withdraw)
   */
  validateTransaction(data: {
    walletAddress: string;
    chainId: number;
    amount: number;
  }) {
    this.validateWalletAddress(data.walletAddress);
    this.validateChainId(data.chainId);
    this.validateAmount(data.amount);
  }
}
