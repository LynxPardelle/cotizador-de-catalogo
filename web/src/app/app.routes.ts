import { Routes } from '@angular/router';
import { CatalogStore } from './features/catalogs/catalog.store';
import { QuoteStore } from './features/quotes/quote.store';
import { TeamStore } from './features/team/team.store';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'CotiTrama · Cotiza con reglas claras', loadComponent: () => import('./features/landing/landing').then((module) => module.Landing) },
  { path: 'piloto/interes', title: 'Participa en el piloto · CotiTrama', loadComponent: () => import('./features/pilot-interest/interest').then((module) => module.Interest) },
  { path: 'piloto/solicitudes', title: 'Solicitudes del piloto · CotiTrama', loadComponent: () => import('./features/applications/applications').then((module) => module.Applications) },
  { path: 'piloto/preparacion/:reference', data:{mode:'operator'}, title: 'Preparación del piloto · CotiTrama', loadComponent: () => import('./features/preparation/preparation').then((module) => module.Preparation) },
  { path: 'piloto/incorporacion/:reference', data:{mode:'participant'}, title: 'Tu incorporación al piloto · CotiTrama', loadComponent: () => import('./features/preparation/preparation').then((module) => module.Preparation) },
  { path: 'piloto/preparacion/:reference', title: 'Preparar el piloto · CotiTrama', data: {mode:'operator'}, loadComponent: () => import('./features/preparation/preparation').then((module) => module.Preparation) },
  { path: 'piloto/incorporacion/:reference', title: 'Tu incorporación al piloto · CotiTrama', data: {mode:'participant'}, loadComponent: () => import('./features/preparation/preparation').then((module) => module.Preparation) },
  {
    path: '',
    loadComponent: () => import('./features/shell').then((module) => module.Shell),
    children: [
      { path: 'cotizar', title: 'Nueva cotización · CotiTrama', providers: [QuoteStore], loadComponent: () => import('./features/quotes/quote-workspace').then((m) => m.QuoteWorkspace) },
      { path: 'catalogos', title: 'Catálogos · CotiTrama', providers: [CatalogStore], loadComponent: () => import('./features/catalogs/catalogs').then((m) => m.Catalogs) },
      { path: 'equipo', title: 'Equipo · CotiTrama', providers: [TeamStore], loadComponent: () => import('./features/team/team').then((m) => m.Team) },
      { path: 'consumo', title: 'Consumo · CotiTrama', loadComponent: () => import('./features/usage/usage').then((m) => m.Usage) },
      { path: 'piloto', title: 'Piloto · CotiTrama', loadComponent: () => import('./features/pilot/pilot').then((m) => m.Pilot) },
      { path: 'invitacion/:token', title: 'Invitación · CotiTrama', loadComponent: () => import('./features/team/invitation').then((m) => m.Invitation) },
      { path: 'propuestas/:quoteId', title: 'Propuesta · CotiTrama', providers: [QuoteStore], loadComponent: () => import('./features/quotes/saved-quote').then((m) => m.SavedQuote) },
      { path: 'auth/callback', title: 'Iniciar sesión · CotiTrama', loadComponent: () => import('./features/auth-callback').then((m) => m.AuthCallback) },
      { path: '**', redirectTo: 'cotizar' },
    ],
  },
];
