/**
 * dsh-prompt-wall — image-prompt template wall, host half.
 *
 * Ships the curated 1126-entry prompt gallery (data/entries.json + data/thumb/)
 * inside the bundle and exposes it two ways:
 *   - agent tools `prompt_wall` (search/get/categories) and
 *     `prompt_wall_adapt` (normalize + target-adapt one template's prompt);
 *   - authenticated /api/prompt-wall/* routes for the Client panel
 *     (query/get/adapt/fav/thumb), same connection.fetch seam as dsh-focus-bar.
 *
 * The adapter is the core value: upstream templates come in four shapes
 * (plain text / {argument} placeholders / JSON structured spec / empty).
 * Feeding a raw JSON spec to a text-rendering model produces a wall of
 * rendered JSON text, so per-target adaptation either extracts the real
 * scene description (qwen-image, h3-image, generic) or keeps the structured
 * spec (gpt-image, which consumes structured prompts natively).
 *
 * Favorites live in ~/.dsh/prompt-wall/favs.json (atomic .part+rename).
 * Zero network. Thumbnails are served from the bundle, never from the repo.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-prompt-wall";

const PKG_DIR = path.dirname(fileURLToPath(import.meta.url));
const TARGETS = ["qwen-image", "h3-image", "gpt-image", "generic"];

// ---------------------------------------------------------------------------
// Template normalization (shape detection, argument filling, JSON extraction)
// ---------------------------------------------------------------------------

const ARG_RE = /\{argument\s+name="([^"]+)"(?:\s+default="([^"]*)")?\s*\}/g;

function detectShape(prompt) {
  const p = (prompt || "").trim();
  if (!p) return "empty";
  if (p.startsWith("{") || p.startsWith("[")) {
    try { JSON.parse(p); return "json"; } catch { /* not strict JSON */ }
    if (/^\{[\s\S]*"\s*:/.test(p)) return "json"; // JSON-like spec
  }
  ARG_RE.lastIndex = 0;
  if (ARG_RE.test(p)) return "arguments";
  return "plain";
}

/** List {argument} slots in a prompt. */
function listArgs(prompt) {
  const out = [];
  ARG_RE.lastIndex = 0;
  let m;
  while ((m = ARG_RE.exec(prompt || ""))) out.push({ name: m[1], default: m[2] ?? "" });
  return out;
}

/** Replace {argument} slots with user values, falling back to defaults. */
function fillArgs(prompt, params) {
  const used = [];
  const filled = (prompt || "").replace(ARG_RE, (_all, name, def) => {
    const v = params && typeof params[name] === "string" && params[name] !== "" ? params[name] : (def ?? "");
    used.push({ name, value: v, from: params && params[name] ? "user" : "default" });
    return v;
  });
  return { text: filled, used };
}

const SCENE_RE = /photograph|render|poster|scene|image|portrait|illustration|photo|cinematic|style/i;

/** Walk parsed JSON collecting candidate scene strings (same logic proven in the CH-27 fix). */
function collectStrings(node, out) {
  if (typeof node === "string") { out.push(node); return; }
  if (Array.isArray(node)) { for (const v of node) collectStrings(v, out); return; }
  if (node && typeof node === "object") { for (const v of Object.values(node)) collectStrings(v, out); }
}

/**
 * Extract the real scene description from a JSON structured spec.
 * Long strings only, spec-noise excluded, scene-keyword hits preferred.
 */
function extractScene(raw) {
  let data = null;
  try { data = JSON.parse(raw); } catch { data = null; }
  let strings = [];
  if (data !== null) collectStrings(data, strings);
  else {
    const re = /"((?:[^"\\]|\\.){80,})"/g;
    let m;
    while ((m = re.exec(raw))) strings.push(m[1]);
  }
  strings = strings
    .map((s) => s.trim())
    .filter((s) => s.length >= 80)
    .filter((s) => !s.startsWith("{INSERT"))
    .filter((s) => (s.match(/\{/g) || []).length < 3);
  if (!strings.length) return { text: raw.trim(), extracted: false };
  const scored = strings.filter((s) => SCENE_RE.test(s));
  const pool = scored.length ? scored : strings;
  pool.sort((a, b) => b.length - a.length);
  return { text: pool[0], extracted: true };
}

/**
 * Adapt one template prompt for a target model.
 * @returns {{ok:boolean, target:string, shape:string, prompt:string, notes:string[], args:object[]}}
 */
function adaptPrompt(entry, target, params) {
  const shape = detectShape(entry.prompt);
  const notes = [];
  if (shape === "empty") {
    return { ok: false, target, shape, prompt: "", notes: ["上游模板没有提示词正文，只能参考缩略图与标题自行撰写"], args: [] };
  }
  const { text: filled, used } = fillArgs(entry.prompt, params);
  if (used.length) notes.push(`已填 ${used.length} 个参数（${used.map((u) => u.name + "=" + (u.from === "user" ? "用户值" : "默认值")).join("，")}）`);
  const stillJson = detectShape(filled) === "json";
  let out = filled;
  if (stillJson) {
    if (target === "gpt-image") {
      notes.push("gpt-image 可吃结构化 JSON 规格，原样保留");
    } else {
      const ex = extractScene(filled);
      out = ex.text;
      notes.push(ex.extracted
        ? "JSON 结构化规格已提取画面描述（直喂整坨 JSON 会被文本渲染型模型画成文字墙）"
        : "JSON 解析失败，已按最长字符串提取，建议人工复核");
    }
  } else {
    notes.push(target === "gpt-image" ? "纯文本提示词，gpt-image 直接使用" : "纯文本提示词，直通");
  }
  if (/\{INSERT/.test(out)) notes.push("含 {INSERT…} 手工占位，出图前需替换");
  return { ok: true, target, shape, prompt: out.trim(), notes, args: used };
}

// ---------------------------------------------------------------------------
// Data + favorites storage
// ---------------------------------------------------------------------------

function favsFile() {
  return path.join(homedir(), ".dsh", "prompt-wall", "favs.json");
}

async function loadFavs(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return new Set(Array.isArray(parsed.codes) ? parsed.codes : []);
  } catch (e) {
    if (e && e.code === "ENOENT") return new Set();
    throw new Error(`dsh-prompt-wall: cannot read favs ${file}: ${e.message}`);
  }
}

async function saveFavs(file, set) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.part`;
  await writeFile(tmp, JSON.stringify({ version: 1, codes: [...set] }, null, 1) + "\n", "utf8");
  await rename(tmp, file);
}

function thumbName(entry) {
  const b = String(entry.img || "").split("/").pop() || "";
  return b.replace(/\.(png|jpe?g)$/i, "");
}

function buildIndex(entries) {
  for (const e of entries) {
    e._shape = detectShape(e.prompt);
    e._hay = [e.code.toLowerCase(), (e.title || "").toLowerCase(), e.catcn || "", e.cat || "",
      ...(e.tags || [])].join(" ").toLowerCase();
    e._thumb = thumbName(e);
  }
}

function searchEntries(entries, favs, args) {
  const q = String(args.q || "").trim().toLowerCase();
  const cat = String(args.cat || "").trim();
  const onlyFav = args.fav === true;
  const limit = Math.max(1, Math.min(100, Number(args.limit) || 24));
  const offset = Math.max(0, Number(args.offset) || 0);
  let list = entries;
  if (cat) list = list.filter((e) => e.catcn === cat || e.cat === cat);
  if (onlyFav) list = list.filter((e) => favs.has(e.code));
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean);
    list = list
      .map((e) => {
        let score = 0;
        for (const t of terms) {
          if (e._hay.includes(t)) score += e.title.toLowerCase().includes(t) ? 2 : 1;
        }
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.e);
  }
  const total = list.length;
  const page = list.slice(offset, offset + limit).map((e) => ({
    code: e.code, title: e.title, catcn: e.catcn, cat: e.cat, tags: (e.tags || []).slice(0, 6),
    shape: e._shape, thumb: e._thumb, fav: favs.has(e.code), w: e.w, h: e.h,
  }));
  return { total, offset, limit, items: page };
}

function publicEntry(e, favs) {
  return {
    code: e.code, title: e.title, catcn: e.catcn, cat: e.cat, lib: e.lib,
    tags: e.tags || [], shape: e._shape, thumb: e._thumb, fav: favs.has(e.code),
    w: e.w, h: e.h,
    prompt: e.prompt || "", args: listArgs(e.prompt || ""),
  };
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const inject = ["tools", "systemPrompt"];

const PROMPT_TEXT = [
  "生图模板选片墙（prompt-wall）已装载：1126 条例图生图提示词模板，工具 prompt_wall 检索（search/get/categories），prompt_wall_adapt 按目标模型出适配提示词（qwen-image/h3-image 提取画面描述，gpt-image 保留结构化 JSON，generic 纯文本兜底）。",
  "用户要\"找个 XX 风格的模板/提示词\"时优先用 prompt_wall 检索而不是凭记忆编；出图前用 prompt_wall_adapt 拿干净提示词，JSON 规格模板严禁整坨直喂文本渲染型模型（会画成文字墙）。",
].join("\n");

export function apply(ctx, config) {
  const dataDir = typeof config?.data_dir === "string" && config.data_dir !== ""
    ? config.data_dir : path.join(PKG_DIR, "data");
  const favFile = typeof config?.favs_file === "string" && config.favs_file !== ""
    ? config.favs_file : favsFile();

  let entries = null;
  let entriesError = "";
  let favs = new Set();
  let favsLoaded = false;
  let chain = Promise.resolve();

  async function ensureData() {
    if (entries) return entries;
    if (entriesError) throw new Error(entriesError);
    try {
      entries = JSON.parse(await readFile(path.join(dataDir, "entries.json"), "utf8"));
      if (!Array.isArray(entries) || entries.length === 0) throw new Error("entries.json is empty");
      buildIndex(entries);
    } catch (e) {
      entriesError = `dsh-prompt-wall: cannot load entries.json from ${dataDir}: ${e.message}`;
      throw new Error(entriesError);
    }
    return entries;
  }

  async function ensureFavs() {
    if (favsLoaded) return favs;
    favs = await loadFavs(favFile);
    favsLoaded = true;
    return favs;
  }

  async function run(op, args) {
    const task = (async () => {
      const list = await ensureData();
      const f = await ensureFavs();
      switch (op) {
        case "search": return searchEntries(list, f, args ?? {});
        case "categories": {
          const counts = new Map();
          for (const e of list) counts.set(e.catcn || e.cat || "?", (counts.get(e.catcn || e.cat || "?") || 0) + 1);
          return { total: list.length, categories: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, count: n })) };
        }
        case "get": {
          const e = list.find((x) => x.code === args?.code);
          if (!e) throw new Error(`no such template: ${args?.code}`);
          return publicEntry(e, f);
        }
        case "adapt": {
          const e = list.find((x) => x.code === args?.code);
          if (!e) throw new Error(`no such template: ${args?.code}`);
          const target = TARGETS.includes(args?.target) ? args.target : "generic";
          return { code: e.code, title: e.title, ...adaptPrompt(e, target, args?.params) };
        }
        case "fav": {
          const code = String(args?.code || "");
          if (!list.some((x) => x.code === code)) throw new Error(`no such template: ${code}`);
          if (favs.has(code)) favs.delete(code); else favs.add(code);
          await new Promise((res, rej) => { chain = chain.then(async () => { try { await saveFavs(favFile, favs); res(); } catch (e) { rej(e); } }); });
          return { code, fav: favs.has(code), total: favs.size };
        }
        case "thumb": {
          let stem = String(args?.name || "").replace(/[^A-Za-z0-9\u4e00-\u9fff._-]/g, "");
          if (stem.endsWith(".thumb")) stem = stem.slice(0, -".thumb".length);
          for (const ext of ["jpg", "png"]) {
            const p = path.join(dataDir, "thumb", `${stem}.thumb.${ext}`);
            if (existsSync(p)) {
              const buf = await readFile(p);
              return { bytes: buf, type: ext === "jpg" ? "image/jpeg" : "image/png" };
            }
          }
          return { missing: true };
        }
        default: throw new Error(`unknown op: ${op}`);
      }
    })();
    return task;
  }

  const toolDefs = [
    {
      name: "prompt_wall",
      description:
        "Search the local image-prompt template wall (生图模板选片墙, 1126 curated templates with reference images). Actions: search (q keywords, cat category name, fav=true favorites only, limit/offset), get (code — returns full prompt + {argument} slots), categories (name + count list). Use before answering requests for image-generation prompts or style references.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", enum: ["search", "get", "categories"], description: "Which lookup." },
          q: { type: "string", description: "search: keywords, space-separated, matches code/title/category/tags." },
          cat: { type: "string", description: "search: category display name, e.g. 海报, 摄影质感." },
          fav: { type: "boolean", description: "search: favorites only." },
          limit: { type: "integer", description: "search: page size 1-100, default 24." },
          offset: { type: "integer", description: "search: skip count for paging." },
          code: { type: "string", description: "get: template code, e.g. B海报01." },
        },
        required: ["action"],
      },
      output: {
        schema: { type: "object" },
        render: (_a, v) => [{ type: "text", text: v && v.items ? formatSearch(v) : JSON.stringify(v, null, 1) }],
      },
      presentCall() { return { card: "generic", title: "模板墙：检索", kind: "other" }; },
      async execute(args) { return run(args?.action === "get" ? "get" : args?.action === "categories" ? "categories" : "search", args); },
    },
    {
      name: "prompt_wall_adapt",
      description:
        "Normalize one template-wall prompt for a target image model. Targets: qwen-image / h3-image / generic extract the scene description from JSON structured specs and fill {argument} slots (defaults or your params); gpt-image keeps structured JSON specs intact. Always call this before feeding a wall template to an image model — raw JSON specs render as walls of text on text-rendering models. Empty-prompt templates return ok:false with guidance.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", description: "Template code, e.g. B海报01." },
          target: { type: "string", enum: TARGETS, description: "Target model family, default generic." },
          params: { type: "object", description: "Values for {argument} slots keyed by slot name; omitted slots use template defaults." },
        },
        required: ["code"],
      },
      output: {
        schema: { type: "object" },
        render: (_a, v) => [{ type: "text", text: formatAdapt(v) }],
      },
      presentCall() { return { card: "generic", title: "模板墙：适配提示词", kind: "other" }; },
      async execute(args) { return run("adapt", args); },
    },
  ];

  for (const def of toolDefs) {
    ctx.effect(() => ctx.tools.register(def), `dsh-prompt-wall: tool ${def.name}`);
  }

  ctx.effect(
    () => ctx.systemPrompt.section({ name: "prompt-wall:guide", order: 61, text: PROMPT_TEXT }),
    "dsh-prompt-wall: resident prompt section",
  );

  // Client routes on the authenticated connection.fetch seam.
  ctx.inject(["connection"], (scope) => {
    const connection = scope.get("connection");
    const register = connection?.fetch?.register;
    if (typeof register !== "function") {
      ctx.log?.("dsh-prompt-wall: connection.fetch.register unavailable, client routes skipped");
      return;
    }
    for (const op of ["search", "categories", "get", "adapt", "fav"]) {
      scope.effect(
        () => register({
          path: `/api/prompt-wall/${op}`,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: async (request) => {
            let args = {};
            try { args = await request.json(); if (!args || typeof args !== "object") args = {}; } catch { args = {}; }
            try {
              const value = await run(op, args);
              return Response.json({ ok: true, value }, { headers: { "cache-control": "no-store" } });
            } catch (error) {
              return Response.json(
                { ok: false, error: { code: "prompt-wall", message: error instanceof Error ? error.message : String(error) } },
                { headers: { "cache-control": "no-store" } },
              );
            }
          },
        }),
        `dsh-prompt-wall: route /api/prompt-wall/${op}`,
      );
    }
    // Thumbnail bytes, GET with ?name=<stem>.
    scope.effect(
      () => register({
        path: "/api/prompt-wall/thumb",
        methods: ["GET"],
        // Must be explicit: the host bridge treats a missing requestBody as
        // streaming and hands GET a body stream, which throws
        // "Request with GET/HEAD method cannot have body" → empty 400.
        requestBody: "buffered",
        fetch: async (request) => {
          const name = new URL(request.url).searchParams.get("name") || "";
          try {
            const r = await run("thumb", { name });
            if (r.missing) return new Response("not found", { status: 404 });
            return new Response(r.bytes, {
              headers: { "content-type": r.type, "cache-control": "public, max-age=86400" },
            });
          } catch {
            return new Response("bad request", { status: 400 });
          }
        },
      }),
      "dsh-prompt-wall: route /api/prompt-wall/thumb",
    );
  });
}

function formatSearch(v) {
  const lines = [`模板墙：命中 ${v.total} 例（第 ${v.offset + 1}–${v.offset + v.items.length} 条）`];
  for (const it of v.items) {
    lines.push(`- ${it.code} · ${it.title} [${it.catcn}] ${it.shape}${it.fav ? " ★" : ""}`);
  }
  return lines.join("\n");
}

function formatAdapt(v) {
  const head = `${v.code} · ${v.title} → ${v.target}（形态 ${v.shape}）${v.ok ? "" : " 【不可出图】"}`;
  const notes = v.notes.map((n) => `· ${n}`).join("\n");
  return `${head}\n${notes}\n---\n${v.prompt}`;
}
