import { Injectable, BadRequestException } from '@nestjs/common';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { Position } from 'src/shared/types/position.type';

@Injectable()
export class PositionService {
  constructor(private readonly repo: PositionRepository) {}

  /* ================= OPEN ================= */

  // mở lệnh market → open ngay
  async openMarket(data: Position) {
    return this.repo.create({
      ...data,
      status: 'open',
      entryPrice: data.entryPrice,
    });
  }

  // mở lệnh limit → pending
  async openLimit(data: Position) {
    return this.repo.create({
      ...data,
      status: 'pending',
    });
  }

  /* ================= ORDERS ================= */

  // edit order limit (chỉ pending)
  async updatePending(id: string, data: Partial<Position>) {
    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'pending') {
      throw new BadRequestException('Order is not pending');
    }
    return this.repo.update(id, data);
  }

  // huỷ order limit
  async cancelOrder(id: string) {
    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'pending') {
      throw new BadRequestException('Order cannot be cancelled');
    }
    return this.repo.update(id, { status: 'closed' });
  }

  // order đang mở (pending)
  async getOpenOrders(walletAddress: string) {
    const list = await this.repo.findActiveByWallet(walletAddress);
    return list.filter((p) => p.status === 'pending');
  }

  // lịch sử order
  async getOrderHistory(walletAddress: string) {
    const list = await this.repo.findByWallet(walletAddress);
    return list.filter((p) => p.status === 'closed');
  }

  /* ================= POSITIONS ================= */

  // position đang active (open)
  async getActivePositions(walletAddress: string) {
    const list = await this.repo.findActiveByWallet(walletAddress);
    return list.filter((p) => p.status === 'open');
  }

  async getHistory(walletAddress: string) {
    const list = await this.repo.findByWallet(walletAddress);
    return list.filter((p) => p.status === 'closed');
  }

  async getById(id: string) {
    return this.repo.findById(id);
  }

  // edit position đang mở
  async updateOpen(id: string, data: Partial<Position>) {
    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'open') {
      throw new BadRequestException('Position is not open');
    }
    return this.repo.update(id, data);
  }

  // đóng position toàn phần
  async close(id: string, pnl: number) {
    const pos = await this.repo.findById(id);
    if (!pos || pos.status !== 'open') {
      throw new BadRequestException('Position is not open');
    }
    return this.repo.close(id, pnl);
  }
}
