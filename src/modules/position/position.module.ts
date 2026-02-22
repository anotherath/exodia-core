import { Module } from '@nestjs/common';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { PairRepository } from 'src/repositories/pair/pair.repository';
import { NonceRepository } from 'src/repositories/cache/nonce-cache.repository';
import { PositionValidationService } from './position-validation.service';

import { MarketModule } from '../market/market.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [MarketModule, WalletModule],
  controllers: [PositionController],
  providers: [
    PositionService,
    PositionRepository,
    PairRepository,
    NonceRepository,
    PositionValidationService,
  ],
  exports: [PositionService, PositionRepository],
})
export class PositionModule {}
