import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { NonceModule } from './modules/nonce/nonce.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { RealTimeModule } from './modules/realtime-market/realtime-market.module';
import { MarketModule } from './modules/market/market.module';
import { PairModule } from './modules/pair/pair.module';

@Module({
  imports: [
    // RealTimeModule,
    UserModule,
    NonceModule,
    WalletModule,
    MarketModule,
    PairModule,
  ],
})
export class AppModule {}
