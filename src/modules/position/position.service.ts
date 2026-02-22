import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';
import { Position } from 'src/shared/types/position.type';
import type { HexString } from 'src/shared/types/web3.type';
import {
  OpenOrderTypes,
  UpdateOrderTypes,
  CancelOrderTypes,
  ClosePositionTypes,
  UpdatePositionTypes,
  type OpenOrderValue,
  type UpdateOrderValue,
  type CancelOrderValue,
  type ClosePositionValue,
  type UpdatePositionValue,
} from 'src/shared/types/eip712.type';
import { MarketPriceCache } from '../market/market-price.cache';
import { PositionValidationService } from './position-validation.service';
import { calculatePnL } from 'src/shared/utils/math.util';
import { WalletService } from '../wallet/wallet.service';
import { EIP712_DOMAIN } from 'src/shared/types/eip712.type';

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name);

  constructor(
    private readonly repo: PositionRepository,
    private readonly priceCache: MarketPriceCache,
    private readonly validator: PositionValidationService,
    private readonly walletService: WalletService,
  ) {}

  // Mở lệnh Market (khớp ngay)
  async openMarket(
    data: Position,
    typedData: OpenOrderValue,
    signature: HexString,
  ) {
    await this.validator.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: OpenOrderTypes,
      primaryType: 'OpenOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    const ticker = this.priceCache.get(data.symbol);
    if (!ticker) {
      throw new BadRequestException(
        'Hiện chưa có giá thị trường cho cặp tiền này',
      );
    }

    const entryPrice =
      data.side === 'long'
        ? parseFloat(ticker.askPx)
        : parseFloat(ticker.bidPx);

    this.validator.validateSLTP(data.side, entryPrice, data.sl, data.tp);

    return this.repo.create({
      ...data,
      status: 'open',
      entryPrice: entryPrice,
      price: null,
    });
  }

  // Mở lệnh Limit (chờ khớp)
  async openLimit(
    data: Position,
    typedData: OpenOrderValue,
    signature: HexString,
  ) {
    await this.validator.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: OpenOrderTypes,
      primaryType: 'OpenOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    this.validator.validateLimitPrice(data);

    return this.repo.create({
      ...data,
      status: 'pending',
      entryPrice: null,
    });
  }

  // Sửa lệnh đang chờ
  async updatePending(
    id: string,
    data: Partial<Position>,
    typedData: UpdateOrderValue,
    signature: HexString,
  ) {
    await this.validator.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: UpdateOrderTypes,
      primaryType: 'UpdateOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'pending') {
      throw new BadRequestException(
        'Lệnh không tồn tại hoặc không còn ở trạng thái chờ (pending)',
      );
    }

    const updatedData: Position = { ...pos, ...data };
    this.validator.validateLimitPrice(updatedData);

    return this.repo.update(id, {
      qty: data.qty,
      price: data.price,
      sl: data.sl,
      tp: data.tp,
      leverage: data.leverage,
    });
  }

  // Sửa vị thế đang mở
  async updateOpen(
    id: string,
    data: Partial<Position>,
    typedData: UpdatePositionValue,
    signature: HexString,
  ) {
    await this.validator.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: UpdatePositionTypes,
      primaryType: 'UpdatePosition',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'open') {
      throw new BadRequestException('Vị thế không tồn tại hoặc đã đóng');
    }

    // Đóng lệnh một phần: qty giảm
    if (data.qty && data.qty < pos.qty) {
      const closeQty = pos.qty - data.qty;
      this.validator.validatePartialClose(pos, closeQty);

      const ticker = this.priceCache.get(pos.symbol);
      if (!ticker)
        throw new BadRequestException('Không có giá thị trường để đóng lệnh');

      const exitPrice =
        pos.side === 'long'
          ? parseFloat(ticker.bidPx)
          : parseFloat(ticker.askPx);

      // Tính PnL cho phần đóng
      const pnl = calculatePnL(pos.side, closeQty, pos.entryPrice!, exitPrice);

      this.logger.log(
        `Partial Close Position ${id}: closeQty ${closeQty}, Exit Price ${exitPrice}, PnL ${pnl}`,
      );

      // Tạo position mới đại diện cho phần đã đóng
      await this.repo.create({
        walletAddress: pos.walletAddress,
        symbol: pos.symbol,
        side: pos.side,
        type: pos.type,
        status: 'closed',
        qty: closeQty,
        price: pos.price,
        entryPrice: pos.entryPrice,
        exitPrice,
        leverage: pos.leverage,
        pnl,
        sl: pos.sl,
        tp: pos.tp,
      });

      // Cập nhật PnL vào tradeBalance
      await this.walletService.updateTradePnL(
        pos.walletAddress,
        EIP712_DOMAIN.chainId,
        pnl,
      );

      // Cập nhật vị thế gốc với qty còn lại
      return this.repo.update(id, {
        qty: data.qty,
        sl: data.sl ?? pos.sl,
        tp: data.tp ?? pos.tp,
        leverage: data.leverage ?? pos.leverage,
      });
    }

    // Không cho tăng qty
    if (data.qty && data.qty > pos.qty) {
      throw new BadRequestException(
        'Không thể tăng khối lượng vị thế trực tiếp',
      );
    }

    // Cập nhật SL/TP/Leverage (không liên quan đến qty)
    if (data.sl || data.tp) {
      this.validator.validateSLTP(pos.side, pos.entryPrice!, data.sl, data.tp);
    }

    return this.repo.update(id, {
      sl: data.sl,
      tp: data.tp,
      leverage: data.leverage,
    });
  }

  // Huỷ lệnh chờ
  async cancelOrder(
    id: string,
    typedData: CancelOrderValue,
    signature: HexString,
  ) {
    await this.validator.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: CancelOrderTypes,
      primaryType: 'CancelOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'pending') {
      throw new BadRequestException('Lệnh không thể hủy');
    }
    return this.repo.update(id, { status: 'closed' });
  }

  // Đóng toàn bộ vị thế
  async close(
    id: string,
    _pnl: number,
    typedData: ClosePositionValue,
    signature: HexString,
  ) {
    await this.validator.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: ClosePositionTypes,
      primaryType: 'ClosePosition',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'open') {
      throw new BadRequestException('Vị thế không tồn tại hoặc đã đóng');
    }

    const ticker = this.priceCache.get(pos.symbol);
    if (!ticker)
      throw new BadRequestException('Không có giá thị trường để đóng lệnh');

    const exitPrice =
      pos.side === 'long' ? parseFloat(ticker.bidPx) : parseFloat(ticker.askPx);
    const pnl = calculatePnL(pos.side, pos.qty, pos.entryPrice!, exitPrice);

    this.logger.log(
      `Closing Position ${id}: Exit Price ${exitPrice}, PnL ${pnl}`,
    );

    // Cập nhật PnL vào tradeBalance của ví
    await this.walletService.updateTradePnL(
      pos.walletAddress,
      EIP712_DOMAIN.chainId,
      pnl,
    );

    return this.repo.close(id, pnl, exitPrice);
  }

  // Lấy danh sách lệnh chờ
  async getOpenOrders(walletAddress: string) {
    const list = await this.repo.findActiveByWallet(walletAddress);
    return list.filter((p) => p.status === 'pending');
  }

  // Lấy lịch sử lệnh chờ
  async getOrderHistory(walletAddress: string) {
    const list = await this.repo.findByWallet(walletAddress);
    return list.filter((p) => p.status === 'closed');
  }

  // Lấy danh sách vị thế đang mở
  async getActivePositions(walletAddress: string) {
    const list = await this.repo.findActiveByWallet(walletAddress);
    return list.filter((p) => p.status === 'open');
  }

  // Lấy lịch sử vị thế
  async getHistory(walletAddress: string) {
    const list = await this.repo.findByWallet(walletAddress);
    return list.filter((p) => p.status === 'closed');
  }

  // Lấy thông tin vị thế theo ID
  async getById(id: string) {
    return this.repo.findById(id);
  }
}
