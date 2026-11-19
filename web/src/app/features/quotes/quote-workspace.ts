import { afterNextRender, Component, computed, effect, inject, signal } from '@angular/core';
import { disabled, FormField, form, max, min, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { Catalog, CatalogProduct } from '../../data/contracts';
import { MoneyPipe } from '../../data/money';
import { Breakdown } from './breakdown';
import { QuoteStore } from './quote.store';

@Component({
  imports: [FormField, RouterLink, MoneyPipe, Breakdown],
  templateUrl: './quote-workspace.html',
})
export class QuoteWorkspace {
  protected readonly store = inject(QuoteStore);
  protected readonly auth = inject(Auth);
  protected readonly catalog = signal<Catalog | undefined>(undefined);
  protected readonly model = signal({ productId: '', quantity: 1, options: [] as { id: string; selected: boolean }[] });
  protected readonly fields = form(this.model, (path) => { disabled(path, () => this.store.busy()); required(path.productId); min(path.quantity, 1); max(path.quantity, 10000); });
  protected readonly product = computed(() => this.catalog()?.products.find((p) => p.id === this.model().productId));
  constructor() {
    effect(() => { this.model(); this.store.invalidate(); });
    afterNextRender(() => this.load());
  }
  protected async load() {
    if (!this.auth.available) return;
    await this.store.loadCatalogs();
    if (!this.catalog()) this.chooseCatalog(this.store.catalogs()[0]?.catalogId ?? '');
  }
  protected chooseCatalog(id: string) {
    this.catalog.set(this.store.catalogs().find((item) => item.catalogId === id));
    this.chooseProduct(this.catalog()?.products[0]?.id ?? '');
  }
  protected chooseProduct(id: string) {
    const product: CatalogProduct | undefined = this.catalog()?.products.find((p) => p.id === id);
    this.model.set({ productId: id, quantity: 1, options: product?.options.map((o) => ({ id: o.id, selected: false })) ?? [] });
  }
  protected calculate(event: Event) {
    event.preventDefault();
    const catalog = this.catalog();
    if (!catalog || this.fields().invalid() || !Number.isInteger(this.model().quantity)) return;
    const model = this.model();
    void this.store.calculate({ catalogId: catalog.catalogId, version: catalog.version, currency: catalog.currency, items: [{ productId: model.productId, quantity: model.quantity, optionIds: model.options.filter((o) => o.selected).map((o) => o.id) }] });
  }
}
