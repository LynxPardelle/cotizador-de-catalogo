import { Routes } from '@angular/router';
import { WorkspaceStore } from './features/workspace/workspace.store';

export const routes: Routes = [
  {
    path: '',
    title: 'Cotizador de Catálogo',
    providers: [WorkspaceStore],
    loadComponent: () => import('./features/workspace/workspace').then((module) => module.Workspace),
  },
];
