import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Catalog, Preview, Quote, QuoteRequest } from './contracts';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  list() { return firstValueFrom(this.http.get<{ catalogs: Catalog[]; archivedCatalogs?: Catalog[] }>('/api/v1/catalogs', { transferCache: false })); }
  status(id: string, active: boolean) { return firstValueFrom(this.http.patch<{ catalogId: string; active: boolean }>(`/api/v1/catalogs/${encodeURIComponent(id)}/status`, { active })); }
  version(id: string, version: number) { return firstValueFrom(this.http.get<Catalog>(`/api/v1/catalogs/${encodeURIComponent(id)}/versions/${version}`, { transferCache: false })); }
  publish(catalog: Catalog, key: string) { return firstValueFrom(this.http.post<Catalog>(`/api/v1/catalogs/${encodeURIComponent(catalog.catalogId)}/publications`, catalog, { headers: { 'Idempotency-Key': key } })); }
  preview(request: QuoteRequest) { return firstValueFrom(this.http.post<Preview>('/api/v1/quotes/preview', request)); }
  issue(request: QuoteRequest, key: string) { return firstValueFrom(this.http.post<Quote>('/api/v1/quotes', request, { headers: { 'Idempotency-Key': key } })); }
  quote(id: string) { return firstValueFrom(this.http.get<Quote>(`/api/v1/quotes/${encodeURIComponent(id)}`, { transferCache: false })); }
}

export function apiMessage(error: unknown): string {
  const candidate = error as { status?: number; error?: { error?: { message?: string } } };
  if (candidate.status === 401) return 'Tu sesión ha terminado. Inicia sesión para continuar.';
  if (candidate.status === 403) return 'Tu cuenta no tiene permiso para esta operación.';
  if (candidate.status === 404) return 'No encontramos este recurso en tu organización.';
  return candidate.error?.error?.message ?? 'No pudimos completar la operación. Revisa tu conexión y vuelve a intentarlo.';
}

export function apiCode(error: unknown): string { return (error as { error?: { error?: { code?: string } } })?.error?.error?.code ?? ''; }
