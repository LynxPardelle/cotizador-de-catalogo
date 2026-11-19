import { TestBed } from '@angular/core/testing';
import { Breakdown } from './breakdown';

describe('proposal snapshot presentation', () => {
  it('shows the stored option name and rule explanation', () => {
    const fixture = TestBed.createComponent(Breakdown);
    fixture.componentRef.setInput('value', {
      catalogId: 'oficina', version: 1, currency: 'MXN', currencyExponent: 2, validUntil: '2099-01-01T00:00:00Z', subtotalMinor: '530000', totalMinor: '503500',
      lines: [{ productId: 'desk', name: 'Escritorio', quantity: 1, optionIds: ['oak'], selectedOptions: [{ id: 'oak', name: 'Acabado roble original', priceMinor: '80000' }], unitPriceMinor: '530000', totalMinor: '530000' }],
      appliedRules: [{ id: 'volume5', type: 'percentage-discount', amountMinor: '-26500', description: '5% por cinco unidades o más' }],
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Acabado roble original');
    expect(text).toContain('5% por cinco unidades o más');
    expect(text).not.toContain('Opciones: oak');
  });
});
