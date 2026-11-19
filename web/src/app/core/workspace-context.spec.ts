import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { WorkspaceContext } from './workspace-context';

describe('WorkspaceContext', () => {
  afterEach(() => sessionStorage.clear());

  it('restores only an organization returned by the server and uses its current role', async () => {
    sessionStorage.setItem('cotitrama.organization', 'foreign-organization');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const workspace = TestBed.inject(WorkspaceContext); const control = TestBed.inject(HttpTestingController);
    const loading = workspace.load();
    control.expectOne('/api/v1/team/context').flush({ memberships: [{ organizationId: 'org-a', role: 'reader' }], activeOrganizationId: 'org-a' });
    await loading;
    expect(workspace.activeOrganizationId()).toBe('org-a');
    expect(workspace.select('foreign-organization')).toBe(false);
    expect(workspace.role()).toBe('reader');
    const staleToken = `header.${btoa(JSON.stringify({ 'cognito:groups': ['org:org-a:admin'] }))}.signature`;
    sessionStorage.setItem('cotitrama.session', JSON.stringify({ accessToken: staleToken, expiresAt: Date.now() + 60000 }));
    const auth = TestBed.inject(Auth); auth.restore();
    expect(auth.bearer()).toBe(staleToken);
    expect(auth.role).toBe('reader');
    control.verify();
  });

  it('selects a remaining membership when the stored organization was removed', async () => {
    sessionStorage.setItem('cotitrama.organization', 'removed-org');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const workspace = TestBed.inject(WorkspaceContext); const control = TestBed.inject(HttpTestingController);
    const loading = workspace.load('removed-org');
    control.expectOne('/api/v1/team/context').flush({ memberships: [{ organizationId: 'remaining-org', role: 'seller' }], activeOrganizationId: 'remaining-org' });
    await loading;
    expect(workspace.activeOrganizationId()).toBe('remaining-org');
    expect(workspace.role()).toBe('seller');
    expect(sessionStorage.getItem('cotitrama.organization')).toBe('remaining-org');
    control.verify();
  });

  it('ignores a context response arriving after the session was cleared', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const workspace = TestBed.inject(WorkspaceContext); const control = TestBed.inject(HttpTestingController);
    const loading = workspace.load();
    const request = control.expectOne('/api/v1/team/context');
    workspace.reset();
    request.flush({ memberships: [{ organizationId: 'old-org', role: 'admin' }], activeOrganizationId: 'old-org' });
    await loading;
    expect(workspace.memberships()).toEqual([]);
    expect(workspace.activeOrganizationId()).toBe('');
    control.verify();
  });

  it('performs no context request during SSR', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: 'server' }] });
    await TestBed.inject(WorkspaceContext).load();
    TestBed.inject(HttpTestingController).expectNone('/api/v1/team/context');
  });
});
