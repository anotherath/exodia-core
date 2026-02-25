import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';
import { WalletValidationService } from './wallet-validation.service';

@Module({
  controllers: [WalletController],
  providers: [WalletService, WalletRepository, WalletValidationService],
  exports: [WalletService],
})
export class WalletModule {}
