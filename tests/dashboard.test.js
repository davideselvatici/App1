import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const coreScript = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];

// The core script is pure: it needs only a window object to attach DSCore to.
function core() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(coreScript, context, { filename: 'index.html:core' });
  return context.window.DSCore;
}

const C = core();
const HEADER = '"Date";"Interest Date";"Amount";"Account";"Counterparty";"Name";"Description"';
const line = (date, amount, name, desc, cp = '') => `"${date}";"${date}";"${amount}";"NL00BUNQ0000000000";"${cp}";"${name}";"${desc}"`;

const JULY = [HEADER,
  line('2026-07-01', '-650,00', 'Mario Rossi', 'Affitto luglio', 'NL00INGB0000000001'),
  line('2026-07-03', '-20,00', 'Jumbo Centrum', 'Jumbo Centrum ENSCHEDE, NL'),
  line('2026-07-10', '-50,00', 'Pizzeria Napoli', 'Pizzeria Napoli ENSCHEDE, NL'),
  line('2026-07-20', '-30,00', 'Ristorante Il Faro', 'Ristorante Il Faro ENSCHEDE, NL'),
  line('2026-07-25', '2000,00', 'Azienda Esempio BV', 'Stipendio luglio', 'NL00RABO0000000006')
].join('\n');

function storeOf(...files) {
  const store = { tx: [], files: [] };
  for (const [csv, name] of files) C.merge(store, C.rowsToTx(C.parseCSV(csv), name));
  return store;
}
const ctxOf = (store, extra = {}) => ({ rules: {}, overrides: {}, own: C.ownIbans(store.tx), ai: {}, ...extra });
const demo = () => storeOf([C.EXAMPLE_CSV, '2026-08-01_2026-08-31_esempio.csv']);
const twoMonths = () => storeOf([JULY, '2026-07-01_2026-07-31.csv'], [C.EXAMPLE_CSV, '2026-08-01_2026-08-31.csv']);
const byName = (store, name) => store.tx.find(t => t.raw === name);

describe('monthly balance: total in minus total out', () => {
  test('sample month splits into income by category, spending, and balance', () => {
    const store = demo();
    const sum = C.summarize(store.tx, ctxOf(store), '2026-08');
    expect(sum.total).toBe(100622);
    expect(sum.inflow).toBe(216243);
    expect(sum.net).toBe(115621);
    expect(sum.back).toBe(0);
    expect(sum.count).toBe(16);
    expect(sum.incomeRows.map(g => [g.id, g.total])).toEqual([['stipendio', 215000], ['interessi', 43], ['rimborsi', 1200]]);
  });

  test('the balance equals the sum of every non-transfer movement', () => {
    const store = demo();
    const sum = C.summarize(store.tx, ctxOf(store), '2026-08');
    expect(sum.net).toBe(store.tx.reduce((n, t) => n + t.cents, 0));
  });

  test('reclassifying spending or refunds moves money between in and out without changing the balance', () => {
    const store = demo();
    const before = C.summarize(store.tx, ctxOf(store), '2026-08');
    const overrides = {
      [byName(store, 'Negozio Sconosciuto').id]: 'shopping',
      [byName(store, 'Giulia Bianchi').id]: 'ristoranti'
    };
    const after = C.summarize(store.tx, ctxOf(store, { overrides }), '2026-08');
    expect(after.net).toBe(before.net);
    expect(after.inflow).toBe(before.inflow - 1200);
    expect(after.total).toBe(before.total - 1200);
    expect(after.back).toBe(1200);
  });

  test('transfers between own accounts stay out of the balance', () => {
    const store = demo();
    const rent = byName(store, 'Mario Rossi');
    const sum = C.summarize(store.tx, ctxOf(store, { overrides: { [rent.id]: 'giroconto' } }), '2026-08');
    expect(sum.internalOut).toBe(65000);
    expect(sum.total).toBe(100622 - 65000);
    expect(sum.net).toBe(115621 + 65000);
  });

  test('refunds and unclassified money received count as income', () => {
    const store = storeOf([[HEADER,
      line('2026-09-02', '-10,00', 'Zalando', 'Zalando BERLIN, DE'),
      line('2026-09-05', '25,00', 'Zalando', 'Zalando refund'),
      line('2026-09-08', '40,00', 'Persona Sconosciuta', 'Grazie', 'NL00ABNA0000000003')
    ].join('\n'), 'sep.csv']);
    const sum = C.summarize(store.tx, ctxOf(store), '2026-09');
    expect(sum.total).toBe(1000);
    expect(sum.unIn).toBe(4000);
    expect(sum.incomeRows.map(g => [g.id, g.total])).toEqual([['rimborsi', 2500]]);
    expect(sum.inflow).toBe(6500);
    expect(sum.net).toBe(5500);
  });

  test('money received is subtracted from a category only by a choice on that movement', () => {
    const store = storeOf([[HEADER,
      line('2026-09-02', '-10,00', 'Zalando', 'Zalando BERLIN, DE'),
      line('2026-09-05', '25,00', 'Zalando', 'Zalando refund')
    ].join('\n'), 'sep.csv']);
    const refund = store.tx.find(t => t.cents > 0);
    expect(C.summarize(store.tx, ctxOf(store, { rules: { [refund.key]: 'shopping' } }), '2026-09').incomeRows[0].id).toBe('rimborsi');
    const sum = C.summarize(store.tx, ctxOf(store, { overrides: { [refund.id]: 'shopping' } }), '2026-09');
    expect(sum.total).toBe(0);
    expect(sum.extraBack).toBe(1500);
    expect(sum.inflow).toBe(1500);
    expect(sum.net).toBe(1500);
  });
});

describe('month-over-month comparison', () => {
  test('compares whole months and ranks category changes by size', () => {
    const store = twoMonths();
    const cmp = C.compare(store.tx, ctxOf(store), '2026-08', store.files);
    expect(cmp.prev).toBe('2026-07');
    expect(cmp.partial).toBe(false);
    expect(cmp.before.total).toBe(75000);
    const changes = C.categoryChanges(cmp);
    expect(changes[0]).toMatchObject({ id: 'viaggi', diff: 8999, before: 0 });
    expect(changes.find(v => v.id === 'ristoranti').diff).toBe(7490 - 8000);
    expect(changes.some(v => v.id === 'affitto')).toBe(false);
    expect(C.deltaOf(cmp).ratio).toBeCloseTo((100622 - 75000) / 75000);
  });

  test('a partial month is compared with the same days of the month before', () => {
    const half = [HEADER, ...C.EXAMPLE_CSV.split('\n').slice(1).filter(row => row.slice(9, 11) <= '15')].join('\n');
    const store = storeOf([JULY, '2026-07-01_2026-07-31.csv'], [half, '2026-08-01_2026-08-15.csv']);
    const cmp = C.compare(store.tx, ctxOf(store), '2026-08', store.files);
    expect(cmp.partial).toBe(true);
    expect(cmp.before.total).toBe(72000);
  });

  test('no comparison without data for the month before', () => {
    const store = demo();
    expect(C.compare(store.tx, ctxOf(store), '2026-08', store.files)).toBeNull();
    expect(C.categoryChanges(null)).toEqual([]);
  });
});

describe('where the money goes', () => {
  test('top merchants are grouped, ranked, and limited', () => {
    const store = demo();
    const top = C.topMerchants(C.summarize(store.tx, ctxOf(store), '2026-08'), 5);
    expect(top.map(m => [m.name, m.spent, m.cat])).toEqual([
      ['Mario Rossi', 65000, 'affitto'],
      ['Ryanair', 8999, 'viaggi'],
      ['Jumbo Centrum', 5035, 'spesa'],
      ['Vitens NV', 4500, 'casa'],
      ['Albert Heijn', 4320, 'spesa']
    ]);
    expect(top[2].txs).toHaveLength(2);
  });

  test('refunds stay in income and unclassified spending is included', () => {
    const store = storeOf([[HEADER,
      line('2026-09-02', '-50,00', 'Zalando', 'Zalando BERLIN, DE'),
      line('2026-09-09', '20,00', 'Zalando', 'Zalando BERLIN, DE'),
      line('2026-09-10', '-35,00', 'Negozio Sconosciuto', 'Negozio Sconosciuto ENSCHEDE, NL'),
      line('2026-09-11', '15,00', 'Giulia Bianchi', 'Pizza', 'NL00ABNA0000000003')
    ].join('\n'), 'sep.csv']);
    const top = C.topMerchants(C.summarize(store.tx, ctxOf(store), '2026-09'));
    expect(top.map(m => [m.name, m.spent, m.cat])).toEqual([['Zalando', 5000, 'shopping'], ['Negozio Sconosciuto', 3500, '']]);
    const refund = store.tx.find(t => t.raw === 'Zalando' && t.cents > 0);
    const netted = C.topMerchants(C.summarize(store.tx, ctxOf(store, { overrides: { [refund.id]: 'shopping' } }), '2026-09'));
    expect(netted.find(m => m.name === 'Zalando').spent).toBe(3000);
  });

  test('the biggest single expense ignores income and transfers', () => {
    const store = demo();
    const ctx = ctxOf(store);
    expect(C.displayName(C.biggestExpense(C.summarize(store.tx, ctx, '2026-08')).t)).toBe('Mario Rossi');
    const rent = byName(store, 'Mario Rossi');
    const withoutRent = C.summarize(store.tx, ctxOf(store, { overrides: { [rent.id]: 'giroconto' } }), '2026-08');
    expect(C.displayName(C.biggestExpense(withoutRent).t)).toBe('Ryanair');
  });

  test('daily average uses only the days covered by the statements', () => {
    expect(C.daysCovered('2026-08', [{ from: '2026-08-01', to: '2026-08-31' }])).toBe(31);
    expect(C.daysCovered('2026-08', [{ from: '2026-08-01', to: '2026-08-15' }])).toBe(15);
    expect(C.daysCovered('2026-08', [{ from: '2026-07-20', to: '2026-08-10' }])).toBe(10);
    expect(C.daysCovered('2026-03', [{ from: '2026-03-01', to: '2026-03-31' }])).toBe(31);
    expect(C.daysCovered('2028-02', [])).toBe(29);
  });
});
