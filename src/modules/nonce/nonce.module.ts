import { Module } from '@nestjs/common';
import { NonceController } from './nonce.controller';
import { NonceService } from './nonce.service';
import { NonceRepository } from 'src/repositories/nonce.repository';

@Module({
  controllers: [NonceController],
  providers: [NonceService, NonceRepository],
})
export class NonceModule {}
