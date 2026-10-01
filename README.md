# majsoul-naga

[![CI](https://github.com/AsaChiri/majsoul-naga/actions/workflows/ci.yml/badge.svg)](https://github.com/AsaChiri/majsoul-naga/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A **userscript** that sends the **MahjongSoul** 4-player game you're watching to
**NAGA** (https://naga.dmv.nico/) for AI analysis — entirely in your browser.

Open a replay, press **`s`**, done.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. **[Install the userscript](https://raw.githubusercontent.com/AsaChiri/majsoul-naga/main/majsoul-naga.user.js)**
   (Tampermonkey opens an install page; it auto-updates from the repo afterwards).
3. Stay logged in to **NAGA** (https://naga.dmv.nico/) in the same browser.

## Use

1. In MahjongSoul, open a **4-player replay**.
2. Press **`s`**.

The shortcut ignores editable fields and Ctrl/Alt/Meta combinations. Only one
submission can run at a time. After success, that replay is remembered until the
page reloads; reload the page to deliberately submit it again. Failed attempts
can be retried with `s`.

The script captures the game, converts it, splits it into rounds, and POSTs it to
NAGA's custom analysis. A toast shows progress; the finished report shows up in
your NAGA reports. The first time, Tampermonkey will ask to allow a connection to
`naga.dmv.nico` — allow it.

### Choosing the AI model

Edit `PLAYER_TYPES` near the top of the script. Model ids:
`0=オメガ 1=ガンマ 2=ニシキ 3=ヒバカリ 4=カガシ` (comma-join for multi-select; default `2`).
Custom analysis costs ≈ `10 NP × rounds` per model.

## How it works

1. Hooks `window.WebSocket` at page load and grabs the raw `fetchGameRecord`
   response frame when you open a replay.
2. Decodes the MahjongSoul protobuf with a tiny generic wire-decoder keyed by
   field numbers — no exposed globals, no bundled schema.
3. Converts MahjongSoul → tenhou.net/6 (tiles, melds, riichi, pao/sekinin-barai,
   multi-ron, yaku names, scoring).
4. Submits via `GM_xmlhttpRequest` with your NAGA `csrftoken` + session cookie.

The whole thing is one self-contained file: `majsoul-naga.user.js`.

## Development / tests

```bash
npm install
npm run check   # lint + format check + test
```

Individual scripts: `npm test`, `npm run lint`, `npm run format`. See
[CONTRIBUTING.md](CONTRIBUTING.md).

The test loads the userscript's pure converter and runs it on a real serialized
record fixture (`test/fixtures/`), asserting the tenhou `log` matches the frozen
expected output. The fixture exercises chi/pon/ankan/kakan,
riichi, a dealer ron with yaku, a tsumo with honba, and an exhaustive draw with
negative score deltas.

Offline userscript tests also exercise keyboard handling, replay capture, and
submission/retry state with mocked browser and Tampermonkey APIs. They never
contact NAGA or require credentials.

## Credits

- [honvl/Majsoul-to-NAGA](https://github.com/honvl/Majsoul-to-NAGA) — the original
  press-`s`-to-NAGA userscript (broken by MahjongSoul removing its globals).
- [ssttkkl/tensoul-py](https://github.com/ssttkkl/tensoul-py) &
  [Equim-chan/tensoul](https://github.com/Equim-chan/tensoul) — MahjongSoul →
  tenhou.net/6 conversion, the basis for this script's converter and its test oracle.
- [Diving-Fish/auto-naga](https://github.com/Diving-Fish/auto-naga) — NAGA API.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Keep
`npm run check` green.

## License

[MIT](LICENSE) © AsaChiri
