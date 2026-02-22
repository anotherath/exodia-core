import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MarketService } from './market.service';

@ApiTags('Market')
@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('candles')
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
    enum: [
      '1m',
      '3m',
      '5m',
      '15m',
      '30m',
      '1h',
      '2h',
      '4h',
      '6h',
      '12h',
      '1D',
      '1W',
    ],
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
    @Query('limit') limit = 100,
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
