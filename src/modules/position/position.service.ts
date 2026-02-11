import { Injectable, BadRequestException } from '@nestjs/common';
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
import { verifyTypedDataSignature } from 'src/shared/utils/eip712.util';

@Injectable()
export class PositionService {
  constructor(
    private readonly repo: PositionRepository,
    private readonly nonceRepo: NonceRepository,
  ) {}

  /* ================= PRIVATE HELPERS ================= */

  /**
   * Verify nonce: kiểm tra nonce trong typed data khớp với nonce trong DB,
   * sau đó verify chữ ký EIP-712, cuối cùng xóa nonce đã dùng.
   */
  private async verifyAndConsumeNonce(params: {
    walletAddress: HexString;
    nonce: string;
    signature: HexString;
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<void> {
    const { walletAddress, nonce, signature, types, primaryType, message } =
      params;

    // 1. Kiểm tra nonce hợp lệ trong DB
    const nonceInfo = await this.nonceRepo.findValid(walletAddress);
    if (!nonceInfo || nonceInfo.nonce !== nonce) {
      throw new BadRequestException('Nonce không hợp lệ hoặc đã hết hạn');
    }

    // 2. Verify chữ ký EIP-712
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

    // 3. Xóa nonce sau khi dùng (one-time use)
    await this.nonceRepo.delete(walletAddress);
  }

  /* ================= OPEN ================= */

  // mở lệnh market → open ngay
  async openMarket(
    data: Position,
    typedData: OpenOrderValue,
    signature: HexString,
  ) {
    await this.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: OpenOrderTypes,
      primaryType: 'OpenOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    return this.repo.create({
      ...data,
      status: 'open',
      entryPrice: data.entryPrice,
    });
  }

  // mở lệnh limit → pending
  async openLimit(
    data: Position,
    typedData: OpenOrderValue,
    signature: HexString,
  ) {
    await this.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: OpenOrderTypes,
      primaryType: 'OpenOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    return this.repo.create({
      ...data,
      status: 'pending',
    });
  }

  /* ================= ORDERS ================= */

  // edit order limit (chỉ pending)
  async updatePending(
    id: string,
    data: Partial<Position>,
    typedData: UpdateOrderValue,
    signature: HexString,
  ) {
    await this.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: UpdateOrderTypes,
      primaryType: 'UpdateOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'pending') {
      throw new BadRequestException('Order is not pending');
    }
    return this.repo.update(id, data);
  }

  // huỷ order limit
  async cancelOrder(
    id: string,
    typedData: CancelOrderValue,
    signature: HexString,
  ) {
    await this.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: CancelOrderTypes,
      primaryType: 'CancelOrder',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'pending') {
      throw new BadRequestException('Order cannot be cancelled');
    }
    return this.repo.update(id, { status: 'closed' });
  }

  // order đang mở (pending) — READ, không cần verify
  async getOpenOrders(walletAddress: string) {
    const list = await this.repo.findActiveByWallet(walletAddress);
    return list.filter((p) => p.status === 'pending');
  }

  // lịch sử order — READ, không cần verify
  async getOrderHistory(walletAddress: string) {
    const list = await this.repo.findByWallet(walletAddress);
    return list.filter((p) => p.status === 'closed');
  }

  /* ================= POSITIONS ================= */

  // position đang active (open) — READ, không cần verify
  async getActivePositions(walletAddress: string) {
    const list = await this.repo.findActiveByWallet(walletAddress);
    return list.filter((p) => p.status === 'open');
  }

  // history — READ, không cần verify
  async getHistory(walletAddress: string) {
    const list = await this.repo.findByWallet(walletAddress);
    return list.filter((p) => p.status === 'closed');
  }

  // get by id — READ, không cần verify
  async getById(id: string) {
    return this.repo.findById(id);
  }

  // edit position đang mở
  async updateOpen(
    id: string,
    data: Partial<Position>,
    typedData: UpdatePositionValue,
    signature: HexString,
  ) {
    await this.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: UpdatePositionTypes,
      primaryType: 'UpdatePosition',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'open') {
      throw new BadRequestException('Position is not open');
    }
    return this.repo.update(id, data);
  }

  // đóng position toàn phần
  async close(
    id: string,
    pnl: number,
    typedData: ClosePositionValue,
    signature: HexString,
  ) {
    await this.verifyAndConsumeNonce({
      walletAddress: typedData.walletAddress as HexString,
      nonce: typedData.nonce,
      signature,
      types: ClosePositionTypes,
      primaryType: 'ClosePosition',
      message: typedData as unknown as Record<string, unknown>,
    });

    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'open') {
      throw new BadRequestException('Position is not open');
    }
    return this.repo.close(id, pnl);
  }
}
