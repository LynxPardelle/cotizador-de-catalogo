import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../data/catalog-api';
import { RuntimeConfig } from './runtime-config';
import { WorkspaceContext } from './workspace-context';

export interface UsageMetric { used: number; limit: number; remaining: number; state: 'normal' | 'warning' | 'limit' | 'over' }
export interface PlanUsage {
  plan: { id: string; name: string; limits: { members: number; activeCatalogs: number; issuedQuotesPerMonth: number } };
  billingEnabled: boolean; limitsEnforced: boolean; members: UsageMetric;
}
export interface UsageSnapshot extends PlanUsage { activeCatalogs: UsageMetric; issuedQuotesPerMonth: UsageMetric; period: { key: string; startsAt: string; resetsAt: string } }
export interface UsageIndicator { key: string; label: string; metric: UsageMetric; guidance: string }

@Injectable({ providedIn: 'root' })
export class UsageContext {
  private readonly http = inject(HttpClient); private readonly workspace = inject(WorkspaceContext); private readonly config = inject(RuntimeConfig);
  private generation = 0; private scope = ''; private inFlight: Promise<void> | undefined;
  private readonly snapshot = signal<{ scope: string; value: UsageSnapshot } | undefined>(undefined);
  readonly data = computed(() => { const saved = this.snapshot(); const scope = `${this.workspace.sessionVersion()}:${this.workspace.activeOrganizationId()}`; return saved?.scope === scope ? saved.value : undefined; });
  readonly busy = signal(false); readonly error = signal('');
  readonly indicators = computed<UsageIndicator[]>(() => {
    const data = this.data();
    return data ? [
      { key: 'members', label: 'Miembros', metric: data.members, guidance: 'Un administrador puede retirar accesos que ya no se necesiten.' },
      { key: 'catalogs', label: 'Catálogos activos', metric: data.activeCatalogs, guidance: 'Archivar un catálogo libera cupo y conserva sus versiones y propuestas.' },
      { key: 'quotes', label: 'Propuestas del mes', metric: data.issuedQuotesPerMonth, guidance: 'El contador se renueva al empezar el siguiente mes en UTC.' },
    ] : [];
  });
  readonly alerts = computed(() => this.indicators().filter((item) => item.metric.state !== 'normal'));
  load(): Promise<void> { return this.request(false); }
  refresh(): Promise<void> { return this.request(true); }
  private request(force: boolean): Promise<void> {
    const organizationId = this.workspace.activeOrganizationId(); const session = this.workspace.sessionVersion();
    if (!this.config.browser || !organizationId) { this.reset(); return Promise.resolve(); }
    const scope = `${session}:${organizationId}`;
    if (!force && this.busy() && this.scope === scope && this.inFlight) return this.inFlight;
    if (this.scope !== scope) this.snapshot.set(undefined);
    this.scope = scope; const generation = ++this.generation; this.busy.set(true); this.error.set('');
    const current = () => generation === this.generation && organizationId === this.workspace.activeOrganizationId() && session === this.workspace.sessionVersion();
    this.inFlight = (async () => {
      try {
        const [team, catalogs, quotes] = await Promise.all([
          firstValueFrom(this.http.get<PlanUsage>('/api/v1/team/usage', { transferCache: false })),
          firstValueFrom(this.http.get<{ planId: string; activeCatalogs: UsageMetric }>('/api/v1/catalogs/usage', { transferCache: false })),
          firstValueFrom(this.http.get<{ planId: string; issuedQuotesPerMonth: UsageMetric; period: UsageSnapshot['period'] }>('/api/v1/quotes/usage', { transferCache: false })),
        ]);
        if (!current()) return;
        if (team.plan.id !== catalogs.planId || team.plan.id !== quotes.planId) { this.snapshot.set(undefined); this.error.set('El plan se está actualizando. Vuelve a consultar el consumo.'); return; }
        this.snapshot.set({ scope, value: { ...team, activeCatalogs: catalogs.activeCatalogs, issuedQuotesPerMonth: quotes.issuedQuotesPerMonth, period: quotes.period } });
      } catch (error) { if (current()) { if ([401,403].includes((error as {status?:number}).status ?? 0)) this.snapshot.set(undefined); this.error.set(apiMessage(error)); } }
      finally { if (generation === this.generation) { this.busy.set(false); this.inFlight = undefined; } }
    })();
    return this.inFlight;
  }
  reset() { this.generation++; this.scope = ''; this.inFlight = undefined; this.snapshot.set(undefined); this.busy.set(false); this.error.set(''); }
  alertLabel(metric: UsageMetric) { return metric.state === 'over' ? 'Por encima del límite' : metric.state === 'limit' ? 'Límite alcanzado' : 'Cerca del límite'; }
}
