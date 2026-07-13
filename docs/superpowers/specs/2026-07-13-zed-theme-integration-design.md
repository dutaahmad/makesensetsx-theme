# Zed Theme Integration — Design Spec

**Date:** 2026-07-13
**Branch:** `dev/zed-integration` (from `main`, merged `origin/dev/light-theme`)
**Status:** Approved

## Goal

Create a Zed editor theme extension derived from the two VS Code theme variants (MakeSenseTSX dark + LightSenseTSX light) using a hybrid approach: a script generates a draft conversion, then a manual refinement pass handles edge cases and visual verification.

## Source Themes

| Variant | File | Type | Lines | tokenColors |
|---------|------|------|-------|-------------|
| MakeSenseTSX (dark) | `themes/MakeSenseTSX Theme-color-theme.json` | `vs-dark` | 2084 | 237 |
| LightSenseTSX (light) | `themes/LightSenseTSX Theme-color-theme.json` | `vs` | 1996 | 237 |

Both use the VS Code color theme schema (`$schema: vscode://schemas/color-theme`) with `colors` (workbench/UI keys) and `tokenColors` (TextMate scope rules).

## Target: Zed Theme Schema (v0.2.0)

A Zed theme is a **Theme Family** JSON (`https://zed.dev/schema/themes/v0.2.0.json`):

```json
{
  "name": "...",
  "author": "...",
  "themes": [
    {
      "name": "...",
      "appearance": "dark" | "light",
      "style": {
        "background": "#...",
        "text": "#...",
        "editor.background": "#...",
        "syntax": { "comment": { "color": "#..." }, ... },
        "terminal.ansi": { "black": "#...", ... },
        ...
      }
    }
  ]
}
```

Key differences from VS Code:
- Zed uses **Tree-sitter grammars**, not TextMate scopes. Syntax highlighting is driven by ~30-40 generic `syntax.*` keys, not per-language scope rules.
- VS Code `colors` (workbench UI) map to Zed `style.*` keys — many have direct equivalents, many don't.
- Zed has no TextMate `scope` + `settings` structure; instead, `syntax` is a flat object of `{ key: { "color": "#...", "font_style": "...", "font_weight": N } }`.

## File Layout

```
makesensetsx-theme/
├── zed/
│   ├── extension.toml              # Zed extension manifest
│   └── themes/
│       └── makesensetsx.json       # Theme Family JSON (dark + light)
├── tools/
│   └── convert-vscode-to-zed.mjs   # Dev-only conversion script (zero deps)
└── (existing files unchanged)
```

- `zed/` is a self-contained Zed extension directory — independently packageable.
- `tools/` holds the dev script; not part of either extension.
- Both excluded from the VS Code VSIX via `.vscodeignore`.

## Approach: Hybrid (Script + Manual Refinement)

### Phase 1: Script-Generated Draft

A zero-dependency Node.js ES module (`tools/convert-vscode-to-zed.mjs`) reads both VS Code theme JSONs, applies explicit mapping tables, and outputs the Zed Theme Family JSON.

### Phase 2: Manual Refinement

Visual review in Zed, edge-case fixes, terminal ANSI colors, and missing style keys.

## Mapping Table: TextMate Scope → Zed `syntax` Key

The script extracts the first scope from each `tokenColors[].scope` entry (comma-separated), matches the longest prefix, and maps to a Zed `syntax.*` key.

| TextMate scope prefix | Zed `syntax` key |
|---|---|
| `comment.documentation.*` | `comment.doc` |
| `comment.*` | `comment` |
| `string.regexp.*` | `string.special` |
| `string.*` | `string` |
| `keyword.control.*` | `keyword.control` |
| `keyword.operator.*` | `keyword.operator` |
| `keyword.*` | `keyword` |
| `variable.parameter.*` | `variable.parameter` |
| `variable.language.*` | `variable.builtin` |
| `variable.builtin.*` | `variable.builtin` |
| `variable.*` | `variable` |
| `entity.name.function.*` | `function` |
| `support.function.*` | `function` |
| `entity.name.type.builtin.*` | `type.builtin` |
| `support.type.builtin.*` | `type.builtin` |
| `entity.name.type.*` | `type` |
| `support.type.*` | `type` |
| `storage.type.*` | `type` |
| `storage.modifier.*` | `keyword` |
| `constant.numeric.*` | `number` |
| `constant.language.*` | `constant.builtin` |
| `constant.builtin.*` | `constant.builtin` |
| `constant.*` | `constant` |
| `entity.name.tag.*` | `tag` |
| `entity.other.attribute-name.*` | `attribute` |
| `punctuation.section.*` | `punctuation.bracket` |
| `punctuation.*` | `punctuation.delimiter` |
| `support.constant.*` | `constant` |
| `entity.name.section.*` | `variable` |

**Conflict resolution:** When multiple tokenColors entries map to the same Zed syntax key, the entry with the longer/more-specific TextMate scope wins. If equal specificity, last entry in file wins (matching VS Code's cascade behavior).

## Mapping Table: VS Code `colors` → Zed `style` Key

| VS Code color key | Zed `style` key |
|---|---|
| `editor.background` | `editor.background` + `background` |
| `editor.foreground` | `editor.foreground` + `text` |
| `editor.lineHighlightBackground` | `editor.active_line.background` |
| `editorLineNumber.foreground` | `editor.line_number` |
| `editorLineNumber.activeForeground` | `editor.active_line_number` |
| `editorWhitespace.foreground` | `editor.invisible` |
| `editorIndentGuide.background1` | `editor.indent_guide` |
| `editorIndentGuide.activeBackground1` | `editor.indent_guide_active` |
| `editor.selectionHighlightBackground` | `editor.document_highlight.read_background` |
| `activityBar.background` | `toolbar.background` |
| `activityBar.inactiveForeground` | `text.muted` |
| `activityBar.activeBorder` | `toolbar.background` (accent approx) |
| `statusBar.background` | `status_bar.background` |
| `editorGroupHeader.tabsBackground` | `tab_bar.background` |
| `tab.activeBackground` | `tab.active_background` |
| `tab.inactiveBackground` | `tab.inactive_background` |
| `focusBorder` | `border.focused` |
| `editorGroup.border` | `border.variant` |
| `activityBar.border` | `border` |
| `errorForeground` | `error` |
| `foreground` | `text` |
| `descriptionForeground` | `text.muted` |
| `button.background` | `element.background` |
| `button.hoverBackground` | `element.hover` |
| `input.background` | `element.background` |
| `input.foreground` | `text` |
| `input.placeholderForeground` | `text.placeholder` |
| `input.border` | `border` |
| `list.hoverBackground` | `ghost_element.hover` |
| `list.activeSelectionBackground` | `element.selected` |
| `list.activeSelectionForeground` | `text` |
| `dropdown.background` | `elevated_surface.background` |
| `sideBar.background` | `panel.background` |
| `sideBar.foreground` | `text.muted` |
| `gitDecoration.modifiedResourceForeground` | `modified` |
| `gitDecoration.deletedResourceForeground` | `deleted` |
| `gitDecoration.addedResourceForeground` | `created` |
| `gitDecoration.ignoredResourceForeground` | `ignored` |
| `gitDecoration.conflictingResourceForeground` | `conflict` |
| `editorGutter.addedBackground` | `created` |
| `editorGutter.deletedBackground` | `deleted` |
| `editorGutter.modifiedBackground` | `modified` |

**Unmapped VS Code keys** (no Zed equivalent): `debugConsole.*`, `debugIcon.*`, `debugTokenExpression.*`, `debugToolBar.*`, `minimapSlider.*`, `notificationCenterHeader.*`, `notifications.*`, `breadcrumb.*`, `editorOverviewRuler.*`, `editorWidget.*`, `editor.findMatch*`, `editor.fold*`, `editor.wordHighlight*`, `editor.linkedEditing*`, `editor.stackFrame*`, `editor.focusedStackFrame*`, `editorBracketHighlight.*`, `editorBracketMatch.*`, `editorSuggestWidget.*`, `editorInlayHint.*`, `keybindingLabel.*`, `panel.*` (VS Code panel ≠ Zed panel), `peekView*`, `progressBar.*`, `scrollbarSlider.*`, `settings.*`, `terminal.*` (VS Code terminal keys ≠ Zed terminal.ansi), `titleBar.*`, `walkThrough.*`, `welcomePage.*`, `widget.*` — silently skipped.

## Conversion Script

**File:** `tools/convert-vscode-to-zed.mjs`
**Runtime:** Node.js (zero dependencies, ES module)
**Input:** `themes/MakeSenseTSX Theme-color-theme.json` + `themes/LightSenseTSX Theme-color-theme.json`
**Output:** `zed/themes/makesensetsx.json`

### Script Flow

1. Read both VS Code theme JSON files.
2. For each theme:
   a. Map `colors` → `style` keys using the color mapping table.
   b. Map `tokenColors` → `syntax` keys using the scope mapping table:
      - Parse comma-separated scopes, take first scope.
      - Match longest prefix from the mapping table.
      - On conflict (multiple entries → same syntax key), keep most specific (longest scope).
   c. Extract `foreground` from `settings` → `syntax[key].color`.
3. Assemble Theme Family JSON: `{ name, author, themes: [dark, light] }`.
4. Write to `zed/themes/makesensetsx.json`.
5. Print summary: X syntax keys mapped, Y style keys mapped, Z keys skipped.

### Scope Matching Algorithm

Prefix-trie approach: for a scope like `keyword.operator.quantifier.regexp`, try matching in order:
1. `keyword.operator.quantifier.regexp` (exact)
2. `keyword.operator.quantifier.*`
3. `keyword.operator.*`
4. `keyword.*`

First match wins, ensuring the most specific Zed syntax key is selected.

## Output: Zed Theme Family JSON

**File:** `zed/themes/makesensetsx.json`

Structure:
```json
{
  "$schema": "https://zed.dev/schema/themes/v0.2.0.json",
  "name": "MakeSenseTSX",
  "author": "Nahdi Duta Ahmad",
  "themes": [
    {
      "name": "MakeSenseTSX Dark",
      "appearance": "dark",
      "style": {
        "background": "#0d1117",
        "text": "#e6edf3",
        "editor.background": "#0d1117",
        "editor.foreground": "#e6edf3",
        "...": "...",
        "syntax": {
          "comment": { "color": "#..." },
          "string": { "color": "#..." },
          "keyword": { "color": "#..." },
          "variable": { "color": "#..." },
          "function": { "color": "#..." },
          "type": { "color": "#..." },
          "number": { "color": "#..." },
          "tag": { "color": "#..." },
          "attribute": { "color": "#..." },
          "...": "..."
        }
      }
    },
    {
      "name": "LightSenseTSX Light",
      "appearance": "light",
      "style": { "...same structure, light colors..." }
    }
  ]
}
```

## extension.toml

**File:** `zed/extension.toml`

```toml
id = "makesensetsx"
name = "MakeSenseTSX Theme"
version = "0.0.1"
schema_version = 1
authors = ["Nahdi Duta Ahmad <dutaahmadtefur@gmail.com>"]
description = "A simple yet make-sense TSX-focused color theme for Zed, inspired by GitHub Dark Theme and Developer's Theme."
repository = "https://github.com/dutaahmad/makesensetsx-theme"
```

## Manual Refinement Phase

After the script generates the draft:

1. **Visual review in Zed:** Copy `zed/themes/makesensetsx.json` to `~/.config/zed/themes/`, open Zed, select theme, inspect TSX/TS/JS files.
2. **Edge case fixes:** Handle TextMate scopes that didn't map cleanly.
3. **Terminal ANSI colors:** Add 16 ANSI colors per variant derived from theme palette.
4. **Missing style keys:** Fill in Zed style keys without VS Code analogs (`accents`, `players`, `drop_target.background`, `search.match_background`, `scrollbar.*`, `link_text.hover`, `pane.focused_border`, `panel.focused_border`, `success`, `warning`, `hint`, `info`, `predictive`, `renamed`, `hidden`, `unreachable`).
5. **Save refined output** back to `zed/themes/makesensetsx.json`.

## Implementation Steps

1. ~~Create branch `dev/zed-integration` from `main`~~ ✅
2. ~~Merge `origin/dev/light-theme` to get both theme files~~ ✅
3. Write spec doc (this file) and commit
4. Create `tools/convert-vscode-to-zed.mjs` with mapping tables and conversion logic
5. Run script → generates `zed/themes/makesensetsx.json` (draft)
6. Create `zed/extension.toml`
7. Manual refinement pass — visual review, edge cases, terminal ANSI colors, missing style keys
8. Update `AGENTS.md` with Zed extension section + script usage
9. Update `.vscodeignore` to exclude `zed/` and `tools/` from VS Code VSIX

## Verification

- `zed/themes/makesensetsx.json` validates against `https://zed.dev/schema/themes/v0.2.0.json`
- Both dark and light themes appear in Zed's theme selector when file is in `~/.config/zed/themes/`
- Syntax highlighting colors in Zed match the VS Code theme's visual intent for TSX/TS/JS
- Conversion script is re-runnable and produces consistent output
