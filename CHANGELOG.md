# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-21

Initial release.

### Added

- Prompt wall in the DSH sidebar: 1077 community image-generation prompt
  templates with example thumbnails, masonry layout at native aspect ratios,
  sticky search/filter bar, category dropdown, favorites, inspire mode
  (24 random draws), and a per-open default view setting.
- Template detail: two-column layout on wide screens, click-to-zoom lightbox
  scaled to the viewport, click-any-code-to-copy.
- `prompt_wall` agent tool: search / get / categories / favorites over the
  bundled data. No network at runtime.
- `prompt_wall_adapt` agent tool: normalizes a template for a target model
  (`qwen-image`, `h3-image`, `gpt-image`, generic). JSON structured specs are
  extracted into a scene description for text-rendering models and kept
  intact for `gpt-image`; `{argument}` slots take defaults or user values.
- In-panel help page (pick → generate → adapt → copy → favorite → share)
  and a compliance footer listing per-source licensing.
- Data: `data/entries.json` (1077 entries, nine upstream repos) plus local
  thumbnails under `data/thumb/`; per-source license texts under
  `licenses/upstream/` with `UPSTREAMS.md` as the index. Entries from one
  upstream whose LICENSE file 404s are not distributed.
- Smoke tests: `smoke-host.mjs` (routes, tools, adaptation, paging,
  settings) and `smoke-client.mjs` (fake-React render, wall, favorites,
  help).
