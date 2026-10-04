import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { app, KEY } from './harness.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = id => html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'))[1];

function core() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(script('core'), context, { filename: 'index.html:core' });
  return context.window.DSCore;
}
function texts() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(script('i18n'), context, { filename: 'index.html:i18n' });
  return context.window.DSText;
}

const textOf = node => node.textContent;
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const hit = find(child, predicate);
    if (hit) return hit;
  }
  return null;
}
const button = (root, label) => find(root, n => n.tagName === 'BUTTON' && n.textContent === label);

describe('texts', () => {
  test('every text exists in both languages with the same shape', () => {
    const { it, en } = texts();
    const shape = o => Object.fromEntries(Object.entries(o).map(([k, v]) =>
      [k, typeof v === 'object' ? shape(v) : typeof v]));
    expect(shape(en)).toEqual(shape(it));
  });

  test('sentences follow the grammar of each language', () => {
    const { it, en } = texts();
    expect(it.compared('agosto', false)).toBe('rispetto ad agosto');
    expect(it.compared('luglio', true)).toBe('rispetto agli stessi giorni di luglio');
    expect(it.deltaMore('12%', 'luglio', false)).toBe('12% in più rispetto a luglio');
    expect(en.deltaMore('12%', 'July', false)).toBe('12% more than in July');
    expect(en.deltaLess('5%', 'July', true)).toBe('5% less than the same days of July');
    expect(it.noteOtherCur(1)).toBe('1 movimento in altra valuta escluso.');
    expect(en.uncategorizedCount(2)).toBe('2 uncategorized transactions');
  });
});

describe('core in English', () => {
  test('category names and transaction kinds follow the language, the reference labels stay Italian', () => {
    const C = core();
    const card = { kind: 'card', cents: -500, raw: '', desc: '' };
    expect(C.kindLabel(card)).toBe('pagamento con carta');
    C.setLang('en');
    expect(C.kindLabel(card)).toBe('card payment');
    expect(C.kindLabel({ kind: 'transfer', cents: 500 })).toBe('transfer received');
    expect(C.displayName({})).toBe('Transaction');
    expect(C.CATS.map(C.catName)).toEqual(['Bars and restaurants', 'Rent', 'Groceries', 'Travel', 'Public transport', 'Car',
      'Home and bills', 'Monthly subscriptions', 'Shopping', 'Health', 'Sport', 'Leisure', 'Gifts']);
    expect(C.INCOME.map(C.catName)).toEqual(['Salary', 'Interest', 'Refunds']);
    expect(C.CATS[0].label).toBe('Bar e ristoranti');
    expect(() => C.rowsToTx([['foo', 'bar']], 'x.csv')).toThrow('Cannot find the date and amount columns. Columns found: foo, bar.');
    C.setLang('it');
    expect(C.catName(C.CATS[0])).toBe('Bar e ristoranti');
  });

  test('the English sample month has the same categories and totals as the Italian one', () => {
    const C = core();
    const month = csv => {
      const store = { tx: [], files: [] };
      C.merge(store, C.rowsToTx(C.parseCSV(csv), '2026-08-01_2026-08-31.csv'));
      const sum = C.summarize(store.tx, { rules: {}, overrides: {}, own: C.ownIbans(store.tx), ai: {} }, '2026-08');
      return {
        total: sum.total, inflow: sum.inflow, net: sum.net, count: sum.count, unTx: sum.unTx.length,
        rows: sum.rows.map(g => [g.id, g.spent]), income: sum.incomeRows.map(g => [g.id, g.total])
      };
    };
    expect(C.EXAMPLE_CSV_EN).not.toBe(C.EXAMPLE_CSV);
    expect(month(C.EXAMPLE_CSV_EN)).toEqual(month(C.EXAMPLE_CSV));
  });
});

describe('language setting', () => {
  test('starts in Italian', () => {
    const a = app();
    a.render();
    expect(a.getLang()).toBe('it');
    expect(textOf(a.nodes.get('#content'))).toContain('Le tue categorie');
    expect(textOf(a.nodes.get('#foot'))).toBe('I dati restano solo su questo dispositivo: ogni tanto esporta un backup.');
  });

  test('a saved choice of English shows the whole page in English, with English numbers', () => {
    const a = app({ persisted: { [KEY + ':lang']: 'en' } });
    a.render();
    const page = textOf(a.nodes.get('#content'));
    expect(page).toContain('Your categories');
    expect(page).toContain('Total spending · August');
    expect(page).toContain('€7,800.00');
    expect(page).toContain('Groceries');
    expect(page).not.toContain('Le tue categorie');
    expect(textOf(a.nodes.get('#foot'))).toBe('Your data stays on this device only: export a backup now and then.');
  });

  test('an unknown saved language falls back to Italian', () => {
    const a = app({ persisted: { [KEY + ':lang']: 'constructor' } });
    expect(a.getLang()).toBe('it');
  });

  test('Settings lets you switch to English and back, and remembers the choice', () => {
    const a = app();
    a.render();
    a.openSettings();
    const sheet = a.nodes.get('#sheet');
    expect(sheet.hidden).toBe(false);
    expect(find(sheet, n => n.tagName === 'H2').textContent).toBe('Impostazioni');
    expect(button(sheet, 'Italiano').attributes['aria-pressed']).toBe('true');
    button(sheet, 'English').click();
    expect(a.getLang()).toBe('en');
    expect(a.storage.get(KEY + ':lang')).toBe('en');
    expect(find(sheet, n => n.tagName === 'H2').textContent).toBe('Settings');
    expect(button(sheet, 'English').attributes['aria-pressed']).toBe('true');
    expect(textOf(a.nodes.get('#content'))).toContain('Your categories');
    // The sample month is rebuilt with English descriptions.
    expect(a.active().tx.map(t => t.raw)).toContain('Unknown Shop');
    button(sheet, 'Done').click();
    expect(sheet.hidden).toBe(true);
    a.openSettings();
    button(sheet, 'Italiano').click();
    expect(a.storage.get(KEY + ':lang')).toBe('it');
    expect(textOf(a.nodes.get('#content'))).toContain('Le tue categorie');
  });

  test('messages and errors follow the language', () => {
    const a = app({ persisted: { [KEY + ':lang']: 'en' } });
    a.saveKey('cerebras', 'short', 'tvly-abcdefghijklmnopqrst');
    expect(textOf(a.nodes.get('#toast'))).toBe('The Cerebras key looks incomplete: paste all of it.');
    expect(() => a.importBackup('{')).toThrow('The backup cannot be read.');
    expect(a.catLabel('', a.getStore())).toBe('Uncategorized');
    expect(a.catLabel('giroconto', a.getStore())).toBe('Internal transfer');
  });

  test('custom categories keep their name in both languages', () => {
    const a = app({ persisted: { [KEY + ':lang']: 'en' } });
    const store = a.emptyStore();
    store.cats.push({ id: 'u-1', label: 'Gatto' });
    expect(a.catLabel('u-1', store)).toBe('Gatto');
  });

  test('deleting all data keeps the language', () => {
    const a = app({ persisted: { [KEY + ':lang']: 'en' } });
    a.clearAll();
    expect(a.storage.get(KEY + ':lang')).toBe('en');
    expect(textOf(a.nodes.get('#toast'))).toBe('Data deleted from this device.');
  });

  test('the model writes its short description in the chosen language', () => {
    expect(app().aiSystem(app().emptyStore())).toContain('cosa (descrizione italiana in 2-5 parole)');
    const a = app({ persisted: { [KEY + ':lang']: 'en' } });
    const prompt = a.aiSystem(a.emptyStore());
    expect(prompt).toContain('cosa (descrizione in inglese in 2-5 parole)');
    // The rest of the prompt and the category labels stay in Italian.
    expect(prompt).toContain('- ristoranti: Bar e ristoranti,');
  });
});
