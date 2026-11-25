import { countColumn, EditorState, Prec, StateEffect, StateField, Transaction } from '@codemirror/state';
import type { EditorSelection, Line, Text, TransactionSpec } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { mapCursor, stampEdit, taskPrefix } from './commands.ts';
import type { Edit } from './commands.ts';
import type { TimeFormats } from './time.ts';

function bullet(text: string, formats: TimeFormats) {
  const match = /^([ \t]*)[-+*] /.exec(text);
  if (!match) return null;
  const rest = text.slice(match[0].length);
  const task = taskPrefix(rest, formats);
  return { indent: match[1], header: match[0] + task, task, body: rest.slice(task.length) };
}

function previousSibling(doc: Text, line: Line, depth: number, tabSize: number, formats: TimeFormats) {
  for (let number = line.number - 1; number > 0; number--) {
    const text = doc.line(number).text;
    const indent = /^[ \t]*/.exec(text)![0];
    if (indent.length === text.length) break;
    const columns = countColumn(indent, tabSize);
    if (columns <= depth) return columns === depth ? bullet(text, formats) : null;
  }
  return null;
}

function onlyChildrenBetween(before: EditorState, doc: Text, source: Line, target: Line, depth: number) {
  for (let number = source.number + 1; number < target.number; number++) {
    const text = doc.line(number).text;
    const indent = /^[ \t]*/.exec(text)![0];
    if (text !== before.doc.line(number).text || indent.length === text.length || countColumn(indent, before.tabSize) <= depth) return false;
  }
  return true;
}

function inMarkdown(state: EditorState, line: Line, indent: string) {
  const doc = state.doc;
  if (/^---[ \t]*$/.test(doc.line(1).text)) {
    let number = 2;
    while (number <= line.number && !/^(?:---|\.\.\.)[ \t]*$/.test(doc.line(number).text)) number++;
    if (number >= line.number) return false;
  }
  const pos = line.from + indent.length + 1;
  const tree = ensureSyntaxTree(state, pos, 12);
  if (!tree) return false;
  for (let node: ReturnType<typeof tree.resolve> | null = tree.resolve(pos, -1); node; node = node.parent) {
    if (/codeblock|fencedcode|frontmatter/i.test(node.name)) return false;
  }
  return true;
}

function atCursor(edit: Edit, head: number): TransactionSpec {
  return { changes: edit, selection: { anchor: mapCursor(head, edit) } };
}

function singleCaret(selection: EditorSelection) {
  return selection.ranges.length === 1 && selection.main.empty;
}

function eligible(transaction: Transaction) {
  return !transaction.startState.readOnly && !transaction.annotation(Transaction.remote) &&
    singleCaret(transaction.startState.selection) && singleCaret(transaction.newSelection) &&
    !['undo', 'redo', 'input.paste', 'input.drop', 'move.drop', 'input.type.compose', 'delete.cut'].some(event => transaction.isUserEvent(event));
}

function transition(before: EditorState, change: Transaction, head: number, formats: TimeFormats): TransactionSpec | undefined {
  const doc = change.newDoc;
  const line = doc.lineAt(head);
  const oldHead = before.selection.main.head;
  const source = before.doc.lineAt(oldHead);
  const old = bullet(source.text, formats);
  const next = bullet(line.text, formats);
  if (!old || !next) return;
  let touched = false;
  change.changes.iterChangedRanges((_from, _to, start, end) => { if (start <= line.to && end >= line.from) touched = true; });
  if (!touched) return;
  const from = line.from + next.header.length;
  const delta = doc.lines - before.doc.lines;
  const event = change.annotation(Transaction.userEvent);
  if ((event === 'input' || event === 'input.type') && delta === 0 && source.number === line.number && oldHead === source.to &&
      head === line.to && line.text === source.text + ' ' && !next.task && (!old.body || old.body.endsWith(' '))) {
    const stamp = formats.match(old.body);
    if ((!old.body || (stamp && stamp.length + 1 === old.body.length)) && inMarkdown(before, source, old.indent)) {
      const mode = stamp?.mode === 'short' ? 'long' : 'short';
      return atCursor({ from, to: line.to, insert: formats.stamp(mode) + ' ' }, head);
    }
  }

  const oldDepth = countColumn(old.indent, before.tabSize);
  const split = delta === 1 && line.number > source.number && head === from &&
    doc.line(source.number).text.trimEnd() === source.text.slice(0, oldHead - source.from).trimEnd() &&
    next.body === source.text.slice(oldHead - source.from) && onlyChildrenBetween(before, doc, source, line, oldDepth);
  const moved = delta === 0 && old.indent !== next.indent && change.changes.touchesRange(source.from, source.to) &&
    source.text.slice(old.indent.length) === line.text.slice(next.indent.length);
  if ((!split && !moved) || !inMarkdown(before, source, old.indent)) return;

  if (split) {
    const stamp = formats.match(old.body);
    if (stamp && !old.body.slice(stamp.length).trim() && oldHead >= source.from + old.header.length + stamp.length) {
      const left = doc.line(source.number);
      const anchor = left.from + old.header.length;
      return { changes: [{ from: anchor, to: left.to }, { from: line.from - 1, to: line.to }], selection: { anchor } };
    }
  }
  const depth = countColumn(next.indent, before.tabSize);
  const current = formats.match(next.body)?.mode ?? null;
  if (moved && depth >= oldDepth) {
    if (depth > oldDepth && current && formats.settings.removeOnIndent) return atCursor(stampEdit(next.body, from, formats, null), head);
    return;
  }
  if (!formats.settings.inheritSiblings || (split && current)) return;
  const sibling = previousSibling(doc, line, depth, before.tabSize, formats);
  if (!sibling) return;
  const mode = formats.match(sibling.body)?.mode ?? null;
  if (mode !== current) return atCursor(stampEdit(next.body, from, formats, mode), head);
}

export const finishOutlineChange = StateEffect.define<null>();

export function outlineExtension(formats: TimeFormats) {
  const pendingMarker = StateField.define<EditorState | null>({
    create: () => null,
    update(value, tr) {
      if (!tr.docChanged) return tr.selection ? null : value;
      if (!eligible(tr) || tr.newDoc.lines !== tr.startState.doc.lines + 1) return null;
      const head = tr.startState.selection.main.head;
      const source = tr.startState.doc.lineAt(head);
      const next = tr.newDoc.lineAt(tr.newSelection.main.head);
      return next.number === source.number + 1 && next.from === tr.newSelection.main.head &&
        next.text === source.text.slice(head - source.from) && bullet(source.text, formats) ? tr.startState : null;
    },
  });
  const awaitingCaret = StateField.define<Transaction | null>({
    create: () => null,
    update(value, tr) {
      if (!tr.docChanged) return tr.selection || tr.effects.some(effect => effect.is(finishOutlineChange)) ? null : value;
      const delta = tr.newDoc.lines - tr.startState.doc.lines;
      return !tr.selection && eligible(tr) && (delta === 0 || delta === 1) ? tr : null;
    },
  });
  const filter = EditorState.transactionFilter.of(tr => {
    if (!eligible(tr) || (tr.docChanged && !tr.selection)) return tr;
    if (!tr.docChanged && !(tr.selection && !tr.annotation(Transaction.userEvent)) && !tr.effects.some(effect => effect.is(finishOutlineChange))) return tr;
    const change = tr.docChanged ? tr : tr.startState.field(awaitingCaret);
    if (!change) return tr;
    const start = change.startState;
    const pending = start.field(pendingMarker);
    const oldLine = start.doc.lineAt(start.selection.main.head);
    const nextLine = change.newDoc.lineAt(tr.newSelection.main.head);
    const completesMarker = pending && change.newDoc.lines === start.doc.lines && oldLine.from === start.selection.main.head &&
      nextLine.number === oldLine.number && bullet(nextLine.text, formats)?.body === oldLine.text;
    const edit = transition(completesMarker ? pending : start, change, tr.newSelection.main.head, formats);
    return edit ? [tr, { ...edit, sequential: true }] : tr;
  });
  const settleUnpairedChanges = EditorView.updateListener.of(({ docChanged, state, view }) => {
    const pending = docChanged && state.field(awaitingCaret);
    if (pending) queueMicrotask(() => {
      if (view.state.field(awaitingCaret, false) === pending) view.dispatch({ effects: finishOutlineChange.of(null) });
    });
  });
  return [pendingMarker, awaitingCaret, Prec.highest(filter), settleUnpairedChanges];
}
