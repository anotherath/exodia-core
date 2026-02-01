import { Injectable } from '@nestjs/common';
import { OkxRest } from 'src/infra/okx/okx.rest';

@Injectable()
export class MarketService {
  constructor(private readonly okxRest: OkxRest) {}

  async getCandles(params) {
    if (params.before) {
      const res = await this.okxRest.getHistoryCandles(
        params.instId,
        params.bar,
        params.before,
        params.limit,
      );
      return res.data;
    }

    const res = await this.okxRest.getCandles(
      params.instId,
      params.bar,
      params.limit,
    );
    return res.data;
  }
}
