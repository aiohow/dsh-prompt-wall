# 生图模板选片墙 dsh-prompt-wall

把 1126 条带例图的生图提示词模板装进 DSH：侧栏卡片墙 + agent 工具 + 按目标模型适配提示词。

## 它解决什么

- 提示词散在仓库网页里，出图前要开浏览器翻；现在侧栏直接搜、直接收藏。
- 上游模板有四种形态：纯文本（888）、`{argument}` 参数槽（158）、JSON 结构化规格（90）、无提示词（40）。JSON 规格整坨喂给文本渲染型模型（Qwen-Image 等）会被画成满屏 JSON 文字墙——这是真实踩过的坑。
- 适配层按目标分流：`qwen-image` / `h3-image` / `generic` 从 JSON 里提取真实画面描述并填参数槽默认值；`gpt-image` 保留结构化 JSON 原样（它能吃结构化规格）。

## 组成

- **Host**：`prompt_wall`（search/get/categories）与 `prompt_wall_adapt`（code + target + params → 适配后提示词）两个 agent 工具；`/api/prompt-wall/*` 鉴权路由供面板调用；缩略图由 host 从包内 `data/thumb/` 读出。
- **Client**：侧栏一行 + 主面板卡片墙（搜索、分类下拉、收藏筛选、点开详情看原提示词 + 四目标适配 + 复制）。
- **数据**：`data/entries.json`（2M）+ `data/thumb/`（55M）随包分发；收藏存 `~/.dsh/prompt-wall/favs.json`，原子写。

## 配置（cordis.patch.yml 的 prompt-wall 行 config）

- `data_dir` — 数据目录（默认包内 data/；可指向仓库以省去重装后丢图）
- `favs_file` — 收藏文件路径（默认 `~/.dsh/prompt-wall/favs.json`）

## 零出网

全部数据本机读写，无任何外部请求。
