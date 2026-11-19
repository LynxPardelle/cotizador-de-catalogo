import { DatePipe } from '@angular/common';
import { afterNextRender, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/auth';
import { UsageContext } from '../../core/usage-context';

@Component({
  imports: [DatePipe, RouterLink],
  template: `<main class="workspace"><div class="page-heading"><div><p class="eyebrow">Capacidad de tu espacio</p><h1>Consumo</h1><p class="lede">Consulta el uso actual y los límites operativos de tu plan.</p></div>@if (auth.available) { <button class="text-button" type="button" [disabled]="usage.busy()" (click)="usage.load()">Actualizar consumo</button> }</div>
  @if (!auth.available) { <section class="empty-state"><h2>Inicia sesión para ver el consumo</h2><p>El consumo corresponde al espacio que tengas seleccionado.</p><button type="button" (click)="auth.login('/consumo')">Iniciar sesión</button></section> }
  @else {
    @if (usage.busy()) { <p class="loading" role="status">Consultando consumo…</p> }
    @if (usage.error()) { <p class="notice error" role="alert">{{ usage.error() }}</p> }
    @if (usage.data(); as data) {
      <section class="usage-plan"><div><p class="section-label">Plan del espacio</p><h2>{{ data.plan.name }}</h2></div><span class="version">Piloto sin cargos</span></section>
      <div class="usage-indicators">@for (item of usage.indicators(); track item.key) { <section class="usage-indicator" [class.usage-warning]="item.metric.state === 'warning'" [class.usage-limit]="item.metric.state === 'limit' || item.metric.state === 'over'"><h2>{{ item.label }}</h2><p class="usage-amount"><strong>{{ item.metric.used }}</strong><span>de {{ item.metric.limit }}</span></p><meter min="0" [max]="item.metric.limit" [value]="item.metric.used" [attr.aria-label]="item.label + ': ' + item.metric.used + ' de ' + item.metric.limit"></meter><p class="usage-remaining">{{ item.metric.remaining }} disponibles</p>@if (item.metric.state !== 'normal') { <p class="usage-state">{{ usage.alertLabel(item.metric) }}</p> }<p class="muted">{{ item.guidance }}</p></section> }</div>
      @for (item of usage.alerts(); track item.key) { <div class="notice" [class.error]="item.metric.state !== 'warning'" [class.usage-advice]="item.metric.state === 'warning'" role="status"><strong>{{ item.label }}: {{ usage.alertLabel(item.metric) }}</strong><p>{{ item.metric.state === 'warning' ? 'Puedes seguir trabajando dentro del cupo disponible.' : 'Las nuevas creaciones que consumen este cupo están limitadas. Las consultas y las propuestas ya guardadas se conservan.' }}</p><p>{{ item.guidance }}</p></div> }
      <section class="usage-period"><h2>Período de propuestas</h2><p>{{ data.period.startsAt | date:'dd/MM/yyyy HH:mm':'UTC' }} — {{ data.period.resetsAt | date:'dd/MM/yyyy HH:mm':'UTC' }} UTC</p><p class="muted">Se cuenta cada propuesta emitida una sola vez. Reabrirla o repetir la misma emisión con su clave original no vuelve a consumir cupo.</p></section>
      <div class="notice usage-advice"><strong>El piloto continúa sin cargos.</strong><p>Los espacios nuevos empiezan con Esencial y sus límites operativos. No hay contratación ni cobros en línea; los cambios a Equipo o Empresa los coordina la persona que opera el piloto.</p></div><div class="usage-links"><a routerLink="/catalogos">Gestionar catálogos</a><a routerLink="/equipo">Gestionar equipo</a><a routerLink="/cotizar">Volver a cotizar</a></div>
    }
  }</main>`,
})
export class Usage {
  protected readonly auth = inject(Auth); protected readonly usage = inject(UsageContext);
  constructor() { afterNextRender(() => { if (this.auth.available) void this.usage.load(); }); }
}
