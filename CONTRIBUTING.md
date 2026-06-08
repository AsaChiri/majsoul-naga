# Contributing

Thanks for your interest in improving majsoul-naga! It's a single userscript
(`majsoul-naga.user.js`) plus a Node golden test.

## Setup

```bash
npm install
npm run check   # lint + format check + test
```

Individual scripts:

- `npm test` — run the converter golden test (needs Node)
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` / `npm run format:check` — Prettier

## How it's structured

`majsoul-naga.user.js` is one IIFE with clearly separated sections:

1. **protobuf wire decoder** — a tiny generic decoder; messages are read by field
   number (no bundled schema).
2. **converter** — tiles, melds, the per-round state machine, scoring (pao,
   multi-ron, yaku), and the tenhou.net/6 assembly. This is a port of the
   converter validated against [`tensoul-py`](https://github.com/ssttkkl/tensoul-py).
3. **NAGA submit** — builds the custom-analysis request from your NAGA session.
4. **capture** — hooks `window.WebSocket` to grab the `fetchGameRecord` response.

## Testing the converter

`test/run.cjs` loads the userscript's pure converter in Node and asserts its
tenhou `log` matches a frozen fixture (`test/fixtures/`). The fixture was produced
by a pipeline checked round-for-round against tensoul-py and exercises
chi/pon/ankan/kakan, riichi, a dealer ron with yaku, a tsumo with honba, and an
exhaustive draw with negative deltas.

If you change the converter, run `npm test`. If a change intentionally alters
output, regenerate the expected fixture and explain why in the PR.

## Common changes

- **MahjongSoul protobuf field numbers** drift very rarely; they're inline in the
  decoder sections, named after their message.
- **NAGA endpoint / form fields / model ids** → the NAGA section near the top of
  the script (`PLAYER_TYPES`) and `submitToNaga`.

## Pull requests

- Keep `npm run check` green.
- Bump `@version` in the userscript header (and `version` in `package.json`) for
  user-visible changes, and add a `CHANGELOG.md` entry.
- Describe how you verified the change (golden test, and ideally a real replay).

## Scope & ethics

This tool reads only the replay you open and submits it to NAGA with your own
session. Please keep it to 4-player analysis for personal use; don't add anything
that automates logins or circumvents service protections.
