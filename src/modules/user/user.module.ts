import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from 'src/repositories/user/user.repository';
import { UserValidationService } from './user-validation.service';
import { NonceModule } from '../nonce/nonce.module';

@Module({
  imports: [NonceModule],
  controllers: [UserController],
  providers: [UserService, UserRepository, UserValidationService],
})
export class UserModule {}
