import { Routes } from '@angular/router';
import { CatalogStore } from './features/catalogs/catalog.store';
import { QuoteStore } from './features/quotes/quote.store';
import { TeamStore } from './features/team/team.store';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'CotiTrama · Cotiza con reglas claras', loadComponent: () => import('./features/landing/landing').then((module) => module.Landing) },
  {
    path: '',
    loadComponent: () => import('./features/shell').then((module) => module.Shell),
    children: [
      { path: 'cotizar', title: 'Nueva cotización · CotiTrama', providers: [QuoteStore], loadComponent: () => import('./features/quotes/quote-workspace').then((m) => m.QuoteWorkspace) },
      { path: 'catalogos', title: 'Catálogos · CotiTrama', providers: [CatalogStore], loadComponent: () => import('./features/catalogs/catalogs').then((m) => m.Catalogs) },
      { path: 'equipo', title: 'Equipo · CotiTrama', providers: [TeamStore], loadComponent: () => import('./features/team/team').then((m) => m.Team) },
      { path: 'invitacion/:token', title: 'Invitación · CotiTrama', loadComponent: () => import('./features/team/invitation').then((m) => m.Invitation) },
      { path: 'propuestas/:quoteId', title: 'Propuesta · CotiTrama', providers: [QuoteStore], loadComponent: () => import('./features/quotes/saved-quote').then((m) => m.SavedQuote) },
      { path: 'auth/callback', title: 'Iniciar sesión · CotiTrama', loadComponent: () => import('./features/auth-callback').then((m) => m.AuthCallback) },
      { path: '**', redirectTo: 'cotizar' },
    ],
  },
];
