import type { Mode, TimeFormats } from './time.ts';

export type Action = Mode | 'toggle' | 'end';
export type Edit = { from: number; to: number; insert: string };

export function taskPrefix(body: string, formats: TimeFormats) {
  const checkbox = /^\[[^\]]\] /.exec(body);
  return checkbox && !formats.match(body) ? checkbox[0] : '';
}

export function mapCursor(cursor: number, edit: Edit) {
  if (cursor < edit.from) return cursor;
  return edit.from + edit.insert.length + Math.max(0, cursor - edit.to);
}

export function stampEdit(body: string, from: number, formats: TimeFormats, mode: Mode | null): Edit {
  const length = formats.match(body)?.length ?? 0;
  const separator = length > 0 && body[length] === ' ' ? 1 : 0;
  return { from, to: from + length + separator, insert: mode ? formats.stamp(mode) + ' ' : '' };
}

export function commandEdit(action: Action, line: string, formats: TimeFormats): Edit {
  if (action === 'end') {
    let end = line.length;
    let match = formats.match(line, 'end');
    if (!match && /[ \t]$/.test(line)) {
      const trimmed = line.trimEnd();
      match = formats.match(trimmed, 'end');
      if (match) end = trimmed.length;
    }
    const from = end - (match?.length ?? 0);
    const space = !match && from > 0 && !/[ \t]/.test(line[from - 1]) ? ' ' : '';
    return { from, to: end, insert: space + formats.stamp('short') };
  }
  const indent = /^(?:[ \t]*> ?)*[ \t]*/.exec(line)![0];
  const marker = /^(?:[-+*]|\d+[.)]|#{1,6}) /.exec(line.slice(indent.length))?.[0] ?? '';
  let from = indent.length + marker.length;
  if (marker && !marker.startsWith('#')) from += taskPrefix(line.slice(from), formats).length;
  const body = line.slice(from);
  if (action !== 'toggle') return stampEdit(body, from, formats, action);
  if (formats.match(body)) return stampEdit(body, from, formats, null);
  return { from, to: from, insert: (marker ? '' : '- ') + formats.stamp('short') + ' ' };
}
