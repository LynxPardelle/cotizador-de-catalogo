import { money } from './money';

describe('money presentation', () => {
  it('preserves integer precision beyond JavaScript safe numbers', () => {
    expect(money('900719925474099312345', 'MXN', 2)).toBe('9,007,199,254,740,993,123.45 MXN');
  });
  it('formats negative adjustments and currency exponents without calculating totals', () => {
    expect(money('-5', 'MXN', 2)).toBe('−0.05 MXN');
    expect(money('1500', 'JPY', 0)).toBe('1,500 JPY');
    expect(money('1005', 'KWD', 3)).toBe('1.005 KWD');
  });
});
