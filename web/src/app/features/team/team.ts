import { DatePipe, DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { disabled, email, FormField, form, required } from '@angular/forms/signals';
import { Auth } from '../../core/auth';
import { WorkspaceContext } from '../../core/workspace-context';
import { MemberRole, roleLabel, TeamMember } from '../../data/team-api';
import { MemberRow } from './member-row';
import { TeamStore } from './team.store';
import { RouterLink } from '@angular/router';

@Component({ imports: [FormField, DatePipe, MemberRow, RouterLink], templateUrl: './team.html' })
export class Team {
  protected readonly auth = inject(Auth); protected readonly workspace = inject(WorkspaceContext); protected readonly store = inject(TeamStore);
  private readonly document = inject(DOCUMENT);
  protected readonly model = signal({ email: '', role: 'seller' as MemberRole });
  protected readonly fields = form(this.model, (path) => { disabled(path, () => this.store.busy()); required(path.email); email(path.email); required(path.role); });
  protected readonly removing = signal<TeamMember | undefined>(undefined);
  protected readonly copied = signal(''); protected readonly roleLabel = roleLabel;
  protected readonly invitationLink = computed(() => { const invitation = this.store.invitation(); return invitation ? new URL(`/invitacion/${encodeURIComponent(invitation.token)}`, this.document.location.origin).toString() : ''; });
  constructor() { afterNextRender(() => { if (this.auth.available && this.auth.role === 'admin') void this.store.load(); }); }
  protected invite(event: Event) { event.preventDefault(); if (!this.fields().invalid()) { this.copied.set(''); void this.store.invite(this.model().email, this.model().role); } }
  protected async copyLink() {
    try { await navigator.clipboard.writeText(this.invitationLink()); this.copied.set('Enlace copiado.'); }
    catch { this.copied.set('Selecciona el enlace y cópialo para compartirlo.'); }
  }
  protected async remove() { const member = this.removing(); if (member) { await this.store.remove(member.subject); this.removing.set(undefined); } }
}
