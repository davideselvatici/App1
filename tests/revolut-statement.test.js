import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const coreScript = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ window: {} });
vm.runInContext(coreScript, context, { filename: 'index.html:core' });
const C = context.window.DSCore;

// Same layout as a Revolut consolidated statement (Italian app language). Every name, IBAN,
// date, and amount is invented.
const pad = cells => cells.concat(Array(12 - cells.length).fill('')).join(',');
const STATEMENT = [
  pad(['"Conti correnti Riepiloghi"']),
  pad(['"Conto personale (EUR)"']),
  pad(['"Estremi del conto attuali"']),
  pad(['"Numero di conto (IBAN)"', 'NL00REVO0000000001', '"Data di apertura"', '"3 feb 2023"']),
  pad(['', '', '"Saldo di apertura"', '"35,40€"']),
  pad(['---------']),
  pad(['"Conto personale (USD)"']),
  pad(['', '', '"Saldo di apertura"', '"0,00$"', '"0,00€"']),
  pad(['---------']),
  pad(['"Crypto Riepiloghi"']),
  pad(['"Nome del conto"', '"MARIO ROSSI"', '"Data di apertura"', '15.01.24']),
  pad(['---------']),
  pad(['"Conti correnti Estratti conto delle operazioni"']),
  pad(['"Conto personale (EUR)"']),
  pad(['"Riepilogo delle transazioni"']),
  pad(['Data', 'Descrizione', 'Categoria', '"Denaro in entrata/uscita"', 'Saldo', '"Imposte ritenute"', '"Altre imposte"', 'Costi']),
  pad(['"3 set 2026"', '"Da EUR Fondi monetari flessibili"', 'Altri', '"1.000,00€"', '"1.035,40€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"6 set 2026"', '"To Giulia Bianchi"', 'Altri', '"-900,00€"', '"135,40€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"8 set 2026"', '"Canone piano Plus"', 'Esercente', '"-3,99€"', '"131,41€"', '"0,00€"', '"0,00€"', '"3,99€"']),
  pad(['"11 set 2026"', '"Negozio Sconosciuto"', 'Esercente', '"-7,25€"', '"124,16€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"15 set 2026"', 'Spotify', 'Esercente', '"-11,99€"', '"112,17€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"18 set 2026"', '"Pagamento da MARIO ROSSI"', 'Ricarica', '"1.500,00€"', '"1.612,17€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"19 set 2026"', '"To MARIO ROSSI"', 'Altri', '"-400,00€"', '"1.212,17€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"21 set 2026"', 'Zalando', 'Esercente', '"-59,90€"', '"1.152,27€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"22 set 2026"', 'Zalando', 'Esercente', '"20,00€"', '"1.172,27€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['"27 set 2026"', '"Al conto di investimento"', 'Altri', '"-250,00€"', '"922,27€"', '"0,00€"', '"0,00€"', '"0,00€"']),
  pad(['Totale', '', '', '"886,87€"', '', '"0,00€"', '"0,00€"', '"3,99€"']),
  pad(['---------']),
  pad(['"Conto personale (USD)"']),
  pad(['"Riepilogo delle transazioni"']),
  'Data,Descrizione,Categoria,"Denaro in entrata/uscita","Denaro in entrata/uscita",Saldo,"Imposte ritenute","Imposte ritenute","Altre imposte","Altre imposte",Costi,Costi',
  '"12 set 2026","Starbucks NYC",Esercente,"-5,50$","-4,80€","4,50$","0,00$","0,00€","0,00$","0,00€","0,00$","0,00€"',
  'Totale,,,"-5,50$","-4,80€",,"0,00$","0,00€","0,00$","0,00€","0,00$","0,00€"',
  pad(['---------']),
  pad(['"Conti deposito Transaction Statements"']),
  pad(['"Risparmi  (EUR)"']),
  pad(['"Riepilogo della transazione (solo ricevuta degli interessi)"']),
  pad(['Data', 'Descrizione', '"Gross rate"', '"Gross interest"', '"Imposte trattenute"', '"Other taxes"', 'Fees', '"Net interest"']),
  pad(['---------']),
  pad(['"Fondi monetari flessibili Estratti conto delle operazioni"']),
  pad(['"Fondi monetari flessibili  (EUR)"']),
  pad(['"Transaction statement (only returns)"']),
  pad(['Data', 'Descrizione', '"Rendimenti netti"', '"Imposte ritenute"', '"Altre imposte"', '"Commissioni di servizio"', '"Rendimenti netti distribuiti e prelevati"']),
  pad(['"1 set 2026"', '"Interest earned - Fondi monetari flessibili"', '"1,20€"', '"0,00€"', '"0,00€"', '"0,15€"', '"1,05€"']),
  pad(['"2 set 2026"', '"Interest earned - Fondi monetari flessibili"', '"1,30€"', '"0,00€"', '"0,00€"', '"0,16€"', '"1,14€"']),
  pad(['Totale', '', '"2,50€"', '"0,00€"', '"0,00€"', '"0,31€"', '"2,19€"']),
  pad(['---------']),
  pad(['"Fondi monetari flessibili  (USD)"']),
  pad(['"Transaction statement (only returns)"']),
  'Data,Descrizione,"Rendimenti netti","Rendimenti netti","Imposte ritenute","Imposte ritenute","Altre imposte","Altre imposte","Commissioni di servizio","Commissioni di servizio","Rendimenti netti distribuiti e prelevati","Rendimenti netti distribuiti e prelevati"',
  '"1 set 2026","Interest earned - Fondi monetari flessibili","0,50$","0,43€","0,00$","0,00€","0,00$","0,00€","0,10$","0,09€","0,40$","0,35€"',
  'Totale,,"0,50$","0,43€","0,00$","0,00€","0,00$","0,00€","0,10$","0,09€","0,40$","0,35€"',
  pad(['---------']),
  pad(['"Materia prima Estratti conto delle operazioni"']),
  pad(['"Data (di vendita)"', '"Nome della materia prima"', '"Età dei beneficiari"', '"Articoli venduti"', '"Prezzo unitario (Data di inizio vendita)"', '"Valore (di vendita)"', 'Plusvalenze', 'Costi']),
  pad(['---------'])
].join('\n');

const NAME = 'consolidated_statement_2026-09-01_2026-09-30.csv';
const parse = () => C.rowsToTx(C.parseCSV(STATEMENT), NAME);
const find = (txs, desc, cents) => txs.find(t => t.desc === desc && (cents === undefined || t.cents === cents));

describe('Revolut consolidated statement', () => {
  test('reads every account table and fund return, skipping summaries and totals', () => {
    const { txs, file, skipped } = parse();
    expect(txs).toHaveLength(14);
    expect(skipped).toBe(0);
    expect(file).toMatchObject({ from: '2026-09-01', to: '2026-09-30', count: 14, src: 'revolut' });
    expect(txs.every(t => t.src === 'revolut' && t.cur === 'EUR' && t.iban === 'NL00REVO0000000001')).toBe(true);
  });

  test('recognises internal moves, fees, merchants, transfers, and returns', () => {
    const { txs } = parse();
    const kinds = Object.fromEntries(txs.filter(t => t.kind !== 'reward').map(t => [t.desc + ' ' + t.cents, t.kind]));
    expect(kinds).toEqual({
      'Da EUR Fondi monetari flessibili 100000': 'internal',
      'To Giulia Bianchi -90000': 'transfer',
      'Canone piano Plus -399': 'fee',
      'Negozio Sconosciuto -725': 'card',
      'Spotify -1199': 'card',
      'Pagamento da MARIO ROSSI 150000': 'internal',
      'To MARIO ROSSI -40000': 'internal',
      'Zalando -5990': 'card',
      'Zalando 2000': 'card',
      'Al conto di investimento -25000': 'internal',
      'Starbucks NYC -480': 'card'
    });
    expect(txs.filter(t => t.kind === 'reward').map(t => t.cents)).toEqual([105, 114, 35]);
  });

  test('uses the euro column for other currencies and names each account', () => {
    const { txs } = parse();
    expect(find(txs, 'Starbucks NYC').account).toBe('Revolut Conto personale USD');
    expect(find(txs, 'Zalando', -5990).account).toBe('Revolut Conto personale EUR');
    expect(txs.find(t => t.cents === 35).account).toBe('Revolut Fondi monetari flessibili USD');
  });

  test('feeds the monthly balance', () => {
    const store = { tx: [], files: [] };
    C.merge(store, parse());
    const sum = C.summarize(store.tx, { rules: {}, overrides: {}, own: C.ownIbans(store.tx), ai: {} }, '2026-09');
    expect(Object.fromEntries(sum.rows.map(g => [g.id, g.spent]))).toEqual({ abbonamenti: 1598, shopping: 3990, ristoranti: 480 });
    expect(sum.unOut).toBe(90725);
    expect(sum.total).toBe(96793);
    expect(sum.inflow).toBe(254);
    expect(sum.net).toBe(254 - 96793);
    expect(sum.internalOut).toBe(65000);
  });

  test('importing the same statement twice adds nothing', () => {
    const store = { tx: [], files: [] };
    expect(C.merge(store, parse())).toBe(14);
    expect(C.merge(store, parse())).toBe(0);
  });

  test('a bunq transfer to the Revolut IBAN counts as a transfer between own accounts', () => {
    const store = { tx: [], files: [] };
    C.merge(store, parse());
    C.merge(store, C.rowsToTx(C.parseCSV([
      '"Date";"Interest Date";"Amount";"Account";"Counterparty";"Name";"Description"',
      '"2026-09-18";"2026-09-18";"-1500,00";"NL00BUNQ0000000000";"NL00REVO0000000001";"Mario Rossi";"Ricarica Revolut"'
    ].join('\n')), 'bunq.csv'));
    const ctx = { rules: {}, overrides: {}, own: C.ownIbans(store.tx), ai: {} };
    expect(C.categorize(store.tx.find(t => t.src === 'bunq'), ctx).cat).toBe('giroconto');
  });

  test.each([
    ['1 set 2026', '2026-09-01'], ['3 feb 2023', '2023-02-03'], ['30 Sep 2026', '2026-09-30'],
    ['Sep 1, 2026', '2026-09-01'], ['3 mrt 2026', '2026-03-03'], ['12 dic 2025', '2025-12-12'], ['1 xyz 2026', '']
  ])('parses written-out month %s', (text, ymd) => {
    expect(C.parseDate(text)).toBe(ymd);
  });
});
