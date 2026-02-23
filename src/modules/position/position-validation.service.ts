import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { NonceRepository } from 'src/repositories/cache/nonce.cache';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { Position } from 'src/shared/types/position.type';
import { Pair } from 'src/shared/types/pair.type';
import type { HexString } from 'src/shared/types/web3.type';
import { verifyTypedDataSignature } from 'src/shared/utils/eip712.util';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { WalletService } from '../wallet/wallet.service';
import {
  calculateInitialMargin,
  calculateFee,
  calculateOrderCost,
} from 'src/shared/utils/math.util';
import { EIP712_DOMAIN } from 'src/shared/types/eip712.type';

@Injectable()
export class PositionValidationService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly nonceRepo: NonceRepository,
    private readonly pairRepo: PairRepository,
    private readonly marketPriceRepo: RealtimeMarketPriceRepository,
    private readonly walletService: WalletService,
  ) {}

  // Validate symbol tồn tại, đang active, và các tham số hợp lệ với cấu hình của cặp giao dịch
  async validateSymbolAndParams(data: Position): Promise<Pair> {
    const pair = await this.pairRepo.findByInstId(data.symbol);

    if (!pair) {
      throw new BadRequestException(
        `Cặp giao dịch '${data.symbol}' không tồn tại trong hệ thống`,
      );
    }

    if (!pair.isActive) {
      throw new BadRequestException(
        `Cặp giao dịch '${data.symbol}' hiện đang tạm dừng giao dịch`,
      );
    }

    if (data.qty < pair.minVolume) {
      throw new BadRequestException(
        `Khối lượng tối thiểu cho ${data.symbol} là ${pair.minVolume}`,
      );
    }

    // Validate min amount in USD
    const referencePrice = data.type === 'limit' ? data.entryPrice : null;
    let priceForMinAmount = referencePrice;

    if (!priceForMinAmount) {
      const ticker = await this.marketPriceRepo.get(data.symbol);
      if (ticker) {
        priceForMinAmount = parseFloat(ticker.last);
      }
    }

    if (priceForMinAmount && priceForMinAmount > 0) {
      const orderAmountUSD = data.qty * priceForMinAmount;
      if (orderAmountUSD < pair.minAmount) {
        throw new BadRequestException(
          `Giá trị lệnh tối thiểu cho ${data.symbol} là ${pair.minAmount} USD (Hiện tại: ${orderAmountUSD.toFixed(2)} USD)`,
        );
      }
    }

    if (data.leverage > pair.maxLeverage) {
      throw new BadRequestException(
        `Đòn bẩy tối đa cho ${data.symbol} là ${pair.maxLeverage}x`,
      );
    }

    if (data.leverage < 1) {
      throw new BadRequestException('Đòn bẩy phải lớn hơn hoặc bằng 1');
    }

    return pair;
  }

  // Xác thực chữ ký và tiêu thụ nonce
  async verifyAndConsumeNonce(params: {
    walletAddress: HexString;
    nonce: string;
    signature: HexString;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<void> {
    const { walletAddress, nonce, signature, types, primaryType, message } =
      params;

    const nonceInfo = await this.nonceRepo.findValid(walletAddress);
    if (!nonceInfo || nonceInfo.nonce !== nonce) {
      throw new BadRequestException('Nonce không hợp lệ hoặc đã hết hạn');
    }

    const isValid = await verifyTypedDataSignature({
      types,
      primaryType,
      message,
      signature,
      walletAddress,
    });

    if (!isValid) {
      throw new BadRequestException('Chữ ký không hợp lệ');
    }

    await this.nonceRepo.delete(walletAddress);
  }

  // Kiểm tra tính hợp lệ giá đặt cho lệnh Limit
  async validateLimitPrice(data: Position) {
    const { symbol, side, entryPrice, tp, sl } = data;

    if (!entryPrice || entryPrice <= 0) {
      throw new BadRequestException('Giá đặt (Limit Price) không hợp lệ');
    }

    const ticker = await this.marketPriceRepo.get(symbol);
    if (!ticker) {
      throw new BadRequestException(
        'Hiện chưa có giá thị trường cho cặp tiền này',
      );
    }

    const ask = parseFloat(ticker.askPx);
    const bid = parseFloat(ticker.bidPx);

    if (side === 'long') {
      if (entryPrice >= ask) {
        throw new BadRequestException(
          'Giá Long Limit phải thấp hơn giá thị trường hiện tại',
        );
      }
    } else {
      if (entryPrice <= bid) {
        throw new BadRequestException(
          'Giá Short Limit phải cao hơn giá thị trường hiện tại',
        );
      }
    }

    this.validateSLTP(side, entryPrice, sl, tp);
  }

  // Kiểm tra tính hợp lệ của SL/TP so với giá tham chiếu
  validateSLTP(
    side: string,
    referencePrice: number,
    sl?: number | null,
    tp?: number | null,
  ) {
    if (sl !== undefined && sl !== null && sl <= 0) {
      throw new BadRequestException('Giá cắt lỗ (SL) phải lớn hơn 0');
    }
    if (tp !== undefined && tp !== null && tp <= 0) {
      throw new BadRequestException('Giá chốt lời (TP) phải lớn hơn 0');
    }

    if (side === 'long') {
      if (sl && sl >= referencePrice) {
        throw new BadRequestException(
          'Cắt lỗ (SL) của Long phải thấp hơn giá tham chiếu',
        );
      }
      if (tp && tp <= referencePrice) {
        throw new BadRequestException(
          'Chốt lời (TP) của Long phải cao hơn giá tham chiếu',
        );
      }
    } else {
      if (sl && sl <= referencePrice) {
        throw new BadRequestException(
          'Cắt lỗ (SL) của Short phải cao hơn giá tham chiếu',
        );
      }
      if (tp && tp >= referencePrice) {
        throw new BadRequestException(
          'Chốt lời (TP) của Short phải thấp hơn giá tham chiếu',
        );
      }
    }
  }

  // Validate đóng lệnh một phần
  validatePartialClose(pos: Position, closeQty: number) {
    if (closeQty <= 0) {
      throw new BadRequestException('Khối lượng đóng phải lớn hơn 0');
    }
    if (closeQty >= pos.qty) {
      throw new BadRequestException(
        'Khối lượng đóng phải nhỏ hơn khối lượng hiện tại. Dùng chức năng đóng lệnh toàn bộ nếu muốn đóng hết',
      );
    }
  }

  // Kiểm tra số dư khả dụng trước khi mở lệnh
  async validateMargin(params: {
    walletAddress: string;
    qty: number;
    price: number;
    leverage: number;
    feeRate: number;
  }): Promise<void> {
    const { walletAddress, qty, price, leverage, feeRate } = params;

    const orderCost = calculateOrderCost(qty, price, leverage, feeRate);
    const availableBalance = await this.getAvailableBalance(walletAddress);

    if (availableBalance < orderCost) {
      const initialMargin = calculateInitialMargin(qty, price, leverage);
      const openFee = calculateFee(qty, price, feeRate);
      throw new BadRequestException(
        `Không đủ số dư để mở lệnh. ` +
          `Cần: ${orderCost.toFixed(2)} USDT ` +
          `(Ký quỹ: ${initialMargin.toFixed(2)} + Phí: ${openFee.toFixed(2)}). ` +
          `Số dư khả dụng: ${availableBalance.toFixed(2)} USDT`,
      );
    }
  }

  // Lấy số dư khả dụng: ưu tiên Redis (real-time), fallback MongoDB (cold start)
  private async getAvailableBalance(walletAddress: string): Promise<number> {
    const account = await this.redis.hgetall(
      `account:${walletAddress.toLowerCase()}`,
    );

    // Đã có dữ liệu trong Redis (đang có vị thế mở)
    if (account && account.tradeBalance) {
      const tradeBalance = parseFloat(account.tradeBalance);
      const totalUnrealizedPnL = parseFloat(account.totalUnrealizedPnL || '0');
      const totalInitialMargin = parseFloat(account.totalInitialMargin || '0');
      const totalReservedMargin = parseFloat(
        account.totalReservedMargin || '0',
      );

      return (
        tradeBalance +
        totalUnrealizedPnL -
        totalInitialMargin -
        totalReservedMargin
      );
    }

    // Cold start: chưa có vị thế nào, lấy từ MongoDB
    const wallet = await this.walletService.getWallet(
      walletAddress,
      EIP712_DOMAIN.chainId,
    );
    return wallet?.tradeBalance ?? 0;
  }
}
