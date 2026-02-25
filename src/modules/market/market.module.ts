import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { RealTimeGateway } from './realtime-market.gateway';
import { RealTimeService } from './realtime-market.service';
import { RealtimeMarketPriceRepository } from 'src/repositories/cache/realtime-market-price.cache';
import { MarketHistoryCacheRepository } from 'src/repositories/cache/market-history.cache';
import { PairModule } from '../pair/pair.module';
import { OkxInfraModule } from 'src/infra/okx/okx-infra.module';
import { MarketValidationService } from './market-validation.service';

@Module({
  imports: [PairModule, OkxInfraModule],
  controllers: [MarketController],
  providers: [
    MarketService,
    MarketValidationService,
    RealTimeGateway,
    RealTimeService,
    RealtimeMarketPriceRepository,
    MarketHistoryCacheRepository,
  ],
  exports: [RealtimeMarketPriceRepository],
})
export class MarketModule {}
