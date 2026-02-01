// infra/okx/okx.ws.ts
import { okxConfig } from 'src/config/okx.config';
import WebSocket from 'ws';

export class OkxWs {
  private ws: WebSocket;

  connect(onMessage: (data: any) => void) {
    this.ws = new WebSocket(okxConfig.wsPublicUrl);

    this.ws.on('open', () => {
      this.ws.send(
        JSON.stringify({
          op: 'subscribe',
          args: okxConfig.defaultPairs.map((instId) => ({
            channel: 'tickers',
            instId,
          })),
        }),
      );
    });

    this.ws.on('message', (msg) => {
      const payload = JSON.parse(msg.toString());
      if (payload?.data) onMessage(payload.data[0]);
    });
  }
}
