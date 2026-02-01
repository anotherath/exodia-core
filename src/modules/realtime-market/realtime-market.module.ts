import { Module } from '@nestjs/common';
import { RealTimeService } from './realtime-market.service';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { RealTimeGateway } from './realtime-market.gateway';

@Module({
  providers: [RealTimeGateway, RealTimeService, OkxWs],
})
export class RealTimeModule {}
