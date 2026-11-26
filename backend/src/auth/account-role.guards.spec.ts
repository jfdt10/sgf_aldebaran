import { ExecutionContext } from '@nestjs/common';
import { AccountManagementGuard, AdminGuard, StaffGuard } from './account-role.guards';

const contextFor = (perfil: string, userId: number | string, filial_id?: number) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user: { perfil, userId, filial_id } }) }),
  }) as ExecutionContext;

describe('Account authorization', () => {
  it('keeps client identities out of the staff routes', () => {
    const guard = new StaffGuard();
    expect(guard.canActivate(contextFor('CLIENTE', 'client-id'))).toBe(false);
    expect(guard.canActivate(contextFor('OPERADOR', 1))).toBe(true);
  });

  it('allows administrators and only branch-assigned supervisors to manage accounts', () => {
    const guard = new AccountManagementGuard();
    expect(guard.canActivate(contextFor('OPERADOR', 1, 2))).toBe(false);
    expect(guard.canActivate(contextFor('SUPERVISOR', 1))).toBe(false);
    expect(guard.canActivate(contextFor('SUPERVISOR', 1, 2))).toBe(true);
    expect(guard.canActivate(contextFor('ADMIN', 1))).toBe(true);
  });

  it('reserves administrative actions for administrators', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextFor('SUPERVISOR', 1, 2))).toBe(false);
    expect(guard.canActivate(contextFor('ADMIN', 1))).toBe(true);
  });
});
