import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminRepository } from 'src/repositories/admin/admin.repository';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { ADMIN_CONFIG } from 'src/config/admin.config';

import { AdminPairController } from './admin-pair.controller';
import { AdminUserController } from './admin-user.controller';
import { AdminPositionController } from './admin-position.controller';
import { AdminWalletController } from './admin-wallet.controller';

import { PairRepository } from 'src/repositories/pair/pair.repository';
import { UserRepository } from 'src/repositories/user/user.repository';
import { PositionRepository } from 'src/repositories/position/position.repository';
import { WalletRepository } from 'src/repositories/wallet/wallet.repository';

@Module({
  imports: [
    JwtModule.register({
      secret: ADMIN_CONFIG.JWT_SECRET,
      signOptions: { expiresIn: ADMIN_CONFIG.JWT_EXPIRES_IN as any },
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminPairController,
    AdminUserController,
    AdminPositionController,
    AdminWalletController,
  ],
  providers: [
    AdminAuthService,
    AdminRepository,
    AdminAuthGuard,
    PairRepository,
    UserRepository,
    PositionRepository,
    WalletRepository,
  ],
  exports: [AdminAuthService, AdminAuthGuard, JwtModule],
})
export class AdminModule {}
