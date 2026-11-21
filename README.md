# dsh-prompt-wall

[![License](https://img.shields.io/badge/license-see%20LICENSE-blue.svg)](LICENSE)
![Templates](https://img.shields.io/badge/templates-1077-blue.svg)

A prompt-wall plugin for DeepSeek Harness (DSH):
1077 image-generation prompt templates with preview thumbnails, browsable as a
card wall in the sidebar, searchable, favoritable, and wired to agent tools
that adapt each prompt to your target image model.

Browse the wall in the panel; generate images through the chat. The panel is a
picker — copy a template code (click it), paste it into the conversation and
say "make an image with this", and the agent fetches the prompt, adapts it to
the right model format, and runs your image pipeline.

## What you get

- **Card wall** — masonry waterfall layout, native image ratios (no cropping),
  sticky top bar that stays reachable while you scroll all 1077 entries.
- **Search & filter** — keyword search across code/title/tags/category,
  category dropdown, favorites-only toggle.
- **Favorites** — star anything; stored locally, never leaves the machine.
- **Inspire** — one click draws 24 random templates; click again for a new
  batch.
- **Open mode setting** — choose what the wall shows when you open it:
  everything, a random batch, or favorites first.
- **Help page** — three-step onboarding for first-time users.
- **Agent tools** — `prompt_wall` (search/get/categories/favorites) and
  `prompt_wall_adapt` (normalize a template for a target model).

## Prompt adaptation

Templates come in three shapes: plain text, `{argument}` placeholders, and
structured JSON specs. Feeding a raw JSON spec to a text-rendering model
draws a wall of text, so `prompt_wall_adapt` normalizes per target:

| Target | Behavior |
|---|---|
| `qwen-image`, `h3-image`, generic | extracts the scene description from JSON specs, fills `{argument}` slots with defaults or your values |
| `gpt-image` | keeps structured JSON specs intact |

## Data

`data/entries.json` — 1077 entries compiled from nine public upstream
repositories. Each entry carries its source `lib`, category, tags, prompt
shape, and thumbnail. Thumbnails are downscaled previews of the upstream
example images.

**Licensing**: the plugin code is MIT (see `LICENSE`). The prompt data and
thumbnails are **not** MIT — they remain under their respective upstream
licenses (MIT / Apache-2.0 / CC BY 4.0 / CC0 / per-repo attribution). See
[`UPSTREAMS.md`](UPSTREAMS.md) and [`licenses/upstream/`](licenses/upstream/)
for the per-source terms and attribution notices. One upstream (lib2) claims
MIT but its LICENSE file 404s, so its entries are not distributed here.

## Install

Requires DSH ≥ 0.2.0. Link a checkout into your profile:

```
git clone https://github.com/aiohow/dsh-prompt-wall.git
ln -s "$(pwd)/dsh-prompt-wall" ~/.dsh/profiles/<profile>/plugins/dsh-prompt-wall
```

Restart DSH (or reload the profile) to load the plugin.

## Development

```
node smoke-host.mjs     # host: routes, tools, adaptation, paging, settings
node smoke-client.mjs   # client: fake-React render, wall, favorites, help
```

Both print `*_SMOKE_OK` on success. User data (favorites, settings) lives in
`~/.dsh/prompt-wall/` and is never committed.

## Disclaimer

The templates are community-collected prompts; their quality and suitability
for your model are your call. This plugin makes no warranty about generation
results. Preview thumbnails are resized from upstream example outputs and do
not guarantee what your generation will look like.

An independent community project, not affiliated with or endorsed by OpenAI,
Google, or any model vendor. GPT, ChatGPT, Nano Banana and other names are
trademarks of their respective owners.

## License

Plugin code is MIT-licensed; template data and thumbnails stay under their
upstream licenses as described above. Read `LICENSE` and `UPSTREAMS.md` before
redistributing anything from this repository.
