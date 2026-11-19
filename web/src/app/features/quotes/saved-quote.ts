import { DatePipe } from '@angular/common';
import { afterNextRender, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { Breakdown } from './breakdown';
import { QuoteStore } from './quote.store';

@Component({
  imports: [DatePipe, RouterLink, Breakdown],
  template: `<main class="workspace narrow"><a class="text-link" routerLink="/cotizar">← Nueva cotización</a><div class="page-heading"><div><p class="eyebrow">Propuesta guardada</p><h1>El precio que confirmaste</h1><p class="lede">Esta propuesta conserva el catálogo y las reglas con los que se emitió.</p></div></div>
  @if (!canView()) { <section class="empty-state"><h2>Consulta tu propuesta</h2><p>Inicia sesión con una cuenta de tu organización.</p><button type="button" (click)="auth.login(router.url)">Iniciar sesión</button></section> }
  @else {
  @if (store.busy()) { <p role="status">Abriendo propuesta…</p> }
  @if (store.error()) { <p role="alert" class="notice error">{{ store.error() }}</p><button type="button" class="text-button" (click)="load()">Volver a intentar</button> }
  @if (store.quote(); as quote) { <section class="saved-proposal"><div class="saved-meta"><span>Referencia <strong>{{ quote.quoteId }}</strong></span><span>Emitida {{ quote.issuedAt | date:'dd/MM/yyyy HH:mm':'UTC' }} UTC</span></div><app-breakdown [value]="quote" /><p class="snapshot-note muted">Una actualización del catálogo no cambia los importes de esta propuesta.</p></section> }
  }</main>`,
})
export class SavedQuote {
  protected readonly auth = inject(Auth); protected readonly store = inject(QuoteStore); protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly canView = computed(() => { this.store.clock(); return this.auth.available; });
  constructor() { afterNextRender(() => this.load()); }
  protected load() { if (this.auth.available) void this.store.open(this.route.snapshot.paramMap.get('quoteId') ?? ''); }
}
