import { Component, effect, input, output, signal } from '@angular/core';
import { disabled, FormField, form } from '@angular/forms/signals';
import { MemberRole, roleLabel, TeamMember } from '../../data/team-api';

@Component({
  selector: 'app-member-row', imports: [FormField],
  template: `<div class="team-member"><div class="member-identity"><strong>{{ member().email }}</strong><span>{{ roleLabel(member().role) }}</span></div><div class="member-role-edit"><label [for]="'role-' + member().subject">Rol</label><select [id]="'role-' + member().subject" [formField]="fields.role"><option value="reader">Lector</option><option value="seller">Vendedor</option><option value="admin">Administrador</option></select><button class="text-button" type="button" [disabled]="busy() || model().role === member().role" (click)="roleChange.emit({ subject: member().subject, role: model().role })">Guardar rol</button></div><button class="text-button remove-member" type="button" [disabled]="busy()" (click)="remove.emit(member())">Retirar acceso</button></div>`,
})
export class MemberRow {
  readonly member = input.required<TeamMember>(); readonly busy = input(false);
  readonly roleChange = output<{ subject: string; role: MemberRole }>(); readonly remove = output<TeamMember>();
  protected readonly model = signal({ role: 'reader' as MemberRole }); protected readonly fields = form(this.model, (path) => disabled(path, () => this.busy()));
  protected readonly roleLabel = roleLabel;
  constructor() { effect(() => this.model.set({ role: this.member().role })); }
}
