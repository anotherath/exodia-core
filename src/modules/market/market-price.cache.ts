import { Injectable } from '@nestjs/common';
import { TickerData } from 'src/shared/types/okx.type';

@Injectable()
export class MarketPriceCache {
  // Map stores latest ticker data for each instrument ID (e.g., 'BTC-USDT')
  private prices = new Map<string, TickerData>();

  /**
   * Update the cache with new ticker data.
   */
  update(ticker: TickerData) {
    this.prices.set(ticker.instId, ticker);
  }

  /**
   * Get the full ticker data for a symbol.
   */
  get(instId: string): TickerData | undefined {
    return this.prices.get(instId);
  }

  /**
   * Helper to get the best Bid price as a number.
   */
  getBidPrice(instId: string): number {
    const ticker = this.prices.get(instId);
    return ticker ? parseFloat(ticker.bidPx) : 0;
  }

  /**
   * Helper to get the best Ask price as a number.
   */
  getAskPrice(instId: string): number {
    const ticker = this.prices.get(instId);
    return ticker ? parseFloat(ticker.askPx) : 0;
  }

  /**
   * Get all cached instrument IDs.
   */
  getAllSymbols(): string[] {
    return Array.from(this.prices.keys());
  }
}
