import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { NonceModule } from './modules/nonce/nonce.module';

@Module({
  imports: [UserModule, NonceModule],
})
export class AppModule {}
