import { Injectable } from '@nestjs/common';
import { PairModel } from './pair.model';
import { Pair } from 'src/shared/types/pair.type';

@Injectable()
export class PairRepository {
  // ════════════════════════════════════════
  //  QUERY (Đọc dữ liệu)
  // ════════════════════════════════════════

  // Lấy tất cả cặp đang active
  findAllActive() {
    return PairModel.find({ isActive: true }).lean();
  }

  // Lấy 1 cặp theo instId (bất kể active hay không để check tồn tại)
  findByInstId(instId: string) {
    return PairModel.findOne({ instId }).lean();
  }

  // Lấy cặp theo MongoDB _id
  async findById(id: string): Promise<Pair | null> {
    return PairModel.findById(id).lean();
  }

  // Lấy danh sách tất cả (cho Admin) – không phân trang
  async findAll() {
    return PairModel.find({}).lean();
  }

  // Lấy danh sách cặp có phân trang và bộ lọc (admin)
  async findAllPaginated(
    filter: {
      instId?: string;
      isActive?: boolean;
      minLeverage?: number;
      maxLeverage?: number;
    } = {},
    page = 1,
    limit = 20,
  ): Promise<{ data: Pair[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = {};

    if (filter.instId) {
      query.instId = filter.instId;
    }
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }
    if (filter.minLeverage !== undefined || filter.maxLeverage !== undefined) {
      query.maxLeverage = {};
      if (filter.minLeverage !== undefined) {
        (query.maxLeverage as Record<string, number>).$gte = filter.minLeverage;
      }
      if (filter.maxLeverage !== undefined) {
        (query.maxLeverage as Record<string, number>).$lte = filter.maxLeverage;
      }
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PairModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PairModel.countDocuments(query),
    ]);

    return { data, total, page, limit };
  }

  // Đếm tổng số cặp (có thể truyền filter tùy chọn)
  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return PairModel.countDocuments(filter);
  }

  // ════════════════════════════════════════
  //  MUTATION (Ghi dữ liệu)
  // ════════════════════════════════════════

  // Thêm mới hoặc cập nhật cặp tiền
  async upsert(data: Pair) {
    return PairModel.findOneAndUpdate(
      { instId: data.instId },
      { $set: data },
      { upsert: true, new: true },
    ).lean();
  }

  // Cập nhật trạng thái active
  async updateStatus(instId: string, isActive: boolean) {
    return PairModel.findOneAndUpdate(
      { instId },
      { $set: { isActive } },
      { new: true },
    ).lean();
  }

  // Xóa cặp tiền
  async delete(instId: string) {
    return PairModel.deleteOne({ instId });
  }

  // ════════════════════════════════════════
  //  ADMIN – Cập nhật thông tin cặp tiền
  // ════════════════════════════════════════

  // Cập nhật partial thông tin cặp tiền (admin)
  async updatePair(
    instId: string,
    data: Partial<
      Pick<
        Pair,
        | 'maxLeverage'
        | 'minVolume'
        | 'minAmount'
        | 'openFeeRate'
        | 'closeFeeRate'
        | 'isActive'
      >
    >,
  ): Promise<Pair | null> {
    return PairModel.findOneAndUpdate(
      { instId },
      { $set: data },
      { new: true },
    ).lean();
  }

  // Cập nhật đòn bẩy tối đa (admin)
  async setMaxLeverage(
    instId: string,
    maxLeverage: number,
  ): Promise<Pair | null> {
    return PairModel.findOneAndUpdate(
      { instId },
      { $set: { maxLeverage } },
      { new: true },
    ).lean();
  }

  // Cập nhật phí giao dịch (admin)
  async setFeeRates(
    instId: string,
    openFeeRate: number,
    closeFeeRate: number,
  ): Promise<Pair | null> {
    return PairModel.findOneAndUpdate(
      { instId },
      { $set: { openFeeRate, closeFeeRate } },
      { new: true },
    ).lean();
  }

  // Cập nhật minVolume và minAmount (admin)
  async setMinimums(
    instId: string,
    minVolume: number,
    minAmount: number,
  ): Promise<Pair | null> {
    return PairModel.findOneAndUpdate(
      { instId },
      { $set: { minVolume, minAmount } },
      { new: true },
    ).lean();
  }

  // ════════════════════════════════════════
  //  ADMIN – Hàng loạt (Bulk operations)
  // ════════════════════════════════════════

  // Kích hoạt nhiều cặp cùng lúc (admin)
  async bulkActivate(instIds: string[]): Promise<number> {
    const result = await PairModel.updateMany(
      { instId: { $in: instIds } },
      { $set: { isActive: true } },
    );
    return result.modifiedCount;
  }

  // Vô hiệu hóa nhiều cặp cùng lúc (admin)
  async bulkDeactivate(instIds: string[]): Promise<number> {
    const result = await PairModel.updateMany(
      { instId: { $in: instIds } },
      { $set: { isActive: false } },
    );
    return result.modifiedCount;
  }

  // Xóa nhiều cặp cùng lúc (admin)
  async bulkDelete(instIds: string[]): Promise<number> {
    const result = await PairModel.deleteMany({
      instId: { $in: instIds },
    });
    return result.deletedCount;
  }
}
