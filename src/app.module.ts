import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { NonceModule } from './modules/nonce/nonce.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [UserModule, NonceModule, WalletModule],
})
export class AppModule {}
