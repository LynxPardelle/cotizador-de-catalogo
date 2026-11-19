import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { WorkspaceContext } from '../../core/workspace-context';
import { apiMessage } from '../../data/catalog-api';
import { MemberRole, NewInvitation, TeamApi, TeamMember } from '../../data/team-api';

export const TeamStore = signalStore(
  withState({ members: [] as TeamMember[], invitation: undefined as NewInvitation | undefined, busy: false, error: '', message: '' }),
  withMethods((store, api = inject(TeamApi), workspace = inject(WorkspaceContext)) => {
    async function refreshMembers() {
      patchState(store, { members: workspace.role() === 'admin' ? (await api.members()).members : [] });
    }
    return {
      async load() {
        patchState(store, { busy: true, error: '' });
        try { await refreshMembers(); } catch (error) { patchState(store, { error: apiMessage(error) }); }
        finally { patchState(store, { busy: false }); }
      },
      async invite(email: string, role: MemberRole) {
        if (store.busy()) return;
        patchState(store, { busy: true, error: '', message: '', invitation: undefined });
        try { patchState(store, { invitation: await api.invite(email.trim(), role), message: 'Invitación creada. Comparte el enlace con la persona invitada.' }); }
        catch (error) { patchState(store, { error: apiMessage(error) }); }
        finally { patchState(store, { busy: false }); }
      },
      clearInvitation() { patchState(store, { invitation: undefined, message: '' }); },
      async changeRole(subject: string, role: MemberRole) {
        if (store.busy()) return;
        patchState(store, { busy: true, error: '', message: '' });
        try { await api.role(subject, role); await workspace.load(workspace.activeOrganizationId()); await refreshMembers(); patchState(store, { message: 'El rol del miembro se ha actualizado.' }); }
        catch (error) { patchState(store, { error: apiMessage(error) }); }
        finally { patchState(store, { busy: false }); }
      },
      async remove(subject: string) {
        if (store.busy()) return;
        patchState(store, { busy: true, error: '', message: '' });
        try { await api.remove(subject); await workspace.load(workspace.activeOrganizationId()); await refreshMembers(); patchState(store, { message: 'Retiramos el acceso a este espacio. La cuenta de la persona sigue existiendo.' }); }
        catch (error) { patchState(store, { error: apiMessage(error) }); }
        finally { patchState(store, { busy: false }); }
      },
    };
  }),
);
