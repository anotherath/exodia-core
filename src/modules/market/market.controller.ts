import { Controller, Get, Query } from '@nestjs/common';
import { MarketService } from './market.service';
import { ApiQuery } from '@nestjs/swagger';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('candles')
  @ApiQuery({ name: 'instId', required: true })
  @ApiQuery({ name: 'bar', required: false, example: '1m' })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @ApiQuery({ name: 'before', required: false })
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
