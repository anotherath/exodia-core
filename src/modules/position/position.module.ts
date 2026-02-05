import { Module } from '@nestjs/common';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';

@Module({
  controllers: [PositionController],
  providers: [PositionService, PositionRepository],
  exports: [PositionService, PositionRepository],
})
export class PositionModule {}
