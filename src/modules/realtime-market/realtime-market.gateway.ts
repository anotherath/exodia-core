import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealTimeGateway {
  @WebSocketServer()
  server: Server;

  emitTicker(data: any) {
    this.server.emit('ticker', data);
  }
}
