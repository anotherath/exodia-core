import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NonceRepository } from 'src/repositories/nonce.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, NonceRepository],
})
export class UsersModule {}
