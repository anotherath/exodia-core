// modules/pair/pair.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { PairService } from './pair.service';

@Controller('pairs')
export class PairController {
  constructor(private readonly pairService: PairService) {}

  // GET /pairs
  @Get()
  getAllActive() {
    return this.pairService.getAllActive();
  }

  // GET /pairs/BTC-USDT
  @Get(':instId')
  getByInstId(@Param('instId') instId: string) {
    return this.pairService.getByInstId(instId);
  }
}
