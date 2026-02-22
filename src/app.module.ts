import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { NonceModule } from './modules/nonce/nonce.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { MarketModule } from './modules/market/market.module';
import { PairModule } from './modules/pair/pair.module';
import { PositionModule } from './modules/position/position.module';
import { RedisModule } from './infra/redis/redis.module';

@Module({
  imports: [
    UserModule,
    NonceModule,
    WalletModule,
    MarketModule,
    PairModule,
    PositionModule,
    RedisModule,
  ],
})
export class AppModule {}
