import { Pipe, PipeTransform } from '@angular/core';

export function money(minor: string, currency: string, exponent = 2): string {
  if (!/^-?\d+$/.test(minor) || !Number.isInteger(exponent) || exponent < 0 || exponent > 6) return '—';
  const negative = minor.startsWith('-');
  const digits = (negative ? minor.slice(1) : minor).padStart(exponent + 1, '0');
  const whole = (exponent ? digits.slice(0, -exponent) : digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = exponent ? `.${digits.slice(-exponent)}` : '';
  return `${negative ? '−' : ''}${whole}${fraction} ${currency}`;
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(minor: string, currency: string, exponent = 2) { return money(minor, currency, exponent); }
}
