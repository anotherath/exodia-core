import { Injectable } from '@nestjs/common';
import { PositionModel } from './position.model';
import { Position, PositionStatus } from 'src/shared/types/position.type';

@Injectable()
export class PositionRepository {
  private baseQuery() {
    return { deletedAt: null };
  }

  // ════════════════════════════════════════
  //  QUERY (Đọc dữ liệu)
  // ════════════════════════════════════════

  // Lấy position theo id (chỉ chưa soft-delete)
  async findById(id: string): Promise<Position | null> {
    return PositionModel.findOne({
      _id: id,
      ...this.baseQuery(),
    }).lean();
  }

  // Lấy tất cả position của 1 wallet
  async findByWallet(walletAddress: string): Promise<Position[]> {
    return PositionModel.find({
      walletAddress: walletAddress.toLowerCase(),
      ...this.baseQuery(),
    }).lean();
  }

  // Lấy position đang active (pending + open)
  async findActiveByWallet(walletAddress: string): Promise<Position[]> {
    return PositionModel.find({
      walletAddress: walletAddress.toLowerCase(),
      status: { $in: ['pending', 'open'] },
      ...this.baseQuery(),
    }).lean();
  }

  // Lấy danh sách position có phân trang và lọc (admin)
  async findAll(
    filter: {
      walletAddress?: string;
      symbol?: string;
      side?: 'long' | 'short';
      type?: 'market' | 'limit';
      status?: PositionStatus;
    } = {},
    page = 1,
    limit = 20,
  ): Promise<{ data: Position[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = { ...this.baseQuery() };

    if (filter.walletAddress) {
      query.walletAddress = filter.walletAddress.toLowerCase();
    }
    if (filter.symbol) {
      query.symbol = filter.symbol;
    }
    if (filter.side) {
      query.side = filter.side;
    }
    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PositionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PositionModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  // Lấy tất cả kể cả soft-deleted (admin debug)
  async findAllIncludeDeleted(
    filter: {
      walletAddress?: string;
      symbol?: string;
      status?: PositionStatus;
    } = {},
    page = 1,
    limit = 20,
  ): Promise<{ data: Position[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = {};

    if (filter.walletAddress) {
      query.walletAddress = filter.walletAddress.toLowerCase();
    }
    if (filter.symbol) {
      query.symbol = filter.symbol;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PositionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PositionModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  // Đếm tổng position (chưa soft-delete)
  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return PositionModel.countDocuments({ ...this.baseQuery(), ...filter });
  }

  // ════════════════════════════════════════
  //  MUTATION (User flow – ghi dữ liệu)
  // ════════════════════════════════════════

  // Tạo position mới (market hoặc limit)
  async create(data: Omit<Position, '_id'>): Promise<Position> {
    return PositionModel.create({
      ...data,
      walletAddress: data.walletAddress.toLowerCase(),
    });
  }

  // Cập nhật position (open / close / update pnl)
  async update(id: string, data: Partial<Position>): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: data },
      { new: true },
    ).lean();
  }

  // Đóng position
  async close(
    id: string,
    pnl: number,
    exitPrice: number,
    closeFee: number = 0,
  ): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      {
        $set: {
          status: 'closed',
          pnl,
          exitPrice,
          closeFee,
        },
      },
      { new: true },
    ).lean();
  }

  // Soft-delete position (hiếm khi dùng, chủ yếu debug)
  async softDelete(id: string): Promise<void> {
    await PositionModel.updateOne(
      { _id: id },
      { $set: { deletedAt: new Date() } },
    );
  }

  // ════════════════════════════════════════
  //  ADMIN – Cập nhật thông tin position
  // ════════════════════════════════════════

  // Cập nhật SL/TP (admin override)
  async setSlTp(
    id: string,
    sl: number | null,
    tp: number | null,
  ): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: { sl, tp } },
      { new: true },
    ).lean();
  }

  // Cập nhật leverage (admin override)
  async setLeverage(id: string, leverage: number): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: { leverage } },
      { new: true },
    ).lean();
  }

  // Cập nhật trạng thái position (admin force)
  async setStatus(
    id: string,
    status: PositionStatus,
  ): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: { status } },
      { new: true },
    ).lean();
  }

  // Cập nhật entryPrice (admin fix lỗi)
  async setEntryPrice(
    id: string,
    entryPrice: number,
  ): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: { entryPrice } },
      { new: true },
    ).lean();
  }

  // Cập nhật PnL trực tiếp (admin override)
  async setPnl(id: string, pnl: number): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: { pnl } },
      { new: true },
    ).lean();
  }

  // Cập nhật partial position (admin – chỉ cho phép các field an toàn)
  async adminUpdate(
    id: string,
    data: Partial<
      Pick<
        Position,
        | 'status'
        | 'pnl'
        | 'entryPrice'
        | 'exitPrice'
        | 'leverage'
        | 'sl'
        | 'tp'
        | 'openFee'
        | 'closeFee'
      >
    >,
  ): Promise<Position | null> {
    return PositionModel.findOneAndUpdate(
      { _id: id, ...this.baseQuery() },
      { $set: data },
      { new: true },
    ).lean();
  }

  // ════════════════════════════════════════
  //  ADMIN – Khôi phục & xóa vĩnh viễn
  // ════════════════════════════════════════

  // Khôi phục position đã bị soft-delete
  async restore(id: string): Promise<void> {
    await PositionModel.updateOne({ _id: id }, { $set: { deletedAt: null } });
  }

  // Xóa vĩnh viễn position (admin)
  async hardDelete(id: string): Promise<boolean> {
    const result = await PositionModel.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  // ════════════════════════════════════════
  //  ADMIN – Hàng loạt (Bulk)
  // ════════════════════════════════════════

  // Đóng nhiều position cùng lúc (admin force close)
  async bulkClose(ids: string[], pnl: number = 0): Promise<number> {
    const result = await PositionModel.updateMany(
      { _id: { $in: ids }, ...this.baseQuery() },
      { $set: { status: 'closed', pnl } },
    );
    return result.modifiedCount;
  }

  // Soft-delete nhiều position cùng lúc
  async bulkSoftDelete(ids: string[]): Promise<number> {
    const result = await PositionModel.updateMany(
      { _id: { $in: ids } },
      { $set: { deletedAt: new Date() } },
    );
    return result.modifiedCount;
  }

  // Xóa vĩnh viễn nhiều position (admin)
  async bulkHardDelete(ids: string[]): Promise<number> {
    const result = await PositionModel.deleteMany({
      _id: { $in: ids },
    });
    return result.deletedCount;
  }
}
