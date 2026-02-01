import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';

@Module({
  controllers: [WalletController],
  providers: [WalletService, WalletRepository],
})
export class WalletModule {}
