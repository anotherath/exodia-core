// infra/okx/okx.ws.ts
import { Injectable, Logger } from '@nestjs/common';
import { okxConfig } from 'src/config/okx.config';
import WebSocket from 'ws';
import { TickerData } from 'src/shared/types/okx.type';

@Injectable()
export class OkxWs {
  private ws: WebSocket;
  private readonly logger = new Logger(OkxWs.name);
  private reconnectInterval = 5000;
  private subscribedInstIds = new Set<string>();
  private onMessageCallback: (data: TickerData) => void;

  /**
   * Connect to OKX WebSocket.
   * @param onMessage Callback function to handle incoming ticker data.
   */
  connect(onMessage: (data: TickerData) => void) {
    this.onMessageCallback = onMessage;
    this.initWebSocket();
  }

  private initWebSocket() {
    try {
      this.ws = new WebSocket(okxConfig.wsPublicUrl);

      this.ws.on('open', () => {
        this.logger.log('Connected to OKX WebSocket');
        // Re-subscribe to all existing pairs on reconnect
        if (this.subscribedInstIds.size > 0) {
          this.sendSubscription(Array.from(this.subscribedInstIds));
        }
      });

      this.ws.on('message', (msg) => {
        try {
          const payload = JSON.parse(msg.toString());
          if (
            payload?.data &&
            Array.isArray(payload.data) &&
            payload.data.length > 0
          ) {
            this.onMessageCallback?.(payload.data[0] as TickerData);
          }
        } catch (error) {
          this.logger.error('Error parsing OKX WebSocket message', error.stack);
        }
      });

      this.ws.on('error', (err) => {
        this.logger.error('OKX WebSocket error:', err.message);
      });

      this.ws.on('close', () => {
        this.logger.warn(
          `OKX WebSocket connection closed. Retrying in ${this.reconnectInterval / 1000}s...`,
        );
        setTimeout(() => this.initWebSocket(), this.reconnectInterval);
      });
    } catch (error) {
      this.logger.error(
        'Failed to initiate OKX WebSocket connection',
        error.stack,
      );
      setTimeout(() => this.initWebSocket(), this.reconnectInterval);
    }
  }

  /**
   * Subscribe to new instrument IDs dynamically.
   */
  subscribe(instIds: string[]) {
    const newIds = instIds.filter((id) => !this.subscribedInstIds.has(id));
    if (newIds.length === 0) return;

    newIds.forEach((id) => this.subscribedInstIds.add(id));

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscription(newIds);
    }
  }

  /**
   * Unsubscribe from instrument IDs.
   */
  unsubscribe(instIds: string[]) {
    const idsToRemove = instIds.filter((id) => this.subscribedInstIds.has(id));
    if (idsToRemove.length === 0) return;

    idsToRemove.forEach((id) => this.subscribedInstIds.delete(id));

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendUnsubscription(idsToRemove);
    }
  }

  private sendSubscription(instIds: string[]) {
    const msg = JSON.stringify({
      op: 'subscribe',
      args: instIds.map((instId) => ({
        channel: 'tickers',
        instId,
      })),
    });
    this.ws.send(msg);
    this.logger.log(`Subscribed to: ${instIds.join(', ')}`);
  }

  private sendUnsubscription(instIds: string[]) {
    const msg = JSON.stringify({
      op: 'unsubscribe',
      args: instIds.map((instId) => ({
        channel: 'tickers',
        instId,
      })),
    });
    this.ws.send(msg);
    this.logger.log(`Unsubscribed from: ${instIds.join(', ')}`);
  }
}
