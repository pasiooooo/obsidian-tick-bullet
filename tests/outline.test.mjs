import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { EditorSelection, EditorState, Transaction } from '@codemirror/state';
import { history, undo, redo, indentLess, indentMore } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { markdown, insertNewlineContinueMarkup } from '@codemirror/lang-markdown';
import { defaults, TimeFormats } from '../src/time.ts';
import { finishOutlineChange, outlineExtension } from '../src/outline.ts';
import { commandEdit, mapCursor } from '../src/commands.ts';

const moment = createRequire(import.meta.resolve('obsidian/package.json'))('moment');
moment.now = () => new Date(2026, 0, 1, 12, 34, 56).getTime();

function editor(marked, settings = {}, extensions = []) {
  const anchor = marked.indexOf('¦');
  const formats = new TimeFormats({ ...defaults, ...settings }, moment);
  const target = {
    state: EditorState.create({
      doc: marked.replace('¦', ''), selection: { anchor },
      extensions: [markdown(), indentUnit.of('\t'), history(), outlineExtension(formats), extensions],
    }),
    dispatch(transaction) { target.state = transaction.state; },
  };
  return {
    target,
    type(text, userEvent = 'input.type') {
      target.dispatch(target.state.update(target.state.replaceSelection(text), { userEvent }));
    },
    key(command) {
      assert.equal(command(target), true);
      target.dispatch(target.state.update({ effects: finishOutlineChange.of(null) }));
    },
    expect(text) {
      const { doc, selection } = target.state;
      const head = selection.main.head;
      assert.equal(doc.sliceString(0, head) + '¦' + doc.sliceString(head), text);
    },
  };
}

test('Space on a bare bullet starts short and cycles either way until body text is entered', () => {
  const note = editor('-¦');
  note.type(' '); note.expect('- ¦');
  for (const stamp of ['12:34', '2026-01-01 12:34', '12:34', '2026-01-01 12:34']) {
    note.type(' '); note.expect(`- ${stamp} ¦`);
  }
  note.type('记录'); note.type(' '); note.type(' '); note.expect('- 2026-01-01 12:34 记录  ¦');
});

test('switching an inherited long time to short sets the format for the next sibling', () => {
  const note = editor('- 2025-12-31 14:00 旧记录¦');
  note.key(insertNewlineContinueMarkup);
  note.type(' '); note.expect('- 2025-12-31 14:00 旧记录\n- 12:34 ¦');
  note.type('新记录'); note.key(insertNewlineContinueMarkup);
  note.expect('- 2025-12-31 14:00 旧记录\n- 12:34 新记录\n- 12:34 ¦');
});

test('Enter → Tab → child Enter → Shift+Tab restores the outer long format', () => {
  const note = editor('- 2024-05-17 08:15 父项¦');
  note.key(insertNewlineContinueMarkup); note.expect('- 2024-05-17 08:15 父项\n- 2026-01-01 12:34 ¦');
  note.key(indentMore); note.expect('- 2024-05-17 08:15 父项\n\t- ¦');
  note.type('子项'); note.key(insertNewlineContinueMarkup);
  assert.match(note.target.state.doc.toString(), /子项\n[\t ]+- $/);
  note.key(indentLess); note.expect('- 2024-05-17 08:15 父项\n\t- 子项\n- 2026-01-01 12:34 ¦');
});

test('nearest sibling, not a descendant or a global last mode, determines the outdent', () => {
  const note = editor('- 2025-12-30 19:00 根\n\t- 08:13 中\n\t\t- 2024-01-01 10:11 深\n\t\t- 草¦稿');
  note.key(indentLess);
  note.expect('- 2025-12-30 19:00 根\n\t- 08:13 中\n\t\t- 2024-01-01 10:11 深\n\t- 12:34 草¦稿');
});

test('a plain sibling overrides an older timestamp; a new parent and a blank line are boundaries', () => {
  for (const before of ['- 08:12 旧\n- 普通\n', '- 其他\n\t- 08:12 旧\n- 新父项\n', '- 08:12 旧\n\n']) {
    const nested = before.endsWith('新父项\n');
    const note = editor(before + (nested ? '\t\t' : '\t') + '- 草稿¦');
    note.key(indentLess); note.expect(before + (nested ? '\t' : '') + '- 草稿¦');
  }
});

test('outdent into a plain level removes only the leading stamp; indent can keep the original time', () => {
  const note = editor('- 普通\n\t- 09:01 写¦作  结尾');
  note.key(indentLess); note.expect('- 普通\n- 写¦作  结尾');
  const keep = editor('- 普通\n- 09:01 写¦作  结尾', { removeOnIndent: false });
  keep.key(indentMore); keep.expect('- 普通\n\t- 09:01 写¦作  结尾');
});

test('use the editor tab width, not indentation string length', () => {
  const note = editor('- 根\n    - 10:07 同级\n\t\t- 草稿¦', {}, EditorState.tabSize.of(4));
  note.key(indentLess); note.expect('- 根\n    - 10:07 同级\n\t- 12:34 草稿¦');
});

test('custom formats and literal affixes survive reopening, upgrading and continuing', () => {
  const config = { shortFormat: 'h:mm A', longFormat: 'DD/MM/YYYY [at] h:mm A', prefix: '[.*', suffix: '+] ' };
  const note = editor('- ¦', config);
  note.type(' '); note.expect('- [.*12:34 PM+]  ¦');
  note.type(' '); note.expect('- [.*01/01/2026 at 12:34 PM+]  ¦');
  note.type(' '); note.expect('- [.*12:34 PM+]  ¦');
  const reopened = editor('- [.*08/07/2023 at 9:05 AM+]  旧记录¦', config);
  reopened.key(insertNewlineContinueMarkup);
  reopened.expect('- [.*08/07/2023 at 9:05 AM+]  旧记录\n- [.*01/01/2026 at 12:34 PM+]  ¦');
});

test('when short and long share a prefix, inherit the longest valid stamp', () => {
  const note = editor('- 09:05 on 2020/03/04 正文¦', { longFormat: 'HH:mm [on] YYYY/MM/DD' });
  note.key(insertNewlineContinueMarkup);
  note.expect('- 09:05 on 2020/03/04 正文\n- 12:34 on 2026/01/01 ¦');
});

test('Enter splitting a bullet preserves the right half and places the caret before it', () => {
  const note = editor('- 09:00 左¦右  右');
  note.key(insertNewlineContinueMarkup); note.expect('- 09:00 左\n- 12:34 ¦右  右');
});

test('disabling sibling inheritance leaves native Enter intact', () => {
  const note = editor('- 07:02 已记¦', { inheritSiblings: false });
  note.key(insertNewlineContinueMarkup); note.expect('- 07:02 已记\n- ¦');
});

test('ordinary spaces, code, YAML, pasted text, and invalid timestamps are not triggers', () => {
  for (const marked of ['正文- ¦', '- 已记 ¦', '- 12:34 ¦正文', '- 2026-01-01 12:34  ¦', '```md\n- ¦\n```', '---\nlist:\n  - ¦\n---']) {
    const note = editor(marked);
    note.type(' '); note.expect(marked.replace('¦', ' ¦'));
  }
  const pasted = editor('- ¦'); pasted.type(' ', 'input.paste'); pasted.expect('-  ¦');
  const bad = editor('- 29:99 不是时间¦'); bad.key(insertNewlineContinueMarkup); bad.expect('- 29:99 不是时间\n- ¦');
});

test('selection replacement and multiple cursors never stamp unrelated text', () => {
  const note = editor('- ¦abc');
  note.target.dispatch(note.target.state.update({ selection: { anchor: 2, head: 5 } }));
  note.type(' '); note.expect('-  ¦');
  const multi = editor('- ¦\n- ', {}, EditorState.allowMultipleSelections.of(true));
  multi.target.dispatch(multi.target.state.update({ selection: EditorSelection.create([EditorSelection.cursor(2), EditorSelection.cursor(5)]) }));
  multi.type(' '); assert.equal(multi.target.state.doc.toString(), '-  \n-  ');
});

test('a space expansion and a native indent each undo and redo atomically', () => {
  const note = editor('- ¦'); note.type(' '); note.key(undo); note.expect('- ¦');
  note.key(redo); note.expect('- 12:34 ¦');
  const moved = editor('- 父\n- 09:05 草稿¦'); moved.key(indentMore);
  moved.key(undo); moved.expect('- 父\n- 09:05 草稿¦');
  moved.key(redo); moved.expect('- 父\n\t- 草稿¦');
});

test('a two-transaction Enter inherits only if the follow-up actually inserts the native marker', () => {
  const note = editor('- 08:16 上午¦');
  note.type('\n', 'input'); note.type('- '); note.expect('- 08:16 上午\n- 12:34 ¦');
  const pasted = editor('- 08:16 上午¦');
  pasted.type('\n', 'input'); pasted.type('- ', 'input.paste'); pasted.expect('- 08:16 上午\n- ¦');
  const later = editor('- 08:16 上午\n¦');
  later.type('- '); later.expect('- 08:16 上午\n- ¦');
});

test('native Enter outdenting an empty child also restores the outer timestamp', () => {
  const note = editor('- 2024-02-03 06:07 父项\n\t- ¦');
  const { state } = note.target;
  const start = state.doc.line(2).from;
  note.target.dispatch(state.update({ changes: { from: start, to: start + 1 }, userEvent: 'input' }));
  note.target.dispatch(note.target.state.update({ effects: finishOutlineChange.of(null) }));
  note.expect('- 2024-02-03 06:07 父项\n- 2026-01-01 12:34 ¦');
});

function replaceThenSelect(note, from, to, insert, lineNumber, column) {
  const target = note.target;
  target.dispatch(target.state.update({ changes: { from, to, insert } }));
  const head = target.state.doc.line(lineNumber).from + column;
  target.dispatch(target.state.update({ selection: { anchor: head } }));
}

test('Outliner sets its selection after replacing text: typing goes after the inherited long stamp', () => {
  const first = '- 2026-11-25 20:27 djisajdias';
  const note = editor(first + '¦');
  replaceThenSelect(note, 0, first.length, first + '\n- ', 2, 2);
  note.expect(first + '\n- 2026-01-01 12:34 ¦');
  note.type('正文'); note.expect(first + '\n- 2026-01-01 12:34 正文¦');
});

test('a two-transaction continuation undoes and redoes as one operation', () => {
  const first = '- 09:05 record';
  const note = editor(first + '¦');
  replaceThenSelect(note, 0, first.length, first + '\n- ', 2, 2);
  note.key(undo); note.expect(first + '¦');
  note.key(redo); note.expect(first + '\n- 12:34 ¦');
});

test('a folded subtree may be skipped, but a distant edit must never clear another list’s timestamp', () => {
  const folded = editor('- 09:05 parent¦\n\t- child');
  const other = editor('- 09:05 ¦\n\n# Other\n- other item');
  for (const note of [folded, other]) {
    const { state } = note.target; const end = state.doc.length;
    note.target.dispatch(state.update({ changes: { from: end, insert: '\n- ' }, selection: { anchor: end + 3 } }));
  }
  folded.expect('- 09:05 parent\n\t- child\n- 12:34 ¦');
  other.expect('- 09:05 \n\n# Other\n- other item\n- ¦');
});

test('an unannotated promotion on empty-child Enter restores the parent level, even across remaining children', () => {
  const first = '- 2020-06-03 08:10 根\n';
  for (const rest of ['', '\n\t- 保留的子项']) {
    const note = editor(first + '\t- ¦' + rest);
    const siblings = rest ? '\t- 保留的子项\n' : '';
    replaceThenSelect(note, first.length, note.target.state.doc.length, siblings + '- ', rest ? 3 : 2, 2);
    note.expect(first + siblings + '- 2026-01-01 12:34 ¦');
    note.type('新项'); note.expect(first + siblings + '- 2026-01-01 12:34 新项¦');
  }
});

test('a structural command with its own name and an atomic cursor also inherits; a soft break does not', () => {
  const note = editor('- 08:17 根\n\t- 草¦稿');
  const start = note.target.state.doc.line(2).from;
  note.target.dispatch(note.target.state.update({ changes: { from: start, to: start + 1 },
    selection: { anchor: start + 3 }, userEvent: 'outline.promote' }));
  note.expect('- 08:17 根\n- 12:34 草¦稿');
  const soft = editor('- 08:17 ¦'); soft.type('\n', 'input'); soft.expect('- 08:17 \n¦');
});

test('Enter on just a timestamp clears that item in place; next Enter belongs to the list editor', () => {
  for (const [stamp, settings] of [['12:34', {}], ['2026-11-25 20:27', {}], ['【8:04 PM】', {shortFormat:'h:mm A',prefix:'【',suffix:'】'}]]) {
    const note = editor(`- 父项\n\t- [ ] ${stamp} ¦\n- 后续`, settings);
    note.key(insertNewlineContinueMarkup); note.expect('- 父项\n\t- [ ] ¦\n- 后续');
  }
  const root = editor('- 20:27 父项\n- 20:28 ¦');
  const line = root.target.state.doc.line(2);
  replaceThenSelect(root, line.from, line.to, '- 20:28 \n- ', 3, 2);
  root.expect('- 20:27 父项\n- ¦');
  replaceThenSelect(root, line.from, root.target.state.doc.length, '', 2, 0);
  root.expect('- 20:27 父项\n¦');
});

test('clearing a stamp is independent of inheritance, is undoable and never clears actual body text', () => {
  const note = editor('- 09:15 ¦', { inheritSiblings: false });
  note.key(insertNewlineContinueMarkup); note.expect('- ¦'); note.key(undo); note.expect('- 09:15 ¦');
  const body = editor('- 09:15 ¦正文'); body.key(insertNewlineContinueMarkup); body.expect('- 09:15\n- 12:34 ¦正文');
});

test('bulk replacements, paste, remote transactions and explicit cursor moves never borrow an old destination', () => {
  for (const flag of [{ userEvent:'input.paste' }, { annotations:Transaction.remote.of(true) }]) {
    const note=editor('- 08:10 内容¦'); const end=note.target.state.doc.length;
    note.target.dispatch(note.target.state.update({ changes:{from:end,insert:'\n- '},selection:{anchor:end+3},...flag }));
    note.expect('- 08:10 内容\n- ¦');
  }
  const note = editor('- 08:10 内容¦'); const end = note.target.state.doc.length;
  note.target.dispatch(note.target.state.update({changes:{from:end,insert:'\n- '}}));
  note.target.dispatch(note.target.state.update({selection:{anchor:end+3},userEvent:'select.pointer'}));
  note.expect('- 08:10 内容\n- ¦');
  replaceThenSelect(note,0,note.target.state.doc.length,'- 09:10 无关\n- 完全不同\n- ',3,2);
  note.expect('- 09:10 无关\n- 完全不同\n- ¦');
});

test('settings apply on the next keypress and clearing formats restores the defaults', () => {
  const settings = { ...defaults };
  const formats = new TimeFormats(settings, moment);
  settings.shortFormat = 'HH点mm分'; settings.prefix = '（'; settings.suffix = '）';
  assert.equal(formats.stamp('short'), '（12点34分）');
  assert.deepEqual(formats.match('（08点04分） 正文'), { mode: 'short', length: 8 });
  settings.shortFormat = ''; settings.prefix = ''; settings.suffix = '';
  assert.equal(formats.stamp('short'), '12:34');
  assert.equal(formats.match('（08点04分） 正文'), null);
});

test('a wrapped single-digit hour is a stamp, not a custom checkbox', () => {
  const note = editor('- [8] 早场¦', { shortFormat: 'H', prefix: '[', suffix: ']' });
  note.key(insertNewlineContinueMarkup); note.expect('- [8] 早场\n- [12] ¦');
});

test('a task marker and a non-empty body both survive native indentation', () => {
  const note = editor('- 父项\n- [x] 07:15 记¦录');
  note.key(indentMore); note.expect('- 父项\n\t- [x] 记¦录');
});

test('palette commands update only their timestamp and retain Markdown structure and cursor', () => {
  const formats = new TimeFormats({ ...defaults, prefix: '[', suffix: ']' }, moment);
  for (const [action, before, after] of [
    ['toggle', '\t草¦稿', '\t- [12:34] 草¦稿'],
    ['toggle', '\t- [ ] [09:00] 草¦稿', '\t- [ ] 草¦稿'],
    ['long', '- [09:00] 草¦稿', '- [2026-01-01 12:34] 草¦稿'],
    ['short', '## 题¦目', '## [12:34] 题¦目'],
    ['end', '笔记 [09:00]¦', '笔记 [12:34]¦'],
  ]) {
    const line = before.replace('¦', '');
    const edit = commandEdit(action, line, formats);
    const next = line.slice(0, edit.from) + edit.insert + line.slice(edit.to);
    const head = mapCursor(before.indexOf('¦'), edit);
    assert.equal(next.slice(0, head) + '¦' + next.slice(head), after);
  }
});
