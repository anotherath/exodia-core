import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MarketService } from './market.service';
import { okxConfig } from 'src/config/okx.config';
import { throttlerConfig } from 'src/config/throttler.config';

@ApiTags('Market')
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('candles')
  @Throttle(throttlerConfig.market.candles)
  @ApiOperation({ summary: 'Lấy dữ liệu nến (K-line) từ OKX' })
  @ApiQuery({
    name: 'instId',
    required: true,
    description: 'ID của cặp giao dịch',
    example: 'BTC-USDT',
  })
  @ApiQuery({
    name: 'bar',
    required: false,
    description: 'Khung thời gian nến',
    example: '1m',
    enum: okxConfig.candleBars,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Số lượng nến tối đa cần lấy (mặc định 100)',
    example: 100,
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Timestamp (ms) để lấy dữ liệu nến trước thời điểm đó',
  })
  @ApiResponse({
    status: 200,
    description: 'Trả về mảng dữ liệu nến (k-line)',
  })
  getCandles(
    @Query('instId') instId: string,
    @Query('bar') bar = '1m',
    @Query('limit') limit = okxConfig.maxCandlesLimit,
    @Query('before') before?: string,
  ) {
    return this.marketService.getCandles({
      instId,
      bar,
      limit: Number(limit),
      before,
    });
  }
}
