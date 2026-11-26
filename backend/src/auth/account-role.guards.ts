import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';

export function canManageAccounts(user?: AuthenticatedUser): boolean {
  return user?.perfil === 'ADMIN' ||
    (user?.perfil === 'SUPERVISOR' && Number.isSafeInteger(user.filial_id) && (user.filial_id ?? 0) > 0);
}

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return Number.isSafeInteger(user?.userId) &&
      ['ADMIN', 'SUPERVISOR', 'OPERADOR'].includes(user.perfil ?? '');
  }
}

@Injectable()
export class AccountManagementGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return canManageAccounts(context.switchToHttp().getRequest<AuthenticatedRequest>().user);
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user?.perfil === 'ADMIN';
  }
}
