import { Injectable } from '@nestjs/common';
import { PairModel } from './pair.model';
import { Pair } from 'src/shared/types/pair.type';

@Injectable()
export class PairRepository {
  // Lấy tất cả cặp đang active
  findAllActive() {
    return PairModel.find({ isActive: true }).lean();
  }

  // Lấy 1 cặp theo instId (bất kể active hay không để check tồn tại)
  findByInstId(instId: string) {
    return PairModel.findOne({ instId }).lean();
  }

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

  // Lấy danh sách tất cả (cho Admin)
  async findAll() {
    return PairModel.find({}).lean();
  }
}
