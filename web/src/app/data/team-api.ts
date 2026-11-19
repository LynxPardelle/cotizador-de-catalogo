import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type MemberRole = 'admin' | 'seller' | 'reader';
export interface Membership { organizationId: string; role: MemberRole; email?: string; joinedAt?: string }
export interface TeamMember extends Membership { subject: string; email: string; joinedAt: string }
export interface TeamContext { memberships: Membership[]; activeOrganizationId: string | null }
export interface Invitation { organizationId: string; email: string; role: MemberRole; expiresAt: string }
export interface NewInvitation { invitation: Invitation; token: string }

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);
  members() { return firstValueFrom(this.http.get<{ members: TeamMember[] }>('/api/v1/team/members', { transferCache: false })); }
  invite(email: string, role: MemberRole) { return firstValueFrom(this.http.post<NewInvitation>('/api/v1/team/invitations', { email, role })); }
  invitation(token: string) { return firstValueFrom(this.http.get<{ invitation: Invitation }>(`/api/v1/team/invitations/${encodeURIComponent(token)}`, { transferCache: false })); }
  accept(token: string) { return firstValueFrom(this.http.post<{ membership: Membership }>(`/api/v1/team/invitations/${encodeURIComponent(token)}/accept`, {})); }
  role(subject: string, role: MemberRole) { return firstValueFrom(this.http.patch<{ member: TeamMember }>(`/api/v1/team/members/${encodeURIComponent(subject)}`, { role })); }
  remove(subject: string) { return firstValueFrom(this.http.delete<void>(`/api/v1/team/members/${encodeURIComponent(subject)}`)); }
}

export function roleLabel(role: MemberRole): string {
  return { admin: 'Administrador', seller: 'Vendedor', reader: 'Lector' }[role];
}
