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
