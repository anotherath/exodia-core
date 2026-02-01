import { Injectable } from '@nestjs/common';
import { PairModel } from './pair.model';

@Injectable()
export class PairRepository {
  // Lấy tất cả cặp đang active
  findAllActive() {
    return PairModel.find({ isActive: true }).lean();
  }

  // Lấy 1 cặp theo instId
  findByInstId(instId: string) {
    return PairModel.findOne({ instId, isActive: true }).lean();
  }
}
