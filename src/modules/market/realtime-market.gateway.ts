import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { TickerData } from 'src/shared/types/okx.type';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealTimeGateway {
  @WebSocketServer()
  server: Server;

  /**
   * Broadcast ticker data to all connected clients.
   */
  emitTicker(ticker: TickerData) {
    this.server.emit('ticker', ticker);
  }
}
