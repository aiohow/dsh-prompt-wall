# Contributing

Thanks for your interest in improving dsh-prompt-wall!

## Before you start

- **Open an issue before a pull request** for anything beyond a typo or an
  obvious bug. Data decisions here (which upstreams are included, how
  entries are censored and categorized, which licenses are distributable)
  have reasons behind them — see `UPSTREAMS.md` — and we would rather agree
  on the approach first.
- One PR does one thing. Code and its documentation change together.

## Ground rules specific to this project

- **No machine paths, no personal data, no secrets** in code, comments,
  commit messages or docs.
- **Zero runtime egress.** The plugin reads bundled data and a local user
  store; it makes no network requests. Changes that add network access will
  not merge unless there is no local alternative, and then only behind an
  explicit user-facing setting.
- **Licensing is per-entry.** Any change to `data/entries.json` must keep
  each entry's upstream attribution valid. Do not add entries from upstreams
  without a retrievable license file. Thumbnails are downscaled upstream
  example images and inherit the same terms.
- **User-visible strings are bilingual.** They live in `locale/en.json` and
  `locale/zh.json`; the README carries both languages in one file
  (Chinese first, English second). Change both halves in the same PR.

## Workflow

```sh
node smoke-host.mjs     # host: routes, tools, adaptation, paging, settings
node smoke-client.mjs   # client: fake-React render, wall, favorites, help
```

Both must print `*_SMOKE_OK`.

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`), one
  sentence, imperative.
- Version bumps happen in `package.json` and must come with a `CHANGELOG.md`
  entry.

## Reporting issues

For rendering problems, include your DSH version and whether you are on the
desktop or web entry. For data problems (a miscategorized or mislabeled
entry, a licensing concern), include the template code shown on the card —
that is the fastest way to trace an entry back to its upstream.
