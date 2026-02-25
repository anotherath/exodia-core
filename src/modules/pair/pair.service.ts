import { Injectable, Logger } from '@nestjs/common';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { Pair } from 'src/shared/types/pair.type';
import { PairValidationService } from './pair-validation.service';

@Injectable()
export class PairService {
  private readonly logger = new Logger(PairService.name);

  constructor(
    private readonly pairRepo: PairRepository,
    private readonly okxWs: OkxWs,
    private readonly pairValidation: PairValidationService,
  ) {}

  getAllActive() {
    return this.pairRepo.findAllActive();
  }

  getAll() {
    return this.pairRepo.findAll();
  }

  getByInstId(instId: string) {
    this.pairValidation.validateInstId(instId);
    return this.pairRepo.findByInstId(instId);
  }

  /**
   * Thêm hoặc cập nhật cặp tiền, đồng thời đồng bộ WebSocket.
   */
  async upsertPair(data: Pair) {
    this.pairValidation.validateUpsertData(data);
    const result = await this.pairRepo.upsert(data);

    if (result.isActive) {
      this.okxWs.subscribe([result.instId]);
    } else {
      this.okxWs.unsubscribe([result.instId]);
    }

    this.logger.log(
      `Pair ${result.instId} upserted and synced. Active: ${result.isActive}`,
    );
    return result;
  }

  /**
   * Cập nhật trạng thái bật/tắt của cặp tiền.
   */
  async updateStatus(instId: string, isActive: boolean) {
    this.pairValidation.validateInstId(instId);
    const result = await this.pairRepo.updateStatus(instId, isActive);
    if (!result) return null;

    if (isActive) {
      this.okxWs.subscribe([instId]);
    } else {
      this.okxWs.unsubscribe([instId]);
    }

    this.logger.log(`Pair ${instId} status updated to ${isActive}`);
    return result;
  }

  /**
   * Xóa cặp tiền và ngừng nhận giá.
   */
  async deletePair(instId: string) {
    this.pairValidation.validateInstId(instId);
    await this.pairRepo.delete(instId);
    this.okxWs.unsubscribe([instId]);
    this.logger.log(`Pair ${instId} deleted and unsubscribed.`);
    return { success: true };
  }
}
