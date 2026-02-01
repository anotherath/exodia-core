import { Injectable, OnModuleInit } from '@nestjs/common';
import { OkxWs } from 'src/infra/okx/okx.ws';
import { RealTimeGateway } from './realtime-market.gateway';

@Injectable()
export class RealTimeService implements OnModuleInit {
  constructor(
    private readonly okxWs: OkxWs,
    private readonly rtGateway: RealTimeGateway,
  ) {}

  onModuleInit() {
    this.okxWs.connect(this.onTicker.bind(this));
  }

  private onTicker(ticker: any) {
    this.rtGateway.emitTicker(ticker);
    console.log(ticker.instId, 'bid:', ticker.bidPx, 'ask:', ticker.askPx);
  }
}
