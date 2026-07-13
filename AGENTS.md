# AGENTS.md

Guidance for AI coding agents working in this repo.

## What this is

A **VS Code color theme extension** (MakeSenseTSX Theme — dark). There is no application code, no build step, no tests, no lint, no CI, and no npm dependencies. `package.json` is the VS Code extension manifest, **not** an npm package — don't run `npm install` / `npm test` / `npm run <script>`; there is nothing to install or run.

## The only file that affects the theme

`themes/MakeSenseTSX Theme-color-theme.json` — a VS Code color theme (`$schema: vscode://schemas/color-theme`, `type: dark`) with two sections:
- `colors` — workbench/UI color keys (`editor.background`, `activityBar.*`, ...).
- `tokenColors` — TextMate scope rules (`scope` + `settings`).

`package.json` → `contributes.themes` points here (`uiTheme: vs-dark`).

## Don't edit the root reference files

`Developers Theme dark.json`, `PerfectTSX Theme-v1.jsonc`, and `PerfectTSX Theme-v1.1.jsonc` in the repo root are **inspiration/source themes**, not the active theme and not referenced by the manifest. Editing them has no effect on the extension.

## Dev / preview workflow

- Press **F5** in VS Code to open the Extension Development Host (`.vscode/launch.json`). Theme edits hot-reload in that window.
- To find a token's scope, run `Developer: Inspect Editor Tokens and Scopes` (Ctrl+Shift+P) in the dev host; it reports the TextMate scope to target in `tokenColors`.

## Packaging

- `vsce package` → `.vsix` (gitignored). `vsce publish` to publish.
- `.vscodeignore` excludes `.vscode/**`, `.vscode-test/**`, `.gitignore`, `vsc-extension-quickstart.md` — but **not** the root reference `.json`/`.jsonc` files, so they currently ship in (and bloat) the VSIX. Add them to `.vscodeignore` if packaging lean.

## Zed editor integration

A Zed theme extension lives in `zed/` — independently packageable from the VS Code extension.

### Structure
- `zed/extension.toml` — Zed extension manifest (`id`, `name`, `version`, `schema_version`).
- `zed/themes/makesensetsx.json` — Theme Family JSON (dark + light in one file), conforming to `https://zed.dev/schema/themes/v0.2.0.json`.
- `tools/convert-vscode-to-zed.mjs` — Zero-dependency Node.js ES module that reads both VS Code theme JSONC files and outputs the Zed Theme Family JSON. Re-run when the VS Code themes change:
  ```bash
  node tools/convert-vscode-to-zed.mjs
  ```

### Zed vs VS Code differences
- Zed uses **Tree-sitter grammars, not TextMate scopes**. The conversion script maps TextMate scope prefixes to Zed's `syntax.*` keys (e.g., `comment.*` → `comment`, `entity.name.function.*` → `function`).
- VS Code `colors` map to Zed `style.*` keys. Many VS Code keys have no Zed equivalent and are skipped.
- Terminal ANSI colors: VS Code uses camelCase (`terminal.ansiBrightBlack`), Zed uses snake_case (`terminal.ansi.bright_black`). The light theme had no ANSI colors in VS Code — they were added manually during refinement.
- The script-generated output is a **draft**. A manual refinement pass added terminal ANSI colors for the light theme and filled missing Zed style keys (`accents`, `players`, `drop_target.background`, etc.). Re-running the script will **overwrite** manual refinements — re-apply them after re-running.

### Dev / preview workflow
- Copy `zed/themes/makesensetsx.json` to `~/.config/zed/themes/` for local testing (auto-detected on next Zed load).
- For extension packaging: `cd zed && zextension package` (or follow Zed's extension publishing docs).

### Docs
- https://zed.dev/docs/extensions/themes · https://zed.dev/docs/themes
