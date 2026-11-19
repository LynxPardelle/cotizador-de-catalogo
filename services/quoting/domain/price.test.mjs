import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('./price.mjs').catch(() => ({}));

const catalog = () => ({
  catalogId: 'oficina', name: 'Oficina modular', version: 1,
  currency: 'MXN', currencyExponent: 2, rounding: 'half-up', validUntil: '2099-12-31T23:59:59.000Z',
  products: [{ id: 'desk', name: 'Escritorio modular', basePriceMinor: '450000',
    options: [{ id: 'oak', name: 'Roble', priceMinor: '80000' }, { id: 'white', name: 'Blanco', priceMinor: '0' }, { id: 'assembly', name: 'Instalación', priceMinor: '25000' }],
    incompatibleOptions: [['oak', 'white']] }],
  rules: [{ id: 'volume5', type: 'percentage-discount', minimumQuantity: 5, numerator: '5', denominator: '100', priority: 10 }],
});
const request = (quantity = 5) => ({ catalogId: 'oficina', version: 1, currency: 'MXN', items: [{ productId: 'desk', quantity, optionIds: ['oak'] }] });

test('calculates money exactly and explains the volume discount', () => {
  assert.equal(typeof module.calculatePrice, 'function', 'the pricing engine must exist');
  const result = module.calculatePrice(catalog(), request());
  assert.equal(result.subtotalMinor, '2650000');
  assert.equal(result.totalMinor, '2517500');
  assert.equal(result.version, 1);
  assert.equal(result.lines[0].unitPriceMinor, '530000');
  assert.equal(result.appliedRules[0].amountMinor, '-132500');
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('sorts rules by priority and id and applies each to the running amount', () => {
  const value = catalog();
  value.products[0].basePriceMinor = '100'; value.products[0].options = []; value.products[0].incompatibleOptions = [];
  value.rules = [
    { id: 'b', type: 'percentage-surcharge', minimumQuantity: 1, numerator: '1', denominator: '10', priority: 20 },
    { id: 'a', type: 'percentage-discount', minimumQuantity: 1, numerator: '1', denominator: '10', priority: 10 },
  ];
  const input = request(1); input.items[0].optionIds = [];
  const first = module.calculatePrice(value, input);
  assert.equal(first.totalMinor, '99');
  assert.deepEqual(first.appliedRules.map((rule) => rule.id), ['a', 'b']);
  value.rules.reverse();
  assert.deepEqual(module.calculatePrice(value, input), first);
});

test('supports explicit half-up, half-even and down rounding without floats', () => {
  const value = catalog(); value.products[0].basePriceMinor = '5'; value.products[0].options = []; value.products[0].incompatibleOptions = [];
  value.rules = [{ id: 'half', type: 'percentage-surcharge', minimumQuantity: 1, numerator: '1', denominator: '2', priority: 1 }];
  const input = request(1); input.items[0].optionIds = [];
  assert.equal(module.calculatePrice(value, input).totalMinor, '8');
  value.rounding = 'half-even'; assert.equal(module.calculatePrice(value, input).totalMinor, '7');
  value.rounding = 'down'; assert.equal(module.calculatePrice(value, input).totalMinor, '7');
});

test('keeps amounts greater than Number.MAX_SAFE_INTEGER exact', () => {
  const value = catalog(); value.products[0].basePriceMinor = '9007199254740993'; value.rules = [];
  const input = request(2); input.items[0].optionIds = [];
  assert.equal(module.calculatePrice(value, input).totalMinor, '18014398509481986');
});

test('rejects invalid or incompatible options and duplicate products/options', () => {
  for (const ids of [['missing'], ['oak', 'white'], ['oak', 'oak']]) {
    const input = request(); input.items[0].optionIds = ids;
    assert.throws(() => module.calculatePrice(catalog(), input), { statusCode: 400 });
  }
  const input = request(); input.items.push({ ...input.items[0] });
  assert.throws(() => module.calculatePrice(catalog(), input), { statusCode: 400 });
});

test('rejects noninteger, zero, negative, unsafe and excessive quantities', () => {
  for (const quantity of [0, -1, 1.5, '2', 10001, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => module.calculatePrice(catalog(), request(quantity)), { statusCode: 400 });
  }
});

test('requires exact catalog, version and currency and refuses expired versions', () => {
  for (const patch of [{ catalogId: 'other' }, { version: 2 }, { version: '1' }, { currency: 'USD' }]) {
    assert.throws(() => module.calculatePrice(catalog(), { ...request(), ...patch }), { statusCode: 400 });
  }
  assert.throws(() => module.calculatePrice(catalog(), request(), { now: '2100-01-01T00:00:00Z' }), { code: 'CATALOG_EXPIRED', statusCode: 409 });
});

test('validates monetary strings, publication metadata and bounded rule types', () => {
  const patches = [
    { version: 0 }, { currency: 'ZZZ' }, { currencyExponent: 3 }, { validUntil: 'tomorrow' }, { validUntil: '2099-02-30T12:00:00Z' }, { validUntil: '2099-01-01T24:00:00Z' }, { rounding: 'random' },
    { products: [] }, { rules: [{ ...catalog().rules[0], numerator: '101' }] },
    { rules: [{ ...catalog().rules[0], denominator: '0' }] }, { rules: [{ ...catalog().rules[0], type: 'javascript' }] },
  ];
  for (const patch of patches) assert.throws(() => module.validateCatalog({ ...catalog(), ...patch }), { code: 'INVALID_CATALOG' });
  for (const amount of ['-1', '1.5', 100, '01', '9'.repeat(25)]) {
    const value = catalog(); value.products[0].basePriceMinor = amount;
    assert.throws(() => module.validateCatalog(value), { code: 'INVALID_CATALOG' });
  }
});

test('supports different currency exponents and does not mutate input', () => {
  const value = catalog(); value.currency = 'JPY'; value.currencyExponent = 0;
  const input = request(); input.currency = 'JPY'; const original = structuredClone(value);
  assert.equal(module.calculatePrice(value, input).currencyExponent, 0);
  assert.deepEqual(value, original);
  assert.deepEqual(module.validateCatalog(value), value);
});

test('empty, excessive or malformed configurations fail with domain errors', () => {
  for (const input of [null, {}, { ...request(), items: [] }, { ...request(), items: Array(101).fill(request().items[0]) }]) {
    assert.throws(() => module.calculatePrice(catalog(), input), { statusCode: 400 });
  }
});
