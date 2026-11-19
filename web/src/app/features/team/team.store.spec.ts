import { TestBed } from '@angular/core/testing';
import { WorkspaceContext } from '../../core/workspace-context';
import { TeamApi } from '../../data/team-api';
import { TeamStore } from './team.store';
import { UsageContext } from '../../core/usage-context';

describe('TeamStore', () => {
  beforeEach(() => TestBed.configureTestingModule({providers:[{provide:UsageContext,useValue:{load:async()=>{},refresh:async()=>{}}}]}));
  it('keeps the last administrator in the list and shows the server rejection', async () => {
    const member = { subject: 'admin-a', email: 'admin@example.com', organizationId: 'org-a', role: 'admin', joinedAt: '2026-11-19T00:00:00Z' };
    const api = { members: async () => ({ members: [member] }), remove: async () => { throw { status: 409, error: { error: { code: 'LAST_ADMIN', message: 'El espacio debe conservar al menos un administrador.' } } }; } };
    TestBed.configureTestingModule({ providers: [TeamStore, { provide: TeamApi, useValue: api }, { provide: WorkspaceContext, useValue: { role: () => 'admin', activeOrganizationId: () => 'org-a', load: async () => {} } }] });
    const store = TestBed.inject(TeamStore);
    await store.load();
    await store.remove('admin-a');
    expect(store.members()).toHaveLength(1);
    expect(store.error()).toContain('al menos un administrador');
  });
});
