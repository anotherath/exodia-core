import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PairService } from './pair.service';
import { throttlerConfig } from 'src/config/throttler.config';

@ApiTags('Pairs')
@Controller('pairs')
export class PairController {
  constructor(private readonly pairService: PairService) {}

  @Get()
  @Throttle(throttlerConfig.pairs.read)
  @ApiOperation({ summary: 'Lấy danh sách tất cả các cặp giao dịch' })
  @ApiResponse({ status: 200, description: 'Trả về mảng các cặp giao dịch' })
  getAll() {
    return this.pairService.getAll();
  }

  @Get('active')
  @Throttle(throttlerConfig.pairs.read)
  @ApiOperation({ summary: 'Lấy danh sách các cặp đang hoạt động' })
  @ApiResponse({
    status: 200,
    description: 'Trả về mảng các cặp isActive = true',
  })
  getAllActive() {
    return this.pairService.getAllActive();
  }
}
