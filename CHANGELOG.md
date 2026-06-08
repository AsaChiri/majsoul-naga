# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses the
userscript `@version` as its version.

## [1.0.0]

Initial release.

- Userscript that, on pressing `s` in a MahjongSoul 4-player replay, captures the
  game, converts it to tenhou.net/6, and submits it to NAGA's custom analysis
  using your existing NAGA browser session.
- Self-contained: hooks `window.WebSocket`, decodes the MahjongSoul protobuf with
  a tiny generic wire-decoder, and converts in-browser (converter validated
  round-for-round against tensoul-py).
- Decodes real player names and final scores; sends the required `game_type`
  (East/South) and a configurable `player_types` (NAGA model) selection.
- Single, consistent `[majsoul-naga]` console log prefix.
- Node golden test (`npm test`) guards the converter against regressions;
  ESLint + Prettier configured; CI on Node 22.
