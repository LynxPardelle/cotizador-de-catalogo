import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from './auth';
import { WorkspaceContext } from './workspace-context';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url === '/api/v1/pilot-interest') return next(request);
  if (!request.url.startsWith('/api/v1/')) return next(request);
  const token = inject(Auth).bearer();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (request.url === '/api/v1/pilot-applications' || request.url.startsWith('/api/v1/pilot-applications/')) return next(request.clone({ headers:request.headers.delete('X-Organization-Id'),setHeaders: headers }));
  const workspace = inject(WorkspaceContext);
  if (workspace.activeOrganizationId()) headers['X-Organization-Id'] = workspace.activeOrganizationId();
  return next(request.clone({ setHeaders: headers }));
};
