import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../data/catalog-api';
import { Membership, TeamContext } from '../data/team-api';
import { RuntimeConfig } from './runtime-config';

const ORGANIZATION_KEY = 'cotitrama.organization';

@Injectable({ providedIn: 'root' })
export class WorkspaceContext {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfig);
  private generation = 0;
  readonly memberships = signal<Membership[]>([]);
  readonly activeOrganizationId = signal('');
  readonly sessionVersion = signal(0);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly role = computed(() => this.memberships().find((membership) => membership.organizationId === this.activeOrganizationId())?.role ?? (this.config.settings().demo ? 'admin' : 'reader'));
  async load(preferred = '') {
    if (!this.config.browser) return;
    const generation = ++this.generation;
    this.busy.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(this.http.get<TeamContext>('/api/v1/team/context', { transferCache: false }));
      if (generation !== this.generation) return;
      this.memberships.set(result.memberships);
      const saved = preferred || sessionStorage.getItem(ORGANIZATION_KEY) || result.activeOrganizationId || '';
      const current = result.memberships.find((member) => member.organizationId === saved)?.organizationId ?? result.activeOrganizationId ?? result.memberships[0]?.organizationId ?? '';
      this.activeOrganizationId.set(result.memberships.some((member) => member.organizationId === current) ? current : '');
      if (this.activeOrganizationId()) sessionStorage.setItem(ORGANIZATION_KEY, this.activeOrganizationId());
      else sessionStorage.removeItem(ORGANIZATION_KEY);
    } catch (error) {
      if (generation === this.generation) { this.memberships.set([]); this.activeOrganizationId.set(''); this.error.set(apiMessage(error)); }
    } finally { if (generation === this.generation) this.busy.set(false); }
  }
  select(organizationId: string): boolean {
    if (!this.memberships().some((member) => member.organizationId === organizationId)) return false;
    this.activeOrganizationId.set(organizationId);
    if (this.config.browser) sessionStorage.setItem(ORGANIZATION_KEY, organizationId);
    return true;
  }
  reset() {
    this.sessionVersion.update((version) => version + 1);
    this.generation++; this.memberships.set([]); this.activeOrganizationId.set(''); this.busy.set(false); this.error.set('');
    if (this.config.browser) sessionStorage.removeItem(ORGANIZATION_KEY);
  }
  label(organizationId: string) { return `Espacio ${organizationId.slice(0, 8)}`; }
}
