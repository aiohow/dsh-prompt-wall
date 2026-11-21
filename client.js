/**
 * dsh-prompt-wall — client half.
 *
 * Sidebar row (sidebar.panellist) + main panel: searchable card wall of the
 * bundled prompt templates. Card click opens a detail with the raw prompt,
 * per-target adaptation (qwen-image / h3-image / gpt-image / generic) and a
 * copy button. Favorites toggle through the host route.
 *
 * Data flows through authenticated /api/prompt-wall/* routes; thumbnails are
 * served by the host from the bundle. Styling uses only --dsw-alias-* tokens;
 * controls hand-rolled (no cross-package requires), same rules as dsh-focus-bar.
 */

const PW_CSS = `
.pw-root { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; min-width: 0; max-width: 100%; box-sizing: border-box; padding: 0 24px; overflow-y: auto; }
.pw-root .pw-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  position: sticky; top: 0; z-index: 5; margin: 0 -24px; padding: 20px 24px 10px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 8px 14px -10px rgba(0,0,0,.28); }
.pw-root .pw-bar-right { display: flex; gap: 8px; align-items: center; margin-left: auto; }
.pw-root .pw-codebtn { background: none; border: none; padding: 0; font: inherit; color: inherit;
  cursor: pointer; border-bottom: 1px dashed color-mix(in srgb, var(--dsw-alias-label-secondary) 55%, transparent); }
.pw-root .pw-codebtn:hover { color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary)); }
.pw-root .pw-pop { position: absolute; right: 24px; top: calc(100% + 4px); z-index: 6;
  min-width: 200px; padding: 10px 12px; border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  box-shadow: 0 10px 26px rgba(0,0,0,.22); display: flex; flex-direction: column; gap: 6px; }
.pw-root .pw-pop .pw-label { margin: 0 0 2px; }
.pw-root .pw-pop .pw-btn { text-align: left; }
.pw-root .pw-help { max-width: 640px; margin: 8px auto 24px; display: flex; flex-direction: column; gap: 10px;
  font-size: 13px; line-height: 1.7; color: var(--dsw-alias-label-primary); }
.pw-root .pw-help h4 { margin: 6px 0 0; font-size: 13px; }
.pw-root .pw-help ol { margin: 0; padding-left: 20px; }
.pw-root .pw-help li { margin: 4px 0; }
.pw-root .pw-about { margin-top: 6px; padding: 10px 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
.pw-root .pw-about p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.pw-root .pw-help code { padding: 1px 5px; border-radius: 4px; font-size: 12px;
  background: var(--dsw-alias-bg-layer-2); }
.pw-root .pw-input {
  flex: 1 1 220px; min-width: 160px; height: 30px; padding: 0 10px;
  border-radius: 7px; font-size: 13px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  outline: none;
}
.pw-root .pw-input:focus { border-color: var(--dsw-alias-brand-primary, var(--dsw-alias-label-primary)); }
.pw-root .pw-select {
  height: 30px; padding: 0 8px; border-radius: 7px; font-size: 12px;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
}
.pw-root .pw-btn {
  height: 30px; padding: 0 12px; border-radius: 7px; font-size: 12px; cursor: pointer;
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
}
.pw-root .pw-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.pw-root .pw-btn[aria-pressed="true"] {
  color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary);
}
.pw-root .pw-count { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.pw-root .pw-grid {
  columns: 4 220px; column-gap: 10px;
  padding-bottom: 16px;
}
.pw-root .pw-card {
  break-inside: avoid; -webkit-column-break-inside: avoid;
  margin: 0 0 10px; border-radius: 10px; overflow: hidden; cursor: pointer;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  transition: transform 160ms ease, box-shadow 160ms ease;
}
.pw-root .pw-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0,0,0,.18);
}
.pw-root .pw-thumb { width: 100%; height: auto; display: block; background: var(--dsw-alias-bg-layer-2); }
.pw-root .pw-card .pw-meta { padding: 7px 9px 9px; display: flex; flex-direction: column; gap: 4px; }
.pw-root .pw-title { font-size: 12px; line-height: 1.35; color: var(--dsw-alias-label-primary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pw-root .pw-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.pw-root .pw-star { margin-left: auto; cursor: pointer; font-size: 14px; line-height: 1;
  color: var(--dsw-alias-label-tertiary); background: none; border: none; padding: 0 2px; }
.pw-root .pw-star[aria-pressed="true"] { color: var(--dsw-alias-state-warn-primary); }
.pw-root .pw-chip { padding: 0 6px; border-radius: 4px; font-size: 10px; line-height: 16px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent); }
.pw-root .pw-chip[data-shape="json"] { color: #e58a5a; border-color: #e58a5a66; }
.pw-root .pw-chip[data-shape="arguments"] { color: #64a8e6; border-color: #64a8e666; }
.pw-root .pw-chip[data-shape="empty"] { color: var(--dsw-alias-label-tertiary); }
.pw-root .pw-modal {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.45);
}
.pw-root .pw-detail {
  width: min(760px, 92vw); max-height: 88vh; overflow-y: auto; border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px;
}
.pw-root .pw-detail h3 { margin: 0; font-size: 15px; }
.pw-root .pw-detail img { max-width: 100%; border-radius: 8px; align-self: center; }
.pw-root .pw-label { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 4px; }
.pw-root .pw-pre {
  margin: 0; padding: 10px; border-radius: 8px; font-size: 12px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto;
  background: var(--dsw-alias-bg-layer-2);
}
.pw-root .pw-targets { display: flex; flex-wrap: wrap; gap: 6px; }
.pw-root .pw-note { font-size: 11px; color: var(--dsw-alias-state-warn-primary); }
.pw-root .pw-close { align-self: flex-end; }
.pw-root .pw-empty { text-align: center; padding: 40px 0; font-size: 13px; color: var(--dsw-alias-label-tertiary); }
`;

window.__ModuleLoader__.load({
  id: 'dsh-prompt-wall',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'dsh-prompt-wall';
    const TARGETS = ['qwen-image', 'h3-image', 'gpt-image', 'generic'];
    const OPEN_MODES = ['wall', 'random', 'fav'];
    const zh = {
      'panel.title': '模板墙',
      'search.placeholder': '搜索模板：关键词 / 分类 / 标签…',
      'filter.all': '全部分类',
      'filter.fav': '只看收藏',
      'count.n': '共 {n} 例',
      'shape.plain': '纯文本',
      'shape.arguments': '带参数',
      'shape.json': 'JSON规格',
      'shape.empty': '无提示词',
      'detail.prompt': '原始提示词',
      'detail.adapt': '目标模型适配',
      'detail.adapted': '适配后提示词',
      'detail.adaptbtn': '生成适配',
      'detail.copy': '复制',
      'detail.copied': '已复制',
      'detail.args': '参数槽位',
      'detail.close': '关闭',
      'detail.notfound': '未找到该模板',
      'error.load': '读取模板墙失败',
      'retry': '重试',
      'inspire': '找灵感',
      'inspire.badge': '灵感一刷 · 再点换一批',
      'settings': '设置',
      'settings.openMode': '打开模板墙时',
      'settings.wall': '显示全部模板',
      'settings.random': '随机刷一批灵感',
      'settings.fav': '优先显示收藏',
      'help': '帮助',
      'help.back': '返回模板墙',
      'copyCode': '点复制编号',
      'copiedCode': '编号已复制',
      'help.title': '模板墙怎么用',
      'help.step1t': '挑一张喜欢的',
      'help.step1': '在墙上刷图，点卡片看大图和提示词全文；点卡片上的编号（如 {ex}）即可复制编号。',
      'help.step2t': '让 AI 出图',
      'help.step2': '把编号粘贴到对话里，说一句「用 {ex} 出图」或「{ex} 适配 h3-image」，AI 会自动取提示词、按目标模型适配并出图。',
      'help.step3t': '复制提示词',
      'help.step3': '点开模板详情：原文下方的「复制」拿原始提示词；选目标模型点「生成适配」后，适配版下方的「复制」拿的就是适配该模型的版本，直接贴给对应模型或生图工具即可。',
      'help.step4t': '收藏与灵感',
      'help.step4': '点 ☆ 收藏满意的模板；没方向时点「找灵感」随机刷一批；「设置」里可选每次打开先看收藏还是先看随机。',
      'help.aboutt': '开源许可与免责声明',
      'help.license': '插件代码采用 MIT 许可（见安装目录 LICENSE）。模板数据与例图不属于 MIT：来自 10 个上游仓库，各自遵循其原始许可（MIT / Apache-2.0 / CC BY 4.0 / CC0 / 仓库署名声明），来源与条款见 UPSTREAMS.md 与 licenses/upstream/；二次分发时请按对应上游许可执行。',
      'help.disclaimer': '模板为社区收集，未逐一验证；生成效果取决于你的模型与参数，本插件不对输出质量作任何明示或暗示的保证。例图为上游生成结果的缩略图，仅供风格参考，不代表你的出图效果。',
      'help.nonaffil': '本插件为独立社区项目，与 OpenAI、Google 及任何模型厂商无隶属或背书关系；GPT、ChatGPT、Nano Banana 等名称与商标归各自所有者。',
      'help.note': '插件使用数据纯本地：模板、收藏与设置都保存在本机，不需联网。',
      'more.loading': '加载更多…',
    };
    const en = {
      'panel.title': 'Prompt wall',
      'search.placeholder': 'Search templates…',
      'filter.all': 'All categories',
      'filter.fav': 'Favorites only',
      'count.n': '{n} templates',
      'shape.plain': 'plain',
      'shape.arguments': 'args',
      'shape.json': 'json spec',
      'shape.empty': 'no prompt',
      'detail.prompt': 'Raw prompt',
      'detail.adapt': 'Target model',
      'detail.adapted': 'Adapted prompt',
      'detail.adaptbtn': 'Adapt',
      'detail.copy': 'Copy',
      'detail.copied': 'Copied',
      'detail.args': 'Argument slots',
      'detail.close': 'Close',
      'detail.notfound': 'Template not found',
      'error.load': 'Failed to load prompt wall',
      'retry': 'Retry',
      'inspire': 'Inspire me',
      'inspire.badge': 'Random draw · click again for more',
      'settings': 'Settings',
      'settings.openMode': 'On open, show',
      'settings.wall': 'All templates',
      'settings.random': 'A random inspiration batch',
      'settings.fav': 'Favorites first',
      'help': 'Help',
      'help.back': 'Back to wall',
      'copyCode': 'Copy code',
      'copiedCode': 'Copied',
      'help.title': 'How to use the prompt wall',
      'help.step1t': 'Pick a card',
      'help.step1': 'Browse the wall, click a card for the full prompt; click its code (e.g. {ex}) to copy it.',
      'help.step2t': 'Ask the agent to generate',
      'help.step2': 'Paste the code in chat and say "generate with {ex}" or "{ex} adapt for h3-image"; the agent fetches the prompt, adapts it to the target model and generates.',
      'help.step3t': 'Copy prompts',
      'help.step3': 'Open a template: "Copy" under the original grabs it as-is; pick a target model, hit "Adapt", then "Copy" under the adapted version, ready to paste into that model.',
      'help.step4t': 'Favorites & inspiration',
      'help.step4': 'Tap ☆ to favorite; tap "Inspire me" for a random batch; Settings chooses what you see on open.',
      'help.aboutt': 'License & Disclaimer',
      'help.license': 'Plugin code is MIT-licensed (see LICENSE in the install directory). Template data and thumbnails are not MIT: they come from 10 upstream repositories under their own licenses (MIT / Apache-2.0 / CC BY 4.0 / CC0 / per-repo notices); see UPSTREAMS.md and licenses/upstream/ and follow the matching upstream terms when redistributing.',
      'help.disclaimer': 'Templates are community-collected and not individually verified. Generation results depend on your model and parameters; this plugin makes no warranties of any kind about output quality. Preview thumbnails are resized upstream outputs shown for style reference only.',
      'help.nonaffil': 'An independent community project, not affiliated with or endorsed by OpenAI, Google, or any model vendor; GPT, ChatGPT, Nano Banana and other names are trademarks of their respective owners.',
      'help.note': 'All plugin data stays local: templates, favorites and settings live on this machine. No network required.',
      'more.loading': 'Loading more…',
    };
    const LocaleContext = React.createContext((key) => key);

    async function call(op, args) {
      const response = await fetch(`/api/prompt-wall/${op}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(args ?? {}),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body && body.ok === true) return body.value;
      throw new Error(body?.error?.message ?? 'unknown error');
    }

    const thumbUrl = (name) => `/api/prompt-wall/thumb?name=${encodeURIComponent(name)}.thumb`;

    async function copyToClipboard(text) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* non-secure ctx */ }
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove(); return ok;
      } catch { return false; }
    }

    function ensureCss() {
      if (typeof document === 'undefined' || document.getElementById('pw-css')) return;
      const el = document.createElement('style');
      el.id = 'pw-css';
      el.textContent = PW_CSS;
      document.head.appendChild(el);
    }

    function Icon({ size }) {
      const s = typeof size === 'number' ? size : 16;
      return h('svg', {
        width: s, height: s, viewBox: '0 0 16 16', fill: 'none',
        stroke: 'currentColor', 'stroke-width': 1.3, 'aria-hidden': true,
      },
      h('rect', { x: 1.4, y: 1.4, width: 5.6, height: 5.6, rx: 1.2 }),
      h('rect', { x: 9, y: 1.4, width: 5.6, height: 5.6, rx: 1.2, opacity: 0.7 }),
      h('rect', { x: 1.4, y: 9, width: 5.6, height: 5.6, rx: 1.2, opacity: 0.7 }),
      h('rect', { x: 9, y: 9, width: 5.6, height: 5.6, rx: 1.2, opacity: 0.4 }));
    }

    function ShapeChip({ shape }) {
      const t = React.useContext(LocaleContext);
      return h('span', { className: 'pw-chip', 'data-shape': shape }, t(`shape.${shape}`));
    }

    function Card({ item, onOpen, onFav }) {
      const t = React.useContext(LocaleContext);
      const [favBusy, setFavBusy] = React.useState(false);
      const [codeCopied, setCodeCopied] = React.useState(false);
      const fav = async (e) => {
        e.stopPropagation();
        if (favBusy) return;
        setFavBusy(true);
        try { await onFav(item); } finally { setFavBusy(false); }
      };
      const copyCode = async (e) => {
        e.stopPropagation();
        await copyToClipboard(item.code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 1200);
      };
      return h('div', { className: 'pw-card', onClick: () => onOpen(item.code) },
        h('img', { className: 'pw-thumb', loading: 'lazy', src: thumbUrl(item.thumb), alt: item.code,
          width: item.w || undefined, height: item.h || undefined,
          style: item.w && item.h ? { aspectRatio: `${item.w} / ${item.h}` } : undefined,
          onError: (e) => { e.target.style.visibility = 'hidden'; } }),
        h('div', { className: 'pw-meta' },
          h('div', { className: 'pw-title' }, item.title || item.code),
          h('div', { className: 'pw-row' },
            h('button', { className: 'pw-codebtn', title: t('copyCode'), onClick: copyCode },
              codeCopied ? t('copiedCode') : item.code),
            h('span', null, item.catcn),
            h(ShapeChip, { shape: item.shape }),
            h('button', {
              className: 'pw-star', 'aria-pressed': item.fav ? 'true' : 'false',
              role: 'switch', 'aria-checked': item.fav ? 'true' : 'false',
              title: 'fav', onClick: fav,
            }, item.fav ? '★' : '☆'))));
    }

    function Detail({ code, onClose, onChanged }) {
      const t = React.useContext(LocaleContext);
      const [entry, setEntry] = React.useState(null);
      const [error, setError] = React.useState('');
      const [target, setTarget] = React.useState('qwen-image');
      const [adapted, setAdapted] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [copied, setCopied] = React.useState(false);
      const [copiedRaw, setCopiedRaw] = React.useState(false);
      const [copiedCode, setCopiedCode] = React.useState(false);

      React.useEffect(() => {
        let alive = true;
        call('get', { code })
          .then((v) => alive && setEntry(v))
          .catch((e) => alive && setError(e.message || String(e)));
        return () => { alive = false; };
      }, [code]);

      React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      const doAdapt = async () => {
        setBusy(true); setError('');
        try { setAdapted(await call('adapt', { code, target })); }
        catch (e) { setError(e.message || String(e)); }
        finally { setBusy(false); }
      };

      const copyText = async (text, setFlag) => {
        await copyToClipboard(text);
        setFlag(true);
        setTimeout(() => setFlag(false), 1500);
      };
      const copy = () => copyText(adapted?.ok ? adapted.prompt : (entry?.prompt || ''), setCopied);
      const copyRaw = () => copyText(entry?.prompt || '', setCopiedRaw);
      const copyCode = () => copyText(code, setCopiedCode);

      const toggleFav = async () => {
        if (!entry) return;
        try { const r = await call('fav', { code }); setEntry({ ...entry, fav: r.fav }); onChanged && onChanged(code, r.fav); }
        catch (e) { setError(e.message || String(e)); }
      };

      return h('div', { className: 'pw-modal', onClick: (e) => { if (e.target.classList.contains('pw-modal')) onClose(); } },
        h('div', { className: 'pw-detail', role: 'dialog', 'aria-modal': 'true' },
          error && !entry ? h('div', null, error, ' ', h('button', { className: 'pw-btn', onClick: onClose }, t('detail.close')))
            : !entry ? h('div', null, '…')
            : h(React.Fragment, null,
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                h('h3', { style: { flex: 1 } }, `${entry.code} · ${entry.title}`),
                h('button', { className: 'pw-btn', title: t('copyCode'), onClick: copyCode },
                  copiedCode ? t('copiedCode') : t('copyCode')),
                h('button', { className: 'pw-star', 'aria-pressed': entry.fav ? 'true' : 'false',
                  role: 'switch', 'aria-checked': entry.fav ? 'true' : 'false', onClick: toggleFav }, entry.fav ? '★' : '☆'),
                h('button', { className: 'pw-btn pw-close', onClick: onClose }, t('detail.close'))),
              h('img', { src: thumbUrl(entry.thumb), alt: entry.code }),
              h('div', { className: 'pw-row' },
                h('span', null, entry.catcn),
                (entry.tags || []).slice(0, 6).map((tag) => h('span', { key: tag, className: 'pw-chip' }, tag))),
              entry.args && entry.args.length > 0 && h(React.Fragment, null,
                h('div', { className: 'pw-label' }, t('detail.args')),
                h('div', { className: 'pw-row' }, entry.args.map((a) => h('span', { key: a.name, className: 'pw-chip' }, `${a.name}=${a.default || '…'}`)))),
              h('div', { className: 'pw-label' }, t('detail.prompt')),
              h('pre', { className: 'pw-pre' }, entry.prompt || '—'),
              entry.prompt ? h('button', { className: 'pw-btn', onClick: copyRaw }, copiedRaw ? t('detail.copied') : t('detail.copy')) : null,
              h('div', { className: 'pw-label' }, t('detail.adapt')),
              h('div', { className: 'pw-targets' },
                TARGETS.map((tg) => h('button', {
                  key: tg, className: 'pw-btn', 'aria-pressed': target === tg ? 'true' : 'false',
                  onClick: () => { setTarget(tg); setAdapted(null); },
                }, tg)),
                h('button', { className: 'pw-btn', onClick: doAdapt, disabled: busy }, busy ? '…' : t('detail.adaptbtn'))),
              adapted && h(React.Fragment, null,
                h('div', { className: 'pw-label' }, t('detail.adapted')),
                adapted.notes && adapted.notes.map((n, i) => h('div', { key: i, className: 'pw-note' }, '· ' + n)),
                adapted.ok
                  ? h(React.Fragment, null,
                      h('pre', { className: 'pw-pre' }, adapted.prompt),
                      h('button', { className: 'pw-btn', onClick: copy }, copied ? t('detail.copied') : t('detail.copy')))
                  : h('div', { className: 'pw-note' }, adapted.prompt)))));
    }

    function Help({ onBack }) {
      const t = React.useContext(LocaleContext);
      const ex = 'C海报01';
      return h('div', { className: 'pw-help' },
        h('h4', null, t('help.title')),
        h('ol', null,
          h('li', null, h('b', null, t('help.step1t')), h('br'), t('help.step1').replace(/\{ex\}/g, ex)),
          h('li', null, h('b', null, t('help.step2t')), h('br'), t('help.step2').replace(/\{ex\}/g, ex)),
          h('li', null, h('b', null, t('help.step3t')), h('br'), t('help.step3')),
          h('li', null, h('b', null, t('help.step4t')), h('br'), t('help.step4'))),
        h('div', { className: 'pw-about' },
          h('div', { className: 'pw-label' }, t('help.aboutt')),
          h('p', null, t('help.license')),
          h('p', null, t('help.disclaimer')),
          h('p', null, t('help.nonaffil')),
          h('p', null, t('help.note'))),
        h('button', { className: 'pw-btn', onClick: onBack, style: { alignSelf: 'flex-start', marginTop: 6 } }, '← ' + t('help.back')));
    }

    function Panel() {
      const t = React.useContext(LocaleContext);
      const [state, setState] = React.useState({ status: 'loading', items: [], total: 0, random: false, error: '' });
      const [cats, setCats] = React.useState([]);
      const [q, setQ] = React.useState('');
      const [cat, setCat] = React.useState('');
      const [onlyFav, setOnlyFav] = React.useState(false);
      const [open, setOpen] = React.useState(null);
      const [view, setView] = React.useState('wall');
      const [showSettings, setShowSettings] = React.useState(false);
      const [openMode, setOpenMode] = React.useState('wall');
      const [loadingMore, setLoadingMore] = React.useState(false);
      const booted = React.useRef(false);
      const rootRef = React.useRef(null);
      const scrollMem = React.useRef({ all: 0, fav: 0 });
      const restoreTo = React.useRef(null);
      const PAGE = 100;

      const load = React.useCallback(async (opts) => {
        const rnd = opts?.random === true;
        const viewKey = rnd ? 'random' : (opts?.favFirst ? true : onlyFav);
        setState((s) => ({ ...s, status: s.items.length ? 'refreshing' : 'loading' }));
        try {
          const data = await call('search', rnd
            ? { q: '', cat: '', fav: false, random: true, limit: 24 }
            : { q, cat, fav: opts?.favFirst ? true : onlyFav, limit: PAGE, offset: 0 });
          setState({ status: 'ready', items: data.items, total: data.total, random: !!data.random, viewKey, error: '' });
        } catch (error) {
          setState({ status: 'error', items: [], total: 0, random: false, viewKey, error: error instanceof Error ? error.message : String(error) });
        }
      }, [q, cat, onlyFav]);

      const loadMore = React.useCallback(async () => {
        setState((s) => {
          if (s.status !== 'ready' || s.random || s.items.length >= s.total) return s;
          return s;
        });
        const cur = stateRef.current;
        if (cur.status !== 'ready' || cur.random || cur.items.length >= cur.total || moreBusy.current) return;
        moreBusy.current = true; setLoadingMore(true);
        try {
          const data = await call('search', { q, cat, fav: onlyFav, limit: PAGE, offset: cur.items.length });
          setState((s) => ({ ...s, items: s.items.concat(data.items), total: data.total }));
        } catch { /* keep what we have; next scroll retries */ }
        finally { moreBusy.current = false; setLoadingMore(false); }
      }, [q, cat, onlyFav]);
      const stateRef = React.useRef(state);
      stateRef.current = state;
      const moreBusy = React.useRef(false);

      React.useEffect(() => { ensureCss(); }, []);
      React.useEffect(() => {
        if (booted.current) { load(); return; }
        booted.current = true;
        call('settings').then((s) => {
          const mode = OPEN_MODES.includes(s.openMode) ? s.openMode : 'wall';
          setOpenMode(mode);
          if (mode === 'random') return load({ random: true });
          if (mode === 'fav') { setOnlyFav(true); return load({ favFirst: true }); }
          return load();
        }).catch(() => load());
      }, [load]);

      React.useEffect(() => { call('categories').then((v) => setCats(v.categories || [])).catch(() => {}); }, []);

      const toggleFav = async (item) => {
        const r = await call('fav', { code: item.code });
        // Patch in place. Never reload the list here: a reload resets paging
        // to page 1 and the wall jumps to the top. In favorites-only view an
        // unfavorited card stays put (star off) until the view is re-entered.
        setState((s) => ({ ...s, items: s.items.map((it) => it.code === item.code ? { ...it, fav: r.fav } : it) }));
      };

      const patchFav = React.useCallback((code, fav) => {
        setState((s) => ({ ...s, items: s.items.map((it) => it.code === code ? { ...it, fav } : it) }));
      }, []);

      // Scroll memory per view: toggling favorites-only must not teleport the
      // wall. Leaving a view stores its scrollTop; entering restores its own,
      // but only once the target view is actually loaded (viewKey match).
      const toggleOnlyFav = () => {
        const el = rootRef.current;
        scrollMem.current[onlyFav ? 'fav' : 'all'] = el ? el.scrollTop : 0;
        restoreTo.current = { viewKey: !onlyFav, pos: scrollMem.current[onlyFav ? 'all' : 'fav'] || 0 };
        setOnlyFav((v) => !v);
      };

      React.useEffect(() => {
        const r = restoreTo.current;
        if (!r || state.status !== 'ready' || state.viewKey !== r.viewKey) return;
        restoreTo.current = null;
        const el = rootRef.current;
        if (!el) return;
        if (r.pos <= 0) { el.scrollTop = 0; return; }
        (async () => {
          let guard = 0;
          while (guard < 12) {
            const cur = stateRef.current;
            if (cur.status !== 'ready' || cur.viewKey !== r.viewKey) break;
            if (cur.items.length >= cur.total || el.scrollHeight >= r.pos + el.clientHeight + 40) break;
            await loadMore();
            await new Promise((res) => setTimeout(res, 60));
            guard++;
          }
          el.scrollTop = r.pos;
        })();
      }, [state.status, state.items.length, state.viewKey, loadMore]);

      const setMode = async (mode) => {
        try { const s = await call('settings', { openMode: mode }); setOpenMode(s.openMode); } catch { /* keep local */ }
        setShowSettings(false);
      };

      const inspire = () => { setView('wall'); setQ(''); setCat(''); setOnlyFav(false); load({ random: true }); };

      const onScroll = (e) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) loadMore();
      };

      return h('div', { className: 'pw-root', onScroll, ref: rootRef },
        h('div', { className: 'pw-bar' },
          h('input', { className: 'pw-input', placeholder: t('search.placeholder'), value: q,
            onChange: (e) => setQ(e.target.value) }),
          h('select', { className: 'pw-select', value: cat, onChange: (e) => setCat(e.target.value) },
            h('option', { value: '' }, t('filter.all')),
            cats.map((c) => h('option', { key: c.name, value: c.name }, `${c.name} (${c.count})`))),
          h('button', { className: 'pw-btn', 'aria-pressed': onlyFav ? 'true' : 'false',
            onClick: toggleOnlyFav }, t('filter.fav')),
          h('div', { className: 'pw-bar-right' },
            h('button', { className: 'pw-btn', onClick: inspire }, '✦ ' + t('inspire')),
            h('button', { className: 'pw-btn', 'aria-pressed': showSettings ? 'true' : 'false',
              onClick: () => setShowSettings((v) => !v) }, t('settings')),
            h('span', { className: 'pw-count' }, state.random ? t('inspire.badge')
              : state.status === 'error' ? ''
              : t('count.n').replace('{n}', state.total) + (state.items.length < state.total ? ` · ${state.items.length}/${state.total}` : '')),
            h('button', { className: 'pw-btn', 'aria-pressed': view === 'help' ? 'true' : 'false',
              onClick: () => setView((v) => (v === 'help' ? 'wall' : 'help')) }, '? ' + t('help'))),
          showSettings && h('div', { className: 'pw-pop' },
            h('div', { className: 'pw-label' }, t('settings.openMode')),
            [['wall', 'settings.wall'], ['random', 'settings.random'], ['fav', 'settings.fav']]
              .map(([m, k]) => h('button', { key: m, className: 'pw-btn', 'aria-pressed': openMode === m ? 'true' : 'false',
                onClick: () => setMode(m) }, t(k))))),
        view === 'help'
          ? h(Help, { onBack: () => setView('wall') })
          : state.status === 'error'
            ? h('div', { className: 'pw-empty' }, t('error.load'), ' ', h('button', { className: 'pw-btn', onClick: load }, t('retry')))
            : h('div', { className: 'pw-grid' },
                state.status === 'loading' ? h('div', { className: 'pw-empty' }, '…')
                  : state.items.length === 0 ? h('div', { className: 'pw-empty' }, '—')
                  : state.items.map((it) => h(Card, { key: it.code, item: it, onOpen: setOpen, onFav: toggleFav }))),
        view === 'wall' && state.status === 'ready' && !state.random && state.items.length < state.total
          ? h('div', { className: 'pw-count', style: { textAlign: 'center', padding: '0 0 16px' } }, loadingMore ? t('more.loading') : '')
          : null,
        open && h(Detail, { code: open, onClose: () => setOpen(null), onChanged: patchFav }));
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-prompt-wall: dictionaries');
        const t = ctx.locale.bind(NS);
        const entry = 'prompt-wall';
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: entry, locale: ctx.locale,
        }, () => h(LocaleContext.Provider, { value: t }, h(Panel))), 'dsh-prompt-wall: main panel'),
          'dsh-prompt-wall: main panel seat');
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: entry, order: 16,
          label: () => t('panel.title'), locale: ctx.locale,
        }, Icon), 'dsh-prompt-wall: sidebar row'),
          'dsh-prompt-wall: sidebar seat');
      },
    };
  },
});
