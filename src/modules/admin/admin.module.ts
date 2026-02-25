import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminRepository } from 'src/repositories/admin/admin.repository';
import { AdminAuthGuard } from 'src/shared/guards/admin-auth.guard';
import { ADMIN_CONFIG } from 'src/config/admin.config';

@Module({
  imports: [
    JwtModule.register({
      secret: ADMIN_CONFIG.JWT_SECRET,
      signOptions: { expiresIn: ADMIN_CONFIG.JWT_EXPIRES_IN as any },
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminRepository, AdminAuthGuard],
  exports: [AdminAuthService, AdminAuthGuard, JwtModule],
})
export class AdminModule {}
