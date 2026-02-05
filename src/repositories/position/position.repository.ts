import { Injectable } from '@nestjs/common';
import { PositionModel } from './position.model';
import { Position, PositionStatus } from 'src/shared/types/position.type';

@Injectable()
export class PositionRepository {
  private baseQuery() {
    return { deletedAt: null };
  }

  // lấy position theo id
  async findById(id: string): Promise<Position | null> {
    return PositionModel.findOne({
      _id: id,
      ...this.baseQuery(),
    }).lean();
  }

  // lấy tất cả position của 1 wallet
  async findByWallet(walletAddress: string): Promise<Position[]> {
    return PositionModel.find({
      walletAddress: walletAddress.toLowerCase(),
      ...this.baseQuery(),
    }).lean();
  }

  // lấy position đang active (pending + open)
  async findActiveByWallet(walletAddress: string): Promise<Position[]> {
    return PositionModel.find({
      walletAddress: walletAddress.toLowerCase(),
      status: { $in: ['pending', 'open'] },
      ...this.baseQuery(),
    }).lean();
  }

  // tạo position mới (market hoặc limit)
  async create(data: Omit<Position, '_id'>): Promise<Position> {
    return PositionModel.create({
      ...data,
      walletAddress: data.walletAddress.toLowerCase(),
    });
  }

  // update position (open / close / update pnl)
  async update(id: string, data: Partial<Position>): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: data },
      { new: true },
    ).lean();
  }

  // đóng position
  async close(id: string, pnl: number): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      {
        $set: {
          status: 'closed',
          pnl,
        },
      },
      { new: true },
    ).lean();
  }

  // soft delete position (hiếm khi dùng, chủ yếu debug)
  async softDelete(id: string): Promise<void> {
    await PositionModel.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } },
    );
  }
}
