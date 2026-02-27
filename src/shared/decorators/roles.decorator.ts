import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../types/admin.type';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
