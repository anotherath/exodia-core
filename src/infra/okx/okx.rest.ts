// infra/okx/okx.rest.ts
import axios from 'axios';
import { okxConfig } from 'src/config/okx.config';

export class OkxRest {
  getCandles(instId: string, bar: string, limit = 100) {
    return axios.get(`${okxConfig.restUrl}/api/v5/market/candles`, {
      params: { instId, bar, limit },
    });
  }

  getHistoryCandles(instId: string, bar: string, before: string, limit = 100) {
    return axios.get(`${okxConfig.restUrl}/api/v5/market/history-candles`, {
      params: { instId, bar, before, limit },
    });
  }
}
