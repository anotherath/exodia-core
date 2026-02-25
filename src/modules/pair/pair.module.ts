import { Module } from '@nestjs/common';
import { PairService } from './pair.service';
import { PairController } from './pair.controller';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { OkxInfraModule } from 'src/infra/okx/okx-infra.module';
import { PairValidationService } from './pair-validation.service';

@Module({
  imports: [OkxInfraModule],
  controllers: [PairController],
  providers: [PairService, PairRepository, PairValidationService],
  exports: [PairService],
})
export class PairModule {}
