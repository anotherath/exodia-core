import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { PairService } from './pair.service';
import * as pairType from 'src/shared/types/pair.type';

@Controller('pairs')
export class PairController {
  constructor(private readonly pairService: PairService) {}

  @Get()
  getAll() {
    return this.pairService.getAll();
  }

  @Get('active')
  getAllActive() {
    return this.pairService.getAllActive();
  }

  @Post()
  upsert(@Body() body: pairType.Pair) {
    return this.pairService.upsertPair(body);
  }

  @Put(':instId/status')
  updateStatus(
    @Param('instId') instId: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.pairService.updateStatus(instId, isActive);
  }

  @Delete(':instId')
  delete(@Param('instId') instId: string) {
    return this.pairService.deletePair(instId);
  }
}
