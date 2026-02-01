import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { OkxRest } from 'src/infra/okx/okx.rest';

@Module({
  controllers: [MarketController],
  providers: [MarketService, OkxRest],
})
export class MarketModule {}
