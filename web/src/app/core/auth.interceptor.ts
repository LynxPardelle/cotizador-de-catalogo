import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from './auth';
import { WorkspaceContext } from './workspace-context';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(Auth).bearer();
  const workspace = inject(WorkspaceContext);
  if (!request.url.startsWith('/api/v1/')) return next(request);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (workspace.activeOrganizationId()) headers['X-Organization-Id'] = workspace.activeOrganizationId();
  return next(request.clone({ setHeaders: headers }));
};
