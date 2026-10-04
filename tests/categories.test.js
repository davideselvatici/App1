import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const coreScript = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ window: {} });
vm.runInContext(coreScript, context, { filename: 'index.html:core' });
const C = context.window.DSCore;

const HEADER = '"Date";"Interest Date";"Amount";"Account";"Counterparty";"Name";"Description"';
const line = (date, amount, name, desc, cp = '') => `"${date}";"${date}";"${amount}";"NL00BUNQ0000000000";"${cp}";"${name}";"${desc}"`;
const parse = (...rows) => C.rowsToTx(C.parseCSV([HEADER, ...rows].join('\n')), 'sep.csv').txs;
const ctx = (txs, extra = {}) => ({ rules: {}, overrides: {}, own: C.ownIbans(txs), ai: {}, ...extra });
const catOf = (...row) => { const txs = parse(line(...row)); return C.categorize(txs[0], ctx(txs)); };

describe('categories', () => {
  test('spending and income categories are the requested ones, in order', () => {
    expect(C.CATS.map(c => c.label)).toEqual(['Bar e ristoranti', 'Affitto', 'Spesa', 'Viaggi', 'Trasporto pubblico', 'Macchina',
      'Casa e bollette', 'Abbonamenti mensili', 'Shopping', 'Salute', 'Sport', 'Svago', 'Regali']);
    expect(C.INCOME.map(c => c.label)).toEqual(['Stipendio', 'Interessi', 'Rimborsi']);
  });

  test.each([
    ['-7,80', 'NS GROEP IZ NS REIZIGERS', 'NS GROEP UTRECHT, NL', 'trasporti'],
    ['-62,10', 'Shell Station', 'Shell Station ENSCHEDE, NL', 'macchina'],
    ['-3,50', 'Q-Park Centrum', 'Q-Park Centrum ENSCHEDE, NL', 'macchina'],
    ['-29,99', 'Basic-Fit', 'Basic-Fit ENSCHEDE, NL', 'sport'],
    ['-11,99', 'Spotify', 'Spotify STOCKHOLM, SE', 'abbonamenti'],
    ['-110,00', 'NS Reizigers B.V.', 'Abonnement Dal Voordeel september', 'abbonamenti'],
    ['-39,00', 'ATM Milano', 'Abbonamento mensile metro', 'abbonamenti'],
    ['-45,00', 'Vitens NV', 'Acconto acqua', 'casa'],
    ['-12,00', 'Pathe Enschede', 'Pathe Enschede ENSCHEDE, NL', 'svago'],
    ['-59,99', 'Steam', 'Steam BELLEVUE, US', 'svago'],
    ['1200,00', 'Azienda Esempio BV', 'Stipendio agosto', 'stipendio'],
    ['1,23', 'bunq', 'Interest payout', 'interessi'],
    ['15,00', 'Giulia Bianchi', 'Pizza', 'rimborsi'],
    ['20,00', 'Zalando', 'Zalando BERLIN, DE', 'rimborsi']
  ])('%s %s (%s) goes to %s', (amount, name, desc, cat) => {
    expect(catOf('2026-09-02', amount, name, desc).cat).toBe(cat);
  });

  test('Revolut fund returns and bunq cashback are interest', () => {
    const cashback = catOf('2026-09-02', '0,43', 'bunq', 'Congratulazioni, hai vinto l’1% del tuo pagamento di 43,20 € speso da Albert Heijn, semplicemente usando la tua Carta bunq!', 'NL00BUNQ0000000002');
    expect(cashback).toMatchObject({ cat: 'interessi', note: 'cashback' });
    const reward = { id: 'r', src: 'revolut', date: '2026-09-01', cents: 105, cur: 'EUR', account: 'Revolut Fondi monetari flessibili EUR', cp: '', raw: 'Interest earned - Fondi monetari flessibili', desc: 'Interest earned - Fondi monetari flessibili', kind: 'reward', key: 'M:INTEREST EARNED - FONDI MONETARI FLESSIBILI' };
    expect(C.categorize(reward, ctx([reward])).cat).toBe('interessi');
  });

  test('cash withdrawals count as shopping and are never looked up online', () => {
    const txs = parse(
      line('2026-09-03', '-50,00', 'Geldautomaat Centrum', 'Geldautomaat Centrum ENSCHEDE, NL'),
      line('2026-09-04', '-50,00', 'UNICREDIT MILANO', 'UNICREDIT MILANO, IT'),
      line('2026-09-05', '-9,50', 'Negozio Sconosciuto', 'Negozio Sconosciuto ENSCHEDE, NL'));
    expect(txs.map(t => C.categorize(t, ctx(txs)))).toMatchObject([
      { cat: 'shopping', how: 'auto', note: 'contanti' }, { cat: 'shopping', how: 'auto', note: 'contanti' }, { cat: '', how: 'none' }]);
    expect(C.lookupItems(txs, ctx(txs)).map(g => g.t.raw)).toEqual(['Negozio Sconosciuto']);
  });

  test('bank fees are monthly subscriptions and single train tickets stay public transport', () => {
    const fee = { id: 'f', src: 'revolut', date: '2026-09-08', cents: -399, cur: 'EUR', account: 'Revolut Conto personale EUR', cp: '', raw: 'Canone piano Plus', desc: 'Canone piano Plus', kind: 'fee', key: 'M:CANONE PIANO PLUS' };
    expect(C.categorize(fee, ctx([fee])).cat).toBe('abbonamenti');
    expect(catOf('2026-09-02', '-7,80', 'NS GROEP IZ NS REIZIGERS', 'NS GROEP IZ NS REIZIGERS UTRECHT, NL').cat).toBe('trasporti');
  });
});

describe('saved choices from earlier versions', () => {
  test('cash becomes shopping and removed categories go back to automatic', () => {
    const s = C.migrate({
      rules: { 'M:MUSEUM': 'svago', 'M:SPOTIFY': 'abbonamenti', 'M:ATM': 'contanti', 'I:EMPLOYER': 'entrate', 'M:JUMBO': 'spesa' },
      overrides: { a: 'altro', b: 'trasporti' },
      ai: { 'M:MUSEUM': { c: 'svago', w: 'Museo' }, 'T:x': { c: 'entrate', w: 'Regalo' } },
      cats: []
    });
    expect(s.rules).toEqual({ 'M:MUSEUM': 'svago', 'M:SPOTIFY': 'abbonamenti', 'M:ATM': 'shopping', 'M:JUMBO': 'spesa' });
    expect(s.overrides).toEqual({ b: 'trasporti' });
    expect(s.ai).toEqual({ 'M:MUSEUM': { c: 'svago', w: 'Museo' } });
  });

  test('a custom category named like a new one becomes the new one', () => {
    const s = C.migrate({ rules: { 'M:SHELL': 'u-car' }, overrides: {}, ai: {}, cats: [{ id: 'u-car', label: 'macchina' }, { id: 'u-pet', label: 'Animali' }] });
    expect(s.cats).toEqual([{ id: 'u-pet', label: 'Animali' }]);
    expect(s.rules).toEqual({ 'M:SHELL': 'macchina' });
    expect(JSON.stringify(C.migrate(JSON.parse(JSON.stringify(s))))).toBe(JSON.stringify(s));
  });
});

describe('repeated movements as one total', () => {
  const interest = day => ({ id: 'i' + day, src: 'revolut', date: '2026-09-' + String(day).padStart(2, '0'), cents: 37, cur: 'EUR', account: 'Revolut Fondi monetari flessibili EUR', cp: '', raw: 'Interest earned - Fondi monetari flessibili', desc: 'Interest earned - Fondi monetari flessibili', kind: 'reward', key: 'M:INTEREST EARNED - FONDI MONETARI FLESSIBILI' });

  test('daily interest becomes one entry with the sum and the date range', () => {
    const txs = Array.from({ length: 30 }, (_, i) => interest(i + 1));
    const sum = C.summarize(txs, ctx(txs), '2026-09');
    const groups = C.groupTx(sum.incomeRows[0].txs);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ cents: 1110, from: '2026-09-01', to: '2026-09-30' });
    expect(groups[0].ws).toHaveLength(30);
  });

  test('transfers to the same own account collapse, others keep their own entry in list order', () => {
    const txs = parse(
      line('2026-09-20', '-300,00', 'Mario Rossi', 'Revolut', 'NL00REVO0000000001'),
      line('2026-09-10', '-200,00', 'Mario Rossi', 'Revolut', 'NL00REVO0000000001'),
      line('2026-09-15', '-40,00', 'Jumbo Centrum', 'Jumbo Centrum ENSCHEDE, NL'));
    const own = new Set(['NL00REVO0000000001']);
    const sum = C.summarize(txs, { rules: {}, overrides: {}, own, ai: {} }, '2026-09');
    expect(sum.internalOut).toBe(50000);
    const all = sum.internalTx.concat(sum.rows.flatMap(g => g.txs)).sort((a, b) => b.t.date.localeCompare(a.t.date));
    expect(C.groupTx(all).map(g => [C.displayName(g.t), g.ws.length, g.cents])).toEqual([['Mario Rossi', 2, -50000], ['Jumbo Centrum', 1, -4000]]);
  });

  test('the same merchant in two categories stays in two entries', () => {
    const txs = parse(line('2026-09-02', '-10,00', 'Zalando', 'Zalando BERLIN, DE'), line('2026-09-05', '25,00', 'Zalando', 'Zalando BERLIN, DE'));
    const ws = txs.map(t => ({ t, ...C.categorize(t, ctx(txs)) }));
    expect(C.groupTx(ws).map(g => g.cents)).toEqual([-1000, 2500]);
  });
});
