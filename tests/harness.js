// Runs the app from index.html against a minimal fake DOM, shared by the UI tests.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
export const KEY = 'dove-spendo:v1';

// Execute the shipped scripts, exposing their closure only in this test copy.
// The DOM implements the APIs used by rendering; every network call is mocked.
export function app({ persisted = {}, fetch: fetchMock } = {}) {
  const nodes = new Map();
  const timers = new Map();
  const storage = new Map(Object.entries(persisted));
  const requests = [];
  const downloads = [];
  let nextTimer = 0;

  class Element {
    constructor(tag = 'div', text = '') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = {};
      this.events = {};
      this._text = text;
      this.hidden = false;
      this.value = '';
      this.files = [];
      this.isConnected = true;
      const classes = new Set();
      this.classList = {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        toggle(value, enabled) {
          if (enabled === undefined ? !classes.has(value) : enabled) classes.add(value);
          else classes.delete(value);
        },
        contains: value => classes.has(value)
      };
      if (tag === 'template') this.content = { firstChild: new Element('svg') };
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'id') nodes.set('#' + value, this);
      if (name === 'checked') this.checked = true;
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ''; this.children = children; }
    addEventListener(event, callback) { this.events[event] = callback; }
    querySelector(selector) {
      if (selector.startsWith('#')) return nodes.get(selector) || null;
      const queue = [...this.children];
      while (queue.length) {
        const node = queue.shift();
        if (node.tagName?.toLowerCase() === selector) return node;
        queue.push(...(node.children || []));
      }
      return null;
    }
    focus() {}
    scrollIntoView() {}
    click() { this.events.click?.({ preventDefault() {} }); }
    remove() { this.isConnected = false; }
  }

  for (const id of ['content', 'toast', 'file', 'sheet', 'backdrop', 'foot']) {
    nodes.set('#' + id, new Element());
  }
  nodes.get('#sheet').hidden = true;
  nodes.get('#backdrop').hidden = true;
  nodes.get('#foot').textContent = 'I dati restano sul dispositivo.';
  class TestURL extends URL {
    static createObjectURL(file) { downloads.push(file); return 'blob:test-backup'; }
    static revokeObjectURL() {}
  }
  const window = { addEventListener() {}, scrollTo() {} };
  const context = vm.createContext({
    window,
    document: {
      querySelector: selector => nodes.get(selector) || null,
      querySelectorAll: () => [],
      createElement: tag => new Element(tag),
      createTextNode: text => new Element('#text', text),
      addEventListener() {},
      body: new Element('body'),
      head: new Element('head')
    },
    Node: Element,
    navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0 },
    location: { protocol: 'file:' },
    matchMedia: () => ({ matches: false }),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    setTimeout: (callback, ms) => { const id = ++nextTimer; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options = {}) => {
      requests.push({ url: String(url), ...options });
      if (!fetchMock) throw new Error('Unexpected network request: ' + url);
      return fetchMock(url, options);
    },
    AbortController,
    DOMException,
    URL: TestURL,
    URLSearchParams,
    File,
    TextDecoder,
    Uint8Array,
    console
  });
  // Every inline script before the app is pure (core logic, texts); the app comes last.
  const pure = inlineScripts.slice(0, -1);
  pure.forEach((code, i) => vm.runInContext(code, context, { filename: 'index.html:script-' + i }));
  const exports = [
    'emptyStore', 'ctxOf', 'allCats', 'apiKey', 'setApiKey', 'searchKey', 'setSearchKey',
    'onlineReady', 'aiItem', 'searchQuery', 'aiPost', 'aiBatch', 'applyAi', 'parseAiResults',
    'postJSON', 'runLookup', 'autoLookup', 'cancelLookup', 'importBackup', 'exportBackup',
    'clearAll', 'removeKey', 'render', 'onlineCard', 'save',
    'provider', 'setProvider', 'providerById', 'saveKey', 'PROVIDERS',
    'aiSystem', 'catLabel', 'openSettings', 'closeSheet', 'chooseLang', 'active'
  ];
  const expose = `\nwindow.__test = {
    ${exports.map(name => `${name}: typeof ${name} === 'undefined' ? undefined : ${name}`).join(',\n    ')},
    core: C, getStore: () => store, setStore: value => { store = value; demo = null; },
    getUI: () => ui, getLang: () => lang
  };\n`;
  const source = inlineScripts[inlineScripts.length - 1].replace(/\n\s*render\(\);\s*\}\)\(\);\s*$/, expose + '\n})();');
  if (!source.includes('window.__test')) throw new Error('Cannot instrument app closure');
  vm.runInContext(source, context, { filename: 'index.html:app' });
  return { ...window.__test, requests, storage, nodes, downloads, timers };
}
