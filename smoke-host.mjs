// Host smoke: load index.js, run apply() with a fake ctx, exercise the two
// tools against the real bundled entries.json. Asserts shape detection,
// JSON extraction (no raw JSON leaks to qwen-image), gpt-image passthrough,
// {argument} filling, favorites round-trip, and search paging.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { apply, inject } from './index.js';

const fails = [];
const expect = (name, pass) => { if (!pass) fails.push(name); };
expect('inject declares tools+systemPrompt', inject.includes('tools') && inject.includes('systemPrompt'));

const tools = new Map();
const sections = [];
const routes = new Map();
const ctx = {
  effect: (f) => f(),
  log: () => {},
  tools: { register: (def) => { tools.set(def.name, def); return () => {}; } },
  systemPrompt: { section: (s) => { sections.push(s); return () => {}; } },
  inject: (deps, fn) => fn({ get: (d) => (d === 'connection' ? { fetch: { register: (r) => { routes.set(r.path, r); return () => {}; } } } : undefined), effect: (f) => f() }),
};
const favsFile = path.join(mkdtempSync(path.join(tmpdir(), 'pw-fav-')), 'favs.json');
apply(ctx, { favs_file: favsFile });

expect('two tools registered', tools.has('prompt_wall') && tools.has('prompt_wall_adapt'));
expect('prompt section registered', sections.some((s) => s.name === 'prompt-wall:guide'));
expect('six routes registered', routes.size === 6);

const wall = tools.get('prompt_wall');
const adapt = tools.get('prompt_wall_adapt');

// categories
const cats = await wall.execute({ action: 'categories' });
expect('categories total 1126', cats.total === 1126);
expect('categories non-empty', cats.categories.length >= 10);

// search
const s1 = await wall.execute({ action: 'search', q: 'poster', limit: 5 });
expect('search returns items', s1.items.length === 5 && s1.total > 5);
expect('search item shape', typeof s1.items[0].code === 'string' && typeof s1.items[0].shape === 'string');
const s2 = await wall.execute({ action: 'search', cat: '海报', limit: 3 });
expect('cat filter works', s2.items.every((i) => i.catcn === '海报'));

// get a JSON-spec entry and adapt per target (find one dynamically)
const jsonEntry = (await wall.execute({ action: 'search', q: 'poster', limit: 100 })).items.find((i) => i.shape === 'json')?.code
  ?? (await wall.execute({ action: 'search', limit: 200 })).items.find((i) => i.shape === 'json')?.code;
expect('a json-shape entry exists', !!jsonEntry);
if (jsonEntry) {
  const aq = await adapt.execute({ code: jsonEntry, target: 'qwen-image' });
  expect('qwen adapt ok', aq.ok === true);
  expect('qwen adapt extracted (no raw JSON braces wall)', !/^\{[\s\S]*"\s*:/.test(aq.prompt));
  expect('qwen note mentions extraction', aq.notes.some((n) => n.includes('提取')));
  const ag = await adapt.execute({ code: jsonEntry, target: 'gpt-image' });
  expect('gpt-image keeps structured spec', ag.ok === true && /^\{/.test(ag.prompt));
}

// {argument} entry: fill defaults + user override (found dynamically)
const argCode = (await wall.execute({ action: 'search', limit: 200 })).items.find((i) => i.shape === 'arguments')?.code;
expect('an arguments-shape entry exists', !!argCode);
const aa = await adapt.execute({ code: argCode, target: 'generic' });
expect('arguments entry adapts ok', aa.ok === true);
expect('no unfilled {argument} left', !aa.prompt.includes('{argument'));
const argEntry = await wall.execute({ action: 'get', code: argCode });
const slotName = argEntry.args[0]?.name;
const aa2 = await adapt.execute({ code: argCode, target: 'generic', params: { [slotName]: 'ZZTESTVALUE' } });
expect('user param override applied', aa2.prompt.includes('ZZTESTVALUE'));

// favorites round-trip through the route seam
const favRoute = routes.get('/api/prompt-wall/fav');
const someCode = s1.items[0].code;
const r1 = await (await favRoute.fetch({ json: async () => ({ code: someCode }) })).json();
expect('fav added', r1.ok && r1.value.fav === true);
const r2 = await (await favRoute.fetch({ json: async () => ({ code: someCode }) })).json();
expect('fav toggled off', r2.ok && r2.value.fav === false);
const sf = await wall.execute({ action: 'search', fav: true, limit: 10 });
expect('fav filter reflects state', sf.total === 0);

// thumb route serves a real bundled thumbnail
const thumbRoute = routes.get('/api/prompt-wall/thumb');
const thumbName = s1.items[0].thumb;
const tr = await thumbRoute.fetch({ url: `http://x/api/prompt-wall/thumb?name=${encodeURIComponent(thumbName)}.thumb` });
expect('thumb served with image content-type', tr.status === 200 && String(tr.headers.get('content-type')).startsWith('image/'));

// empty-prompt entry guidance
const emptyEntry = (await wall.execute({ action: 'search', q: ' ', limit: 200 })).items;
const ae = await adapt.execute({ code: (await wall.execute({ action: 'get', code: emptyEntry[0].code })).shape === 'empty' ? emptyEntry[0].code : 'B海报01', target: 'qwen-image' });
expect('adapt returns structured result', typeof ae.ok === 'boolean' && typeof ae.prompt === 'string');

// waterfall additions: every entry carries pixel dims and a non-empty prompt
const all = await wall.execute({ action: 'search', limit: 100, offset: 0 });
expect('search items carry w/h', all.items.every((i) => Number.isInteger(i.w) && i.w > 0 && Number.isInteger(i.h) && i.h > 0));
const noEmpty = all.items.every((i) => i.shape !== 'empty');
expect('no empty-shape entries on first page', noEmpty);
const mid = await wall.execute({ action: 'search', limit: 100, offset: 600 });
expect('mid-page items carry w/h too', mid.items.every((i) => i.w > 0 && i.h > 0 && i.shape !== 'empty'));
const one = await wall.execute({ action: 'get', code: all.items[0].code });
expect('public entry carries w/h', one.w > 0 && one.h > 0 && (one.prompt || '').length > 0);

if (fails.length) { console.error('FAIL:', fails.join('; ')); process.exit(1); }
console.log('HOST_SMOKE_OK');
