import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const userJson = localStorage.getItem('usuario_sgf');

  if (!userJson) {
    router.navigate(['/login']);
    return false;
  }

  const user = JSON.parse(userJson);
  const role = user.perfil || user.tipo;

  if (role === 'ADMIN') {
    return true;
  }

  const url = state.url;

  if (role === 'SUPERVISOR') {
    if (url.startsWith('/supervisor') || url.startsWith('/totem')) {
      return true;
    }
    router.navigate(['/supervisor/dashboard']);
    return false;
  }

  if (role === 'OPERADOR') {
    if (url.startsWith('/operador') || url.startsWith('/totem')) {
      return true;
    }
    router.navigate(['/operador/painel']);
    router.navigate(['/operador/escolha-guiches']);
    return false;
  }

  if (role === 'CLIENTE') {
    if (url.startsWith('/client')) {
      return true;
    }
    router.navigate(['/client/home']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};
