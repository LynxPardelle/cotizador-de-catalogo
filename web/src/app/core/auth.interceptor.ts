import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from './auth';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(Auth).bearer();
  return next(token && request.url.startsWith('/api/v1/') ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request);
};
