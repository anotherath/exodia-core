import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UserModule } from './modules/user/user.module';
import { NonceModule } from './modules/nonce/nonce.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { MarketModule } from './modules/market/market.module';
import { PairModule } from './modules/pair/pair.module';
import { PositionModule } from './modules/position/position.module';
import { AdminModule } from './modules/admin/admin.module';
import { RedisModule } from './infra/redis/redis.module';
import { ThrottlerExceptionFilter } from './shared/filters/throttler-exception.filter';
import { throttlerConfig } from './config/throttler.config';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Lớp 1: Giới hạn theo IP — chặn DDoS, bot cào dữ liệu
        name: 'ip',
        ...throttlerConfig.global.ip,
        getTracker: (req: Record<string, any>) => req.ip,
      },
      {
        // Lớp 2: Giới hạn theo Wallet — chặn spam giao dịch
        name: 'wallet',
        ...throttlerConfig.global.wallet,
        getTracker: (req: Record<string, any>) => {
          const wallet =
            req.body?.walletAddress ||
            req.body?.typedData?.walletAddress ||
            req.body?.typedData?.message?.walletAddress ||
            req.query?.walletAddress;
          return typeof wallet === 'string' ? wallet.toLowerCase() : req.ip;
        },
      },
    ]),
    UserModule,
    NonceModule,
    WalletModule,
    MarketModule,
    PairModule,
    PositionModule,
    AdminModule,
    RedisModule,
  ],
  providers: [
    {
      // Dùng ThrottlerGuard mặc định — logic tracker nằm trong config ở trên
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ThrottlerExceptionFilter,
    },
  ],
})
export class AppModule {}
