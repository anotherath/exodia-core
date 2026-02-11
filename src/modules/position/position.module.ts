import { Module } from '@nestjs/common';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { NonceRepository } from 'src/repositories/nonce/nonce.repository';

@Module({
  controllers: [PositionController],
  providers: [PositionService, PositionRepository, NonceRepository],
  exports: [PositionService, PositionRepository],
})
export class PositionModule {}
