import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { RealTimeGateway } from './realtime-market.gateway';
import { MarketPriceCache } from './market-price.cache';
import { TickerData } from 'src/shared/types/okx.type';
import { PairService } from '../pair/pair.service';

@Injectable()
export class RealTimeService implements OnModuleInit {
  private readonly logger = new Logger(RealTimeService.name);

  constructor(
    private readonly okxWs: OkxWs,
    private readonly rtGateway: RealTimeGateway,
    private readonly priceCache: MarketPriceCache,
    private readonly pairService: PairService,
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
  private onTicker(ticker: TickerData) {
    // Update In-Memory Cache
    this.priceCache.update(ticker);

    // Push to WebSocket clients
    this.rtGateway.emitTicker(ticker);

    // Debug log
    this.logger.debug(`Price updated: ${ticker.instId} -> ${ticker.last}`);
  }
}
