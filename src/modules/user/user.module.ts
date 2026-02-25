import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { NonceRepository } from 'src/repositories/cache/nonce.cache';
import { UserRepository } from 'src/repositories/user/user.repository';
import { UserValidationService } from './user-validation.service';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    NonceRepository,
    UserRepository,
    UserValidationService,
  ],
})
export class UserModule {}
