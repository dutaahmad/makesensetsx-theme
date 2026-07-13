# Zed Theme Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Zed editor theme extension derived from the two VS Code theme variants (MakeSenseTSX dark + LightSenseTSX light) using a script-generated draft + manual refinement.

**Architecture:** A zero-dependency Node.js ES module reads both VS Code theme JSONC files, strips trailing commas, applies explicit TextMate-scope→Zed-syntax and VS Code-colors→Zed-style mapping tables, and outputs a Zed Theme Family JSON. A manual refinement pass adds terminal ANSI colors for the light theme and fills missing Zed style keys.

**Tech Stack:** Node.js (built-in `fs` only, no dependencies), Zed theme schema v0.2.0, TOML for `extension.toml`.

## Global Constraints

- No npm dependencies — script uses Node.js built-in modules only.
- VS Code theme files are JSONC (trailing commas allowed) — script must strip them before `JSON.parse`.
- Some `tokenColors[].scope` values are arrays, not strings — script must handle both.
- Zed schema URL: `https://zed.dev/schema/themes/v0.2.0.json`
- Branch: `dev/zed-integration` (already created, `origin/dev/light-theme` already merged).
- No test framework exists — "verification" means running the script and checking output structure.

---

### Task 1: Create the Conversion Script

**Files:**
- Create: `tools/convert-vscode-to-zed.mjs`

**Interfaces:**
- Consumes: `themes/MakeSenseTSX Theme-color-theme.json`, `themes/LightSenseTSX Theme-color-theme.json`
- Produces: `zed/themes/makesensetsx.json` (Zed Theme Family JSON with both dark + light themes)

- [ ] **Step 1: Create the tools/ directory and script file**

Create `tools/convert-vscode-to-zed.mjs` with the following complete content:

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// --- Mapping Tables ---

// TextMate scope prefix → Zed syntax key.
// Longest prefix match wins (most specific).
const SCOPE_TO_SYNTAX = {
  'comment.documentation': 'comment.doc',
  'comment': 'comment',
  'string.regexp': 'string.special',
  'string': 'string',
  'keyword.control': 'keyword.control',
  'keyword.operator': 'keyword.operator',
  'keyword': 'keyword',
  'variable.parameter': 'variable.parameter',
  'variable.language': 'variable.builtin',
  'variable.builtin': 'variable.builtin',
  'variable': 'variable',
  'entity.name.function': 'function',
  'entity.name.type.builtin': 'type.builtin',
  'entity.name.type': 'type',
  'entity.name.tag': 'tag',
  'entity.name.section': 'variable',
  'entity.other.attribute-name': 'attribute',
  'entity.other.inherited-class': 'type',
  'support.function': 'function',
  'support.type.builtin': 'type.builtin',
  'support.type': 'type',
  'support.constant': 'constant',
  'support.class': 'type',
  'support.variable': 'variable',
  'storage.type': 'type',
  'storage.modifier': 'keyword',
  'constant.numeric': 'number',
  'constant.language': 'constant.builtin',
  'constant.builtin': 'constant.builtin',
  'constant.character.escape': 'string.special',
  'constant.character': 'string',
  'constant': 'constant',
  'punctuation.section': 'punctuation.bracket',
  'punctuation.parenthesis': 'punctuation.bracket',
  'punctuation.definition': 'punctuation.delimiter',
  'punctuation.separator': 'punctuation.delimiter',
  'punctuation.terminator': 'punctuation.delimiter',
  'punctuation': 'punctuation.delimiter',
  'markup.heading': 'keyword',
  'markup.bold': 'keyword',
  'markup.italic': 'keyword',
  'markup.underline': 'keyword',
  'markup.quote': 'comment',
  'markup.inserted': 'string',
  'markup.deleted': 'constant',
  'markup.changed': 'keyword',
  'invalid.deprecated': 'comment',
  'invalid.illegal': 'error',
  'invalid': 'error',
};

// VS Code semanticTokenColors key → Zed syntax key
const SEMANTIC_TO_SYNTAX = {
  'enumMember': 'constant',
  'variable.constant': 'constant',
  'variable.defaultLibrary': 'variable.builtin',
};

// VS Code colors key → Zed style key(s).
// Value can be a string (single) or array (multiple Zed keys get same color).
const COLORS_TO_STYLE = {
  'editor.background': ['editor.background', 'background'],
  'editor.foreground': ['editor.foreground', 'text'],
  'editor.lineHighlightBackground': ['editor.active_line.background'],
  'editorLineNumber.foreground': ['editor.line_number'],
  'editorLineNumber.activeForeground': ['editor.active_line_number'],
  'editorWhitespace.foreground': ['editor.invisible'],
  'editorIndentGuide.background1': ['editor.indent_guide'],
  'editorIndentGuide.activeBackground1': ['editor.indent_guide_active'],
  'editor.selectionHighlightBackground': ['editor.document_highlight.read_background'],
  'editor.foldBackground': ['editor.document_highlight.read_background'],
  'activityBar.background': ['toolbar.background'],
  'activityBar.inactiveForeground': ['text.muted'],
  'activityBar.activeBorder': ['border.focused'],
  'activityBar.foreground': ['text'],
  'activityBar.border': ['border'],
  'statusBar.background': ['status_bar.background'],
  'statusBar.foreground': ['text'],
  'statusBar.border': ['border'],
  'editorGroupHeader.tabsBackground': ['tab_bar.background'],
  'editorGroupHeader.tabsBorder': ['border'],
  'editorGroup.border': ['border.variant'],
  'sideBar.background': ['panel.background'],
  'sideBar.foreground': ['text.muted'],
  'sideBar.border': ['border'],
  'sideBarSectionHeader.background': ['panel.background'],
  'tab.activeBackground': ['tab.active_background'],
  'tab.inactiveBackground': ['tab.inactive_background'],
  'tab.activeForeground': ['text'],
  'tab.inactiveForeground': ['text.muted'],
  'tab.border': ['border'],
  'focusBorder': ['border.focused'],
  'errorForeground': ['error'],
  'foreground': ['text'],
  'descriptionForeground': ['text.muted'],
  'icon.foreground': ['icon'],
  'button.background': ['element.background'],
  'button.hoverBackground': ['element.hover'],
  'button.foreground': ['text'],
  'button.secondaryBackground': ['ghost_element.background'],
  'button.secondaryHoverBackground': ['ghost_element.hover'],
  'input.background': ['element.background'],
  'input.foreground': ['text'],
  'input.placeholderForeground': ['text.placeholder'],
  'input.border': ['border'],
  'list.hoverBackground': ['ghost_element.hover'],
  'list.hoverForeground': ['text'],
  'list.activeSelectionBackground': ['element.selected'],
  'list.activeSelectionForeground': ['text'],
  'list.inactiveSelectionBackground': ['element.selected'],
  'list.focusBackground': ['element.hover'],
  'dropdown.background': ['elevated_surface.background'],
  'dropdown.border': ['border'],
  'dropdown.foreground': ['text'],
  'badge.background': ['text.accent'],
  'badge.foreground': ['text'],
  'gitDecoration.modifiedResourceForeground': ['modified'],
  'gitDecoration.deletedResourceForeground': ['deleted'],
  'gitDecoration.addedResourceForeground': ['created'],
  'gitDecoration.untrackedResourceForeground': ['created'],
  'gitDecoration.ignoredResourceForeground': ['ignored'],
  'gitDecoration.conflictingResourceForeground': ['conflict'],
  'gitDecoration.submoduleResourceForeground': ['hidden'],
  'editorGutter.addedBackground': ['created'],
  'editorGutter.deletedBackground': ['deleted'],
  'editorGutter.modifiedBackground': ['modified'],
  'editorCursor.foreground': ['text.accent'],
  'editor.findMatchBackground': ['search.match_background'],
  'editorBracketMatch.border': ['editor.document_highlight.bracket_background'],
  'panel.background': ['panel.background'],
  'panel.border': ['border'],
  'panelTitle.activeForeground': ['text'],
  'panelTitle.inactiveForeground': ['text.muted'],
  'titleBar.activeBackground': ['title_bar.background'],
  'titleBar.activeForeground': ['text'],
  'titleBar.border': ['border'],
  'notifications.background': ['elevated_surface.background'],
  'notifications.foreground': ['text'],
  'notifications.border': ['border'],
  'notificationCenterHeader.background': ['elevated_surface.background'],
  'quickInput.background': ['elevated_surface.background'],
  'quickInput.foreground': ['text'],
  'peekViewEditor.background': ['elevated_surface.background'],
  'peekViewResult.background': ['elevated_surface.background'],
  'progressBar.background': ['text.accent'],
  'scrollbarSlider.background': ['scrollbar.thumb.background'],
  'scrollbarSlider.hoverBackground': ['scrollbar.thumb.hover_background'],
  'scrollbarSlider.activeBackground': ['scrollbar.thumb.background'],
  'scrollbar.shadow': ['scrollbar.track.border'],
  'textLink.foreground': ['link_text.hover'],
  'textLink.activeForeground': ['link_text.hover'],
  'textBlockQuote.background': ['panel.background'],
  'textBlockQuote.border': ['border.variant'],
  'textPreformat.foreground': ['text.muted'],
  'textSeparator.foreground': ['border.variant'],
  'diffEditor.insertedLineBackground': ['created.background'],
  'diffEditor.removedLineBackground': ['deleted.background'],
  'tree.indentGuidesStroke': ['editor.indent_guide'],
  'editorInlayHint.background': ['ghost_element.background'],
  'editorInlayHint.foreground': ['text.muted'],
  'pickerGroup.foreground': ['text.muted'],
  'pickerGroup.border': ['border.variant'],
  'checkbox.background': ['element.background'],
  'checkbox.border': ['border'],
};

// VS Code terminal ANSI key → Zed terminal.ansi key (camelCase → snake_case)
const TERMINAL_ANSI_MAP = {
  'terminal.ansiBlack': 'terminal.ansi.black',
  'terminal.ansiRed': 'terminal.ansi.red',
  'terminal.ansiGreen': 'terminal.ansi.green',
  'terminal.ansiYellow': 'terminal.ansi.yellow',
  'terminal.ansiBlue': 'terminal.ansi.blue',
  'terminal.ansiMagenta': 'terminal.ansi.magenta',
  'terminal.ansiCyan': 'terminal.ansi.cyan',
  'terminal.ansiWhite': 'terminal.ansi.white',
  'terminal.ansiBrightBlack': 'terminal.ansi.bright_black',
  'terminal.ansiBrightRed': 'terminal.ansi.bright_red',
  'terminal.ansiBrightGreen': 'terminal.ansi.bright_green',
  'terminal.ansiBrightYellow': 'terminal.ansi.bright_yellow',
  'terminal.ansiBrightBlue': 'terminal.ansi.bright_blue',
  'terminal.ansiBrightMagenta': 'terminal.ansi.bright_magenta',
  'terminal.ansiBrightCyan': 'terminal.ansi.bright_cyan',
  'terminal.ansiBrightWhite': 'terminal.ansi.bright_white',
  'terminal.foreground': 'terminal.foreground',
};

// --- Conversion Logic ---

function stripTrailingCommas(jsonc) {
  return jsonc.replace(/,(\s*[}\]])/g, '$1');
}

function matchScope(scope, mapping) {
  const parts = scope.split('.');
  for (let i = parts.length; i >= 1; i--) {
    const prefix = parts.slice(0, i).join('.');
    if (mapping[prefix]) {
      return mapping[prefix];
    }
  }
  return null;
}

function convertTokenColors(tokenColors) {
  const syntax = {};
  const syntaxScopeLengths = {};

  for (const entry of tokenColors) {
    const scopeStr = Array.isArray(entry.scope) ? entry.scope.join(',') : entry.scope;
    if (typeof scopeStr !== 'string') continue;
    const scopes = scopeStr.split(',').map(s => s.trim());
    const firstScope = scopes[0];
    if (!firstScope) continue;
    const zedKey = matchScope(firstScope, SCOPE_TO_SYNTAX);
    if (!zedKey) continue;

    const color = entry.settings?.foreground;
    if (!color) continue;

    const scopeLength = firstScope.split('.').length;
    if (syntax[zedKey] && syntaxScopeLengths[zedKey] > scopeLength) {
      continue;
    }

    const style = { color };
    if (entry.settings?.fontStyle) {
      const fs = entry.settings.fontStyle;
      if (fs.includes('italic')) style.font_style = 'italic';
      if (fs.includes('bold')) style.font_weight = 700;
    }
    syntax[zedKey] = style;
    syntaxScopeLengths[zedKey] = scopeLength;
  }

  return syntax;
}

function convertSemanticTokens(semanticTokenColors) {
  const syntax = {};
  for (const [key, settings] of Object.entries(semanticTokenColors || {})) {
    const zedKey = SEMANTIC_TO_SYNTAX[key];
    if (!zedKey || !settings?.foreground) continue;
    syntax[zedKey] = { color: settings.foreground };
  }
  return syntax;
}

function convertColors(colors) {
  const style = {};
  for (const [vscodeKey, zedKeys] of Object.entries(COLORS_TO_STYLE)) {
    if (colors[vscodeKey]) {
      const keys = Array.isArray(zedKeys) ? zedKeys : [zedKeys];
      for (const zedKey of keys) {
        style[zedKey] = colors[vscodeKey];
      }
    }
  }
  for (const [vscodeKey, zedKey] of Object.entries(TERMINAL_ANSI_MAP)) {
    if (colors[vscodeKey]) {
      style[zedKey] = colors[vscodeKey];
    }
  }
  return style;
}

function convertTheme(vscodeTheme, appearance, themeName) {
  const styleColors = convertColors(vscodeTheme.colors || {});
  const tokenSyntax = convertTokenColors(vscodeTheme.tokenColors || []);
  const semanticSyntax = convertSemanticTokens(vscodeTheme.semanticTokenColors);
  const syntax = { ...tokenSyntax, ...semanticSyntax };
  const style = { ...styleColors, syntax };

  return {
    name: themeName,
    appearance,
    style,
  };
}

// --- Main ---

const darkRaw = stripTrailingCommas(readFileSync(join(repoRoot, 'themes/MakeSenseTSX Theme-color-theme.json'), 'utf8'));
const lightRaw = stripTrailingCommas(readFileSync(join(repoRoot, 'themes/LightSenseTSX Theme-color-theme.json'), 'utf8'));

const darkTheme = JSON.parse(darkRaw);
const lightTheme = JSON.parse(lightRaw);

const zedThemeFamily = {
  $schema: 'https://zed.dev/schema/themes/v0.2.0.json',
  name: 'MakeSenseTSX',
  author: 'Nahdi Duta Ahmad',
  themes: [
    convertTheme(darkTheme, 'dark', 'MakeSenseTSX Dark'),
    convertTheme(lightTheme, 'light', 'LightSenseTSX Light'),
  ],
};

mkdirSync(join(repoRoot, 'zed/themes'), { recursive: true });
writeFileSync(
  join(repoRoot, 'zed/themes/makesensetsx.json'),
  JSON.stringify(zedThemeFamily, null, 2) + '\n'
);

const darkStyle = zedThemeFamily.themes[0].style;
const lightStyle = zedThemeFamily.themes[1].style;
console.log('Conversion complete!');
console.log(`Output: zed/themes/makesensetsx.json`);
console.log(`Dark theme:  ${Object.keys(darkStyle).length} style keys, ${Object.keys(darkStyle.syntax).length} syntax keys`);
console.log(`Light theme: ${Object.keys(lightStyle).length} style keys, ${Object.keys(lightStyle.syntax).length} syntax keys`);
```

- [ ] **Step 2: Verify the script runs without errors**

Run:
```bash
node tools/convert-vscode-to-zed.mjs
```
Expected output:
```
Conversion complete!
Output: zed/themes/makesensetsx.json
Dark theme:  X style keys, Y syntax keys
Light theme: X style keys, Y syntax keys
```
(X and Y will be non-zero numbers. If the script errors, check that the VS Code theme files are valid after trailing-comma stripping.)

- [ ] **Step 3: Verify the output JSON is valid and has expected structure**

Run:
```bash
node -e "
const t = JSON.parse(require('fs').readFileSync('zed/themes/makesensetsx.json','utf8'));
console.log('schema:', t.\$schema);
console.log('name:', t.name);
console.log('author:', t.author);
console.log('themes:', t.themes.length);
for (const theme of t.themes) {
  console.log('  -', theme.name, '(' + theme.appearance + ')');
  console.log('    style keys:', Object.keys(theme.style).length);
  console.log('    syntax keys:', Object.keys(theme.style.syntax).length);
  console.log('    has background:', !!theme.style.background);
  console.log('    has text:', !!theme.style.text);
  console.log('    has editor.background:', !!theme.style.editor?.background || !!theme.style['editor.background']);
  console.log('    syntax.comment:', JSON.stringify(theme.style.syntax.comment));
  console.log('    syntax.string:', JSON.stringify(theme.style.syntax.string));
  console.log('    syntax.keyword:', JSON.stringify(theme.style.syntax.keyword));
}
"
```
Expected: Both themes present, dark has `appearance: "dark"`, light has `appearance: "light"`, both have `background`, `text`, `editor.background`, and `syntax` with `comment`, `string`, `keyword` keys.

- [ ] **Step 4: Commit**

```bash
git add tools/convert-vscode-to-zed.mjs zed/themes/makesensetsx.json
git commit -m "feat: add VS Code to Zed theme conversion script and draft output"
```

---

### Task 2: Create extension.toml

**Files:**
- Create: `zed/extension.toml`

- [ ] **Step 1: Create the Zed extension manifest**

Create `zed/extension.toml` with the following content:

```toml
id = "makesensetsx"
name = "MakeSenseTSX Theme"
version = "0.0.1"
schema_version = 1
authors = ["Nahdi Duta Ahmad <dutaahmadtefur@gmail.com>"]
description = "A simple yet make-sense TSX-focused color theme for Zed, inspired by GitHub Dark Theme and Developer's Theme."
repository = "https://github.com/dutaahmad/makesensetsx-theme"
```

- [ ] **Step 2: Verify the file exists and is valid TOML**

Run:
```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('zed/extension.toml', 'utf8');
const lines = content.trim().split('\n');
for (const line of lines) {
  if (line.trim() && !line.trim().startsWith('#')) {
    const [key, ...rest] = line.split('=');
    console.log(key.trim() + ' = ' + rest.join('=').trim());
  }
}
console.log('--- extension.toml is valid ---');
"
```
Expected: 7 key-value pairs printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add zed/extension.toml
git commit -m "feat: add Zed extension manifest"
```

---

### Task 3: Add Terminal ANSI Colors for Light Theme & Fill Missing Style Keys

The light VS Code theme has no terminal ANSI colors. The script left them out. This task adds them manually and fills in Zed style keys that have no VS Code analog.

**Files:**
- Modify: `zed/themes/makesensetsx.json`

- [ ] **Step 1: Read the current generated JSON to identify gaps**

Run:
```bash
node -e "
const t = JSON.parse(require('fs').readFileSync('zed/themes/makesensetsx.json','utf8'));
for (const theme of t.themes) {
  console.log('=== ' + theme.name + ' ===');
  const style = theme.style;
  const missingAnsi = ['black','red','green','yellow','blue','magenta','cyan','white','bright_black','bright_red','bright_green','bright_yellow','bright_blue','bright_magenta','bright_cyan','bright_white']
    .filter(k => !style['terminal.ansi.' + k]);
  if (missingAnsi.length) console.log('  Missing terminal.ansi:', missingAnsi.join(', '));
  const missingStyle = ['accents','players','drop_target.background','search.match_background','scrollbar.track.background','scrollbar.thumb.border','scrollbar.track.border','success','warning','hint','info','renamed','hidden','unreachable','predictive','pane.focused_border','panel.focused_border','editor.active_wrap_guide','editor.wrap_guide','editor.highlighted_line.background','editor.gutter.background','editor.subheader.background','background.appearance','title_bar.inactive_background']
    .filter(k => !style[k]);
  if (missingStyle.length) console.log('  Missing style keys:', missingStyle.join(', '));
  console.log('  terminal.foreground:', style['terminal.foreground'] || 'MISSING');
}
"
```

- [ ] **Step 2: Add terminal ANSI colors for the light theme and fill missing style keys**

Edit `zed/themes/makesensetsx.json` — in the light theme's `style` object, add these terminal ANSI colors (derived from the light theme's palette — light backgrounds need darker ANSI colors):

```json
"terminal.ansi.black": "#000000",
"terminal.ansi.red": "#d1242f",
"terminal.ansi.green": "#1a7f37",
"terminal.ansi.yellow": "#bf8700",
"terminal.ansi.blue": "#005fb8",
"terminal.ansi.magenta": "#8250df",
"terminal.ansi.cyan": "#0550ae",
"terminal.ansi.white": "#3b3b3b",
"terminal.ansi.bright_black": "#57606a",
"terminal.ansi.bright_red": "#cf222e",
"terminal.ansi.bright_green": "#2da44e",
"terminal.ansi.bright_yellow": "#9a6700",
"terminal.ansi.bright_blue": "#0969da",
"terminal.ansi.bright_magenta": "#a371f7",
"terminal.ansi.bright_cyan": "#1b7c83",
"terminal.ansi.bright_white": "#6e7681",
"terminal.foreground": "#3b3b3b",
"terminal.background": "#ffffff"
```

Also add to both dark and light themes these missing style keys (if not already present):

For dark theme:
```json
"accents": ["#f78166", "#1f6feb", "#2f81f7", "#bc8cff", "#d2a8ff"],
"players": [
  {"background": "#f78166", "cursor": "#f78166", "selection": "#f7816633"},
  {"background": "#1f6feb", "cursor": "#1f6feb", "selection": "#1f6feb33"},
  {"background": "#2ea043", "cursor": "#2ea043", "selection": "#2ea04333"},
  {"background": "#bc8cff", "cursor": "#bc8cff", "selection": "#bc8cff33"},
  {"background": "#d29922", "cursor": "#d29922", "selection": "#d2992233"},
  {"background": "#ff7b72", "cursor": "#ff7b72", "selection": "#ff7b7233"},
  {"background": "#56d364", "cursor": "#56d364", "selection": "#56d36433"},
  {"background": "#79c0ff", "cursor": "#79c0ff", "selection": "#79c0ff33"}
],
"editor.active_wrap_guide": "#e6edf31f",
"editor.wrap_guide": "#e6edf314",
"editor.gutter.background": "#0d1117",
"editor.highlighted_line.background": "#161b22",
"editor.subheader.background": "#161b22",
"scrollbar.thumb.border": "#484f58",
"scrollbar.track.background": "#0d1117",
"scrollbar.track.border": "#010409",
"pane.focused_border": "#1f6feb",
"panel.focused_border": "#1f6feb",
"success": "#3fb950",
"warning": "#d29922",
"hint": "#6e7681",
"info": "#2f81f7",
"renamed": "#d29922",
"hidden": "#6e7681",
"unreachable": "#6e7681",
"predictive": "#bc8cff",
"drop_target.background": "#1f6feb33",
"link_text.hover": "#2f81f7",
"ghost_element.active": "#30363d",
"ghost_element.disabled": "#161b22",
"ghost_element.selected": "#30363d",
"element.disabled": "#161b22",
"element.active": "#30363d",
"border.disabled": "#21262d",
"border.selected": "#1f6feb",
"border.transparent": "#0d111700",
"text.disabled": "#6e7681",
"text.accent": "#2f81f7",
"created.background": "#23863626",
"created.border": "#2ea043",
"deleted.background": "#da363326",
"deleted.border": "#f85149",
"modified.background": "#bb800926",
"modified.border": "#d29922",
"conflict.background": "#db6d2826",
"conflict.border": "#db6d28",
"ignored.background": "#6e76811a",
"ignored.border": "#6e7681",
"hidden.background": "#6e76811a",
"hidden.border": "#6e7681",
"error.background": "#f851491a",
"error.border": "#f85149",
"warning.background": "#d299221a",
"warning.border": "#d29922",
"hint.background": "#6e76811a",
"hint.border": "#6e7681",
"info.background": "#2f81f71a",
"info.border": "#2f81f7"
```

For light theme (same keys, light-appropriate values):
```json
"accents": ["#005fb8", "#0258a8", "#0969da", "#8250df", "#a371f7"],
"players": [
  {"background": "#005fb8", "cursor": "#005fb8", "selection": "#005fb833"},
  {"background": "#1a7f37", "cursor": "#1a7f37", "selection": "#1a7f3733"},
  {"background": "#bf8700", "cursor": "#bf8700", "selection": "#bf870033"},
  {"background": "#8250df", "cursor": "#8250df", "selection": "#8250df33"},
  {"background": "#d1242f", "cursor": "#d1242f", "selection": "#d1242f33"},
  {"background": "#0969da", "cursor": "#0969da", "selection": "#0969da33"}
],
"editor.active_wrap_guide": "#939393",
"editor.wrap_guide": "#d3d3d3",
"editor.gutter.background": "#ffffff",
"editor.highlighted_line.background": "#f8f8f8",
"editor.subheader.background": "#f8f8f8",
"scrollbar.thumb.border": "#cecece",
"scrollbar.track.background": "#f8f8f8",
"scrollbar.track.border": "#e5e5e5",
"pane.focused_border": "#005fb8",
"panel.focused_border": "#005fb8",
"success": "#1a7f37",
"warning": "#bf8700",
"hint": "#57606a",
"info": "#0969da",
"renamed": "#bf8700",
"hidden": "#6e7681",
"unreachable": "#57606a",
"predictive": "#8250df",
"drop_target.background": "#005fb833",
"link_text.hover": "#0969da",
"ghost_element.active": "#e5e5e5",
"ghost_element.disabled": "#f8f8f8",
"ghost_element.selected": "#e5e5e5",
"element.disabled": "#f8f8f8",
"element.active": "#e5e5e5",
"border.disabled": "#e5e5e5",
"border.selected": "#005fb8",
"border.transparent": "#ffffff00",
"text.disabled": "#767676",
"text.accent": "#005fb8",
"created.background": "#1a7f3726",
"created.border": "#1a7f37",
"deleted.background": "#d1242f26",
"deleted.border": "#d1242f",
"modified.background": "#bf870026",
"modified.border": "#bf8700",
"conflict.background": "#bf870026",
"conflict.border": "#bf8700",
"ignored.background": "#6e76811a",
"ignored.border": "#6e7681",
"hidden.background": "#6e76811a",
"hidden.border": "#6e7681",
"error.background": "#d1242f1a",
"error.border": "#d1242f",
"warning.background": "#bf87001a",
"warning.border": "#bf8700",
"hint.background": "#57606a1a",
"hint.border": "#57606a",
"info.background": "#0969da1a",
"info.border": "#0969da"
```

- [ ] **Step 3: Validate the final JSON structure**

Run:
```bash
node -e "
const t = JSON.parse(require('fs').readFileSync('zed/themes/makesensetsx.json','utf8'));
console.log('Valid JSON with', t.themes.length, 'themes');
for (const theme of t.themes) {
  const s = theme.style;
  const ansiCount = Object.keys(s).filter(k => k.startsWith('terminal.ansi.')).length;
  console.log(theme.name + ': ' + ansiCount + ' ANSI colors, ' + Object.keys(s).length + ' style keys, ' + Object.keys(s.syntax).length + ' syntax keys');
  if (ansiCount < 16) throw new Error(theme.name + ' is missing ANSI colors');
  if (!s.background) throw new Error(theme.name + ' missing background');
  if (!s.text) throw new Error(theme.name + ' missing text');
}
console.log('All checks passed!');
"
```
Expected: `All checks passed!` with no errors thrown.

- [ ] **Step 4: Commit**

```bash
git add zed/themes/makesensetsx.json
git commit -m "feat: add terminal ANSI colors for light theme and fill missing Zed style keys"
```

---

### Task 4: Update AGENTS.md and .vscodeignore

**Files:**
- Modify: `AGENTS.md`
- Modify: `.vscodeignore`

- [ ] **Step 1: Update AGENTS.md with Zed extension section**

Add the following section to `AGENTS.md` after the existing "Next focus: Zed editor integration" section (replace that section with an "implemented" version):

Replace the "## Next focus: Zed editor integration" section with:

```markdown
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
```

- [ ] **Step 2: Update .vscodeignore to exclude zed/ and tools/ from the VS Code VSIX**

Add these lines to `.vscodeignore`:

```
zed/**
tools/**
docs/**
```

- [ ] **Step 3: Verify .vscodeignore is updated**

Run:
```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('.vscodeignore', 'utf8');
const lines = content.trim().split('\n');
console.log('Lines:', lines.length);
console.log('Has zed/**:', lines.includes('zed/**'));
console.log('Has tools/**:', lines.includes('tools/**'));
console.log('Has docs/**:', lines.includes('docs/**'));
if (!lines.includes('zed/**') || !lines.includes('tools/**')) throw new Error('Missing exclusions');
console.log('All exclusions present!');
"
```
Expected: `All exclusions present!`

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md .vscodeignore
git commit -m "docs: update AGENTS.md with Zed extension section, exclude zed/tools from VSIX"
```

---

### Task 5: Final Validation

- [ ] **Step 1: Run the conversion script to verify it still works**

Run:
```bash
node tools/convert-vscode-to-zed.mjs
```
Expected: `Conversion complete!` with non-zero style/syntax key counts.

- [ ] **Step 2: Verify the complete file structure**

Run:
```bash
node -e "
const fs = require('fs');
const checks = [
  ['zed/extension.toml', 'Zed extension manifest'],
  ['zed/themes/makesensetsx.json', 'Zed theme family JSON'],
  ['tools/convert-vscode-to-zed.mjs', 'Conversion script'],
];
for (const [path, desc] of checks) {
  if (!fs.existsSync(path)) throw new Error('Missing: ' + path + ' (' + desc + ')');
  console.log('OK: ' + path + ' (' + desc + ')');
}
const theme = JSON.parse(fs.readFileSync('zed/themes/makesensetsx.json', 'utf8'));
if (theme.themes.length !== 2) throw new Error('Expected 2 themes, got ' + theme.themes.length);
if (theme.themes[0].appearance !== 'dark') throw new Error('First theme should be dark');
if (theme.themes[1].appearance !== 'light') throw new Error('Second theme should be light');
console.log('OK: Theme family has dark + light variants');
console.log('All validation passed!');
"
```
Expected: `All validation passed!`

- [ ] **Step 3: Verify git status is clean**

Run:
```bash
git status
```
Expected: `nothing to commit, working tree clean` (or only untracked files that aren't part of this feature).
