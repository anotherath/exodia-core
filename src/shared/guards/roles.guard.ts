import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminRole } from '../types/admin.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { admin } = context.switchToHttp().getRequest();

    if (!admin) {
      throw new ForbiddenException(
        'You do not have permission (Admin not found)',
      );
    }

    if (admin.role === 'super_admin') {
      return true; // super_admin has all permissions
    }

    const hasRole = requiredRoles.includes(admin.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `You do not have permission, required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
