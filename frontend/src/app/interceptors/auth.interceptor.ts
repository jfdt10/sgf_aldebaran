import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const origin = new URL(environment.apiUrl).origin;
  if (new URL(req.url, window.location.origin).origin !== origin) return next(req);
  const isClient = /^\/(client|mobile)(\/|$)/.test(window.location.pathname);
  const clientToken = localStorage.getItem('client_token');
  const token = (isClient && clientToken) || req.headers.get('Authorization')?.replace(/^Bearer /, '') || localStorage.getItem('token');
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }

  return next(req);
};
