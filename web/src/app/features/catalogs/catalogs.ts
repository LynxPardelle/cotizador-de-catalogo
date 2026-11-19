import { DatePipe } from '@angular/common';
import { afterNextRender, Component, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { Catalog } from '../../data/contracts';
import { MoneyPipe } from '../../data/money';
import { CatalogStore } from './catalog.store';

const sample: Catalog = {
  catalogId: 'oficina', name: 'Espacios de trabajo', version: 1, currency: 'MXN', currencyExponent: 2, rounding: 'half-up', validUntil: '2099-12-31T23:59:59.000Z',
  products: [
    { id: 'desk', name: 'Escritorio modular', basePriceMinor: '450000', options: [{ id: 'oak', name: 'Acabado roble', priceMinor: '80000' }, { id: 'assembly', name: 'Instalación', priceMinor: '25000' }], incompatibleOptions: [] },
    { id: 'chair', name: 'Silla de trabajo', basePriceMinor: '150000', options: [{ id: 'arms', name: 'Reposabrazos', priceMinor: '15000' }], incompatibleOptions: [] },
  ], rules: [{ id: 'volume5', type: 'percentage-discount', minimumQuantity: 5, numerator: '5', denominator: '100', priority: 10 }],
};

@Component({
  imports: [FormField, DatePipe, RouterLink, MoneyPipe],
  template: `<main class="workspace"><div class="page-heading"><div><p class="eyebrow">Administración comercial</p><h1>Catálogos publicados</h1><p class="lede">Cada versión conserva sus productos, precios y reglas comerciales.</p></div><a routerLink="/cotizar" class="button">Nueva cotización →</a></div>
    @if (!auth.available) { <section class="empty-state"><h2>Los catálogos de tu organización</h2><p>Inicia sesión para consultar las versiones publicadas.</p><button type="button" (click)="auth.login('/catalogos')">Iniciar sesión</button></section> }
    @else {
      @if (store.error()) { <p class="notice error" role="alert">{{ store.error() }}</p> }
      @if (store.errorCode() === 'PLAN_LIMIT_REACHED') { <p><a routerLink="/consumo">Ver consumo del plan y opciones para liberar cupo →</a></p> }
      @if (store.published()) { <p class="notice success" role="status">{{ store.published() }}</p> }
      @if (pendingStatus(); as change) { <section class="remove-confirmation" role="group" aria-labelledby="catalog-status-title"><h3 id="catalog-status-title">{{ change.active ? '¿Reactivar' : '¿Archivar' }} {{ change.catalog.name }}?</h3><p>{{ change.active ? 'El catálogo volverá a estar disponible para nuevas propuestas y ocupará un lugar del cupo de catálogos activos.' : 'El catálogo dejará de usarse en nuevas propuestas y liberará cupo. Sus versiones y las propuestas guardadas se conservan; puedes reactivarlo después.' }}</p><div><button type="button" [disabled]="store.busy()" (click)="changeStatus()">{{ change.active ? 'Sí, reactivar' : 'Sí, archivar' }}</button><button type="button" class="text-button" [disabled]="store.busy()" (click)="pendingStatus.set(undefined)">Cancelar</button></div></section> }
      @if (store.busy()) { <p role="status">Actualizando catálogos…</p> }
      @for (catalog of store.catalogs(); track catalog.catalogId) {
        <section class="catalog-section"><div class="detail-heading"><h2>{{ catalog.name }}</h2><span class="version">Versión {{ catalog.version }}</span></div><p class="muted">{{ catalog.catalogId }} · {{ catalog.currency }} · Vigente hasta {{ catalog.validUntil | date:'dd/MM/yyyy':'UTC' }}</p>
          <div class="table-scroll"><table><caption class="sr-only">Productos de {{ catalog.name }}</caption><thead><tr><th>Producto</th><th>Opciones disponibles</th><th class="number">Precio base</th></tr></thead><tbody>@for (product of catalog.products; track product.id) { <tr><td>{{ product.name }}<small>{{ product.id }}</small></td><td>{{ product.options.length }} opciones</td><td class="number">{{ product.basePriceMinor | money:catalog.currency:catalog.currencyExponent }}</td></tr> }</tbody></table></div>
          <div class="catalog-actions"><span class="muted">{{ catalog.rules.length }} reglas comerciales</span>@if (auth.role === 'admin') { <div class="catalog-status-actions"><button class="text-button" type="button" [disabled]="store.busy()" (click)="prepare(catalog)">Preparar siguiente versión →</button><button class="text-button" type="button" [disabled]="store.busy()" (click)="pendingStatus.set({catalog,active:false})">Archivar</button></div> }</div>
        </section>
      } @empty { @if (!store.busy()) { <section class="empty-state"><h2>Publica tu primer catálogo</h2><p>Las cotizaciones estarán disponibles cuando exista una versión publicada.</p></section> } }
      @if (auth.role === 'admin') {
        @if (store.archivedCatalogs().length) { <section class="archived-catalogs" aria-labelledby="archived-title"><h2 id="archived-title">Catálogos archivados</h2><p class="muted">Conservan sus versiones y propuestas. Reactiva un catálogo cuando tengas cupo disponible.</p>@for (catalog of store.archivedCatalogs(); track catalog.catalogId) { <div class="archived-catalog"><div><strong>{{ catalog.name }}</strong><span class="muted">{{ catalog.catalogId }} · Versión {{ catalog.version }}</span></div><button type="button" class="text-button" [disabled]="store.busy()" (click)="pendingStatus.set({catalog,active:true})">Reactivar →</button></div> }</section> }
        <section class="publication" aria-labelledby="publish-title"><div><p class="section-label">Publicación de catálogo</p><h2 id="publish-title">Una versión nueva, sin alterar la anterior</h2><p class="muted">Revisa productos, importes en unidades menores y reglas antes de publicar. Una versión publicada es inmutable.</p><button type="button" class="text-button" [disabled]="store.busy()" (click)="example()">Cargar ejemplo sintético</button></div>
        <form (submit)="publish($event)"><label for="catalog-document">Documento del catálogo (JSON)</label><textarea id="catalog-document" rows="18" spellcheck="false" [formField]="fields.document" [readOnly]="store.busy()" aria-describedby="catalog-help"></textarea><p id="catalog-help" class="muted">La versión debe ser la siguiente disponible de este catálogo. El servidor valida las reglas y la moneda.</p><button type="submit" [disabled]="store.busy() || fields().invalid()">Publicar nueva versión</button></form></section>
      }
      <button class="text-button" type="button" [disabled]="store.busy()" (click)="store.load()">Actualizar catálogos</button>
    }
  </main>`,
})
export class Catalogs {
  protected readonly store = inject(CatalogStore); protected readonly auth = inject(Auth);
  protected readonly model = signal({ document: JSON.stringify(sample, null, 2) });
  protected readonly pendingStatus = signal<{catalog: Catalog;active: boolean} | undefined>(undefined);
  protected readonly fields = form(this.model, (path) => required(path.document));
  constructor() { afterNextRender(() => { if (this.auth.available) void this.store.load(); }); }
  protected prepare(catalog: Catalog) { this.model.set({ document: JSON.stringify({ ...catalog, version: catalog.version + 1 }, null, 2) }); }
  protected example() { const current = [...this.store.catalogs(), ...this.store.archivedCatalogs()].find((c) => c.catalogId === sample.catalogId); this.model.set({ document: JSON.stringify({ ...sample, version: current ? current.version + 1 : 1 }, null, 2) }); }
  protected async changeStatus() { const change = this.pendingStatus(); if (change) { await this.store.setActive(change.catalog.catalogId, change.active); this.pendingStatus.set(undefined); } }
  protected publish(event: Event) { event.preventDefault(); if (!this.fields().invalid()) void this.store.publish(this.model().document); }
}
