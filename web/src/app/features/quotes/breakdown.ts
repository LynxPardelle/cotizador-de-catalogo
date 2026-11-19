import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { Preview, QuoteLine } from '../../data/contracts';
import { MoneyPipe } from '../../data/money';

@Component({
  selector: 'app-breakdown', imports: [MoneyPipe, DatePipe],
  template: `
    @if (value(); as value) {
      <div class="detail-heading"><h2>Desglose de la propuesta</h2><span class="version">v{{ value.version }}</span></div>
      <p class="muted">{{ value.catalogId }} · {{ value.currency }} · Vigente hasta {{ value.validUntil | date:'dd/MM/yyyy':'UTC' }}</p>
      <div class="table-scroll"><table><caption class="sr-only">Productos e importes calculados</caption><thead><tr><th>Concepto</th><th class="number">Cantidad</th><th class="number">Importe</th></tr></thead><tbody>
      @for (line of value.lines; track line.productId) {
        <tr><td>{{ line.name }}<small>{{ line.unitPriceMinor | money:value.currency:value.currencyExponent }} por unidad</small>@if (line.optionIds.length) { <small>Opciones: {{ optionNames(line) }}</small> }</td><td class="number">{{ line.quantity }}</td><td class="number">{{ line.totalMinor | money:value.currency:value.currencyExponent }}</td></tr>
      }
      </tbody></table></div>
      <dl class="totals"><div><dt>Subtotal</dt><dd>{{ value.subtotalMinor | money:value.currency:value.currencyExponent }}</dd></div>
      @for (rule of value.appliedRules; track rule.id) { <div><dt>{{ rule.id }}<small>{{ rule.description || (rule.type === 'percentage-discount' ? 'Descuento aplicado' : 'Recargo aplicado') }}</small></dt><dd>{{ rule.amountMinor | money:value.currency:value.currencyExponent }}</dd></div> }
      <div class="grand-total"><dt>Total</dt><dd>{{ value.totalMinor | money:value.currency:value.currencyExponent }}</dd></div></dl>
    }
  `,
})
export class Breakdown {
  readonly value = input.required<Preview>();
  protected optionNames(line: QuoteLine) { return line.selectedOptions?.map((option) => option.name).join(', ') || line.optionIds.join(', '); }
}
