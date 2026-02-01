import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { NonceRepository } from 'src/repositories/nonce.repository';
import { UserRepository } from 'src/repositories/user.repository';

@Module({
  controllers: [UserController],
  providers: [UserService, NonceRepository, UserRepository],
})
export class UserModule {}
