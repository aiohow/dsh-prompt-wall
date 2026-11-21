// Headless smoke for client.js: fake React + fake __ModuleLoader__, render
// the Panel with synthetic wall data, assert card wall rendering, favorite
// toggle round-trip, detail open + adapt button wiring, and CSS injection.
import { readFileSync } from 'node:fs';

const created = [];
function h(type, props, ...children) {
  const node = { type, props: props ?? {}, children: children.flat(Infinity) };
  created.push(node);
  return node;
}
const hookStores = new Map();
let curStore = null;
let curIdx = 0;
const React = {
  createElement: h,
  Fragment: 'fragment',
  useContext: () => (key) => key,
  useState(init) {
    const store = curStore;
    const i = curIdx++;
    if (store[i] === undefined) store[i] = typeof init === 'function' ? init() : init;
    return [store[i], (v) => { store[i] = typeof v === 'function' ? v(store[i]) : v; }];
  },
  useEffect: (f) => { f(); },
  useCallback: (f) => f,
  useRef(init) {
    const store = curStore;
    const i = curIdx++;
    if (store[i] === undefined) store[i] = { current: init };
    return store[i];
  },
  createContext: (def) => ({ Provider: 'provider', _default: def }),
};

const wall = {
  total: 250, offset: 0, limit: 100,
  items: [
    { code: 'B海报02', title: 'TITLE_ONE', catcn: '海报', cat: 'posters', tags: ['neon'], shape: 'json', thumb: 'Bposter01', fav: false },
    { code: 'A信息图02', title: 'TITLE_TWO', catcn: '信息图', cat: 'infographic', tags: [], shape: 'arguments', thumb: 'Ainfographic02', fav: true },
    { code: 'D摄影03', title: 'TITLE_THREE', catcn: '摄影质感', cat: 'photo', tags: [], shape: 'plain', thumb: 'Dphoto03', fav: false },
  ],
};
const entry = {
  code: 'B海报02', title: 'TITLE_ONE', catcn: '海报', cat: 'posters', lib: 'x',
  tags: ['neon'], shape: 'json', thumb: 'Bposter01', fav: false,
  prompt: '{"description":"a huge json spec"}', args: [],
};
const adapted = {
  code: 'B海报02', title: 'TITLE_ONE', ok: true, target: 'qwen-image', shape: 'json',
  prompt: 'a huge json spec', notes: ['JSON 结构化规格已提取画面描述（直喂整坨 JSON 会被文本渲染型模型画成文字墙）'], args: [],
};
const calls = [];
globalThis.fetch = async (url, opts) => {
  const body = opts && opts.body ? JSON.parse(opts.body) : {};
  calls.push({ url, body });
  if (url.includes('/search')) return { ok: true, json: async () => ({ ok: true, value: wall }) };
  if (url.includes('/categories')) return { ok: true, json: async () => ({ ok: true, value: { total: 3, categories: [{ name: '海报', count: 2 }] } }) };
  if (url.includes('/get')) return { ok: true, json: async () => ({ ok: true, value: entry }) };
  if (url.includes('/adapt')) return { ok: true, json: async () => ({ ok: true, value: adapted }) };
  if (url.includes('/fav')) return { ok: true, json: async () => ({ ok: true, value: { code: body.code, fav: !wall.items[0].fav, total: 2 } }) };
  return { ok: true, json: async () => ({ ok: true, value: {} }) };
};
const window = { location: { origin: 'http://x' }, addEventListener: () => {}, removeEventListener: () => {} };

const injectedStyles = [];
globalThis.document = {
  head: { appendChild: (el) => injectedStyles.push(el) },
  getElementById: (id) => injectedStyles.find((el) => el.id === id) ?? null,
  createElement: () => ({ style: {}, set textContent(v) { this._t = v; }, get textContent() { return this._t; } }),
};

let def = null;
window.__ModuleLoader__ = { load: (d) => { def = d; } };
const sources = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
new Function('window', 'React', sources)(window, React);
if (!def || def.id !== 'dsh-prompt-wall') { console.error('FAIL: module not registered'); process.exit(1); }

const mod = def.factory((name) => (name === 'react' ? React
  : { register() {}, bind: () => (k) => k, inject() {}, list: () => [] }));

let panelEl = null;
const sidebarRegs = [];
const ctx = {
  effect: (f) => { f(); },
  locale: { register: () => {}, bind: () => (k) => k },
  slots: {
    inject: (where, fn) => fn(),
    register: (cfg, render) => {
      if (cfg.name === 'main') panelEl = render();
      if (cfg.name === 'sidebar.panellist') sidebarRegs.push(cfg);
      return () => {};
    },
  },
};
mod.apply(ctx);

const fails = [];
const expect = (name, pass) => { if (!pass) fails.push(name); };
expect('main panel registered', !!panelEl);
expect('sidebar row registered', sidebarRegs.length === 1 && sidebarRegs[0].id === 'prompt-wall');

function render(node) {
  if (node === null || node === undefined || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return;
  if (Array.isArray(node)) { node.forEach(render); return; }
  if (typeof node.type === 'function') {
    const key = node.type;
    if (!hookStores.has(key)) hookStores.set(key, []);
    const prevStore = curStore, prevIdx = curIdx;
    curStore = hookStores.get(key); curIdx = 0;
    const out = node.type(node.props);
    render(out);
    curStore = prevStore; curIdx = prevIdx;
    return;
  }
  (node.children ?? []).forEach(render);
}
function textsOf(nodes) {
  const out = [];
  const collect = (c) => {
    if (typeof c === 'string' || typeof c === 'number') out.push(String(c));
    else if (Array.isArray(c)) c.forEach(collect);
    else if (c && typeof c === 'object' && 'children' in c) c.children.forEach(collect);
  };
  nodes.forEach((n) => collect(n.children));
  return out.join('|');
}

// Pass 1: trigger load
render(panelEl);
await new Promise((r) => setTimeout(r, 10));

// Pass 2: card wall assertions
created.length = 0;
render(panelEl);
let joined = textsOf(created);
expect('cards rendered with titles', joined.includes('TITLE_ONE') && joined.includes('TITLE_THREE'));
expect('codes rendered', joined.includes('B海报02'));
expect('shape chips rendered', joined.includes('shape.json') && joined.includes('shape.plain'));
expect('count shown', joined.includes('3'));
expect('CSS injected once', injectedStyles.length === 1 && String(injectedStyles[0].textContent).includes('.pw-root .pw-card'));
expect('thumb url has .thumb suffix', created.some((n) => typeof n.props.src === 'string' && n.props.src.includes('.thumb')));
const css = String(injectedStyles[0].textContent);
expect('waterfall columns css', /\.pw-root \.pw-grid \{[^}]*columns:/.test(css));
expect('card break-inside avoid', /\.pw-root \.pw-card \{[^}]*break-inside: avoid/.test(css));
expect('bar carries top padding', /\.pw-root \.pw-bar \{[^}]*padding: 20px 24px 10px/.test(css));
expect('thumb no fixed aspect', !/\.pw-thumb \{[^}]*aspect-ratio: 4\/3/.test(css));

// Favorite toggle on first card
const star = created.find((n) => n.type === 'button' && n.props.className === 'pw-star');
if (!star) { console.error('FAIL: star button not found'); process.exit(1); }
star.props.onClick({ stopPropagation: () => {} });
await new Promise((r) => setTimeout(r, 10));
expect('fav call sent', calls.some((c) => c.url.includes('/fav') && c.body.code === 'B海报02'));

// Open detail via card click
const card = created.find((n) => n.props.className === 'pw-card');
if (!card) { console.error('FAIL: card not found'); process.exit(1); }
card.props.onClick();
await new Promise((r) => setTimeout(r, 10));

// Pass 3: detail assertions (Detail mounts on this render, its get-fetch
// resolves in a microtask, so render again after a tick)
created.length = 0;
render(panelEl);
await new Promise((r) => setTimeout(r, 10));
created.length = 0;
render(panelEl);
joined = textsOf(created);
expect('detail opened with title', joined.includes('TITLE_ONE'));
expect('detail shows raw prompt', joined.includes('a huge json spec'));
// raw-prompt copy button present before any adaptation
const copyBtns = created.filter((n) => n.type === 'button' && n.children.flat(Infinity).includes('detail.copy'));
expect('raw prompt copy button rendered', copyBtns.length >= 1);
expect('detail shows target buttons', joined.includes('qwen-image') && joined.includes('gpt-image') && joined.includes('h3-image') && joined.includes('generic'));

// Fire adapt button
const adaptBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('detail.adaptbtn'));
if (!adaptBtn) { console.error('FAIL: adapt button not found'); console.error('detail texts:', joined.slice(0, 600)); process.exit(1); }
adaptBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
created.length = 0;
render(panelEl);
joined = textsOf(created);
expect('adapt call sent with target', calls.some((c) => c.url.includes('/adapt') && c.body.target === 'qwen-image'));
expect('adapted prompt + note rendered', joined.includes('a huge json spec') && joined.includes('文字墙'));

// --- inspiration / settings / help / code-copy -----------------------------
// boot fetched settings first
expect('settings fetched on boot', calls.some((c) => c.url.includes('/settings')));
// sticky bar css
expect('bar sticky css', /\.pw-root \.pw-bar \{[^}]*position: sticky/.test(css));
// close detail, back to wall
const closeBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('detail.close'));
closeBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
created.length = 0;
render(panelEl);
joined = textsOf(created);
expect('inspire button in bar', joined.includes('inspire'));
expect('settings button in bar', joined.includes('settings'));
expect('help button in bar', joined.includes('help'));
// card code is a copy button
const codeBtn = created.find((n) => n.type === 'button' && n.props.className === 'pw-codebtn');
expect('card code copy button', !!codeBtn && codeBtn.children.flat(Infinity).includes('B海报02'));
// scroll near bottom triggers next page with offset = loaded count
const root = created.find((n) => n.props.className === 'pw-root');
expect('root has onScroll', typeof root.props.onScroll === 'function');
root.props.onScroll({ currentTarget: { scrollHeight: 10000, scrollTop: 9000, clientHeight: 8000 } });
await new Promise((r) => setTimeout(r, 10));
expect('scroll loads next page', calls.some((c) => c.url.includes('/search') && c.body.offset === 3 && c.body.limit === 100));
created.length = 0;
render(panelEl);
expect('progress count shows loaded/total', textsOf(created).includes('6/250'));
// inspire click sends random search
const inspBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('inspire'));
inspBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
expect('inspire sends random search', calls.some((c) => c.url.includes('/search') && c.body.random === true));
// settings popover with three modes
created.length = 0;
render(panelEl);
const setBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('settings') && n.props.className === 'pw-btn');
setBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
created.length = 0;
render(panelEl);
joined = textsOf(created);
expect('settings popover modes', joined.includes('settings.wall') && joined.includes('settings.random') && joined.includes('settings.fav'));
const favModeBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('settings.fav'));
const callsBeforeMode = calls.length;
favModeBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
expect('mode persisted via settings call', calls.some((c) => c.url.includes('/settings') && c.body.openMode === 'fav'));
expect('mode applies immediately (fav search after click)', calls.slice(callsBeforeMode).some((c) => c.url.includes('/search') && c.body.fav === true && c.body.offset === 0));
// help view replaces grid, back button returns
created.length = 0;
render(panelEl);
const helpBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('help') && n.props.className === 'pw-btn');
helpBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
created.length = 0;
render(panelEl);
joined = textsOf(created);
expect('help view shows steps', joined.includes('help.title') && joined.includes('help.step2t') && joined.includes('help.back'));
expect('help mentions copy usage', joined.includes('help.step3t') && joined.includes('help.step4t'));
expect('help footer has license+disclaimer', joined.includes('help.aboutt') && joined.includes('help.license') && joined.includes('help.disclaimer') && joined.includes('help.nonaffil'));
expect('help view hides grid', !joined.includes('TITLE_ONE'));
const backBtn = created.find((n) => n.type === 'button' && textsOf([n]).includes('help.back'));
backBtn.props.onClick();
await new Promise((r) => setTimeout(r, 10));
created.length = 0;
render(panelEl);
expect('back returns to wall', textsOf(created).includes('TITLE_ONE'));

if (fails.length) { console.error('FAIL:', fails.join('; ')); console.error('texts:', textsOf(created).slice(0, 300)); process.exit(1); }
console.log('CLIENT_SMOKE_OK');
