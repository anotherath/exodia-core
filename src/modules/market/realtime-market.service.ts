import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { RealTimeGateway } from './realtime-market.gateway';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { TickerData } from 'src/shared/types/okx.type';
import { PairService } from '../pair/pair.service';
import { MarketValidationService } from './market-validation.service';

@Injectable()
export class RealTimeService implements OnModuleInit {
  private readonly logger = new Logger(RealTimeService.name);

  constructor(
    private readonly okxWs: OkxWs,
    private readonly rtGateway: RealTimeGateway,
    private readonly marketPriceRepo: RealtimeMarketPriceRepository,
    private readonly pairService: PairService,
    private readonly marketValidation: MarketValidationService,
  ) {}

  async onModuleInit() {
    // 1. Kết nối WSS trước
    this.okxWs.connect(this.onTicker.bind(this));

    // 2. Lấy danh sách cặp tiền từ DB và subscribe
    try {
      const activePairs = await this.pairService.getAllActive();
      const instIds = activePairs.map((pair) => pair.instId);

      if (instIds.length > 0) {
        this.okxWs.subscribe(instIds);
      } else {
        this.logger.warn('No active pairs found in database to subscribe.');
      }
    } catch (error) {
      this.logger.error(
        'Failed to fetch active pairs for subscription',
        error.stack,
      );
    }
  }

  /**
   * Handle incoming ticker data from OKX.
   */
  private async onTicker(ticker: TickerData) {
    // 1. Validate toàn bộ ticker (bid/ask, last, spread)
    const result = this.marketValidation.validateTickerData(ticker);

    if (!result.valid) {
      this.logger.warn(`[${ticker.instId}] ${result.reason}. Dropping update.`);
      return;
    }

    // 2. Cập nhật Cache (Redis)
    await this.marketPriceRepo.update(ticker);

    // 3. Đẩy dữ liệu qua WebSocket cho Client
    this.rtGateway.emitTicker(ticker);

    // Debug log
    this.logger.debug(`Price updated: ${ticker.instId} -> ${ticker.last}`);
  }
}
