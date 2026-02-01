// modules/pair/pair.module.ts
import { Module } from '@nestjs/common';
import { PairService } from './pair.service';
import { PairController } from './pair.controller';
import { PairRepository } from 'src/repositories/pair/pair.repository';

@Module({
  controllers: [PairController],
  providers: [PairService, PairRepository],
})
export class PairModule {}
