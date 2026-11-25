export const patterns = { short: 'HH:mm', long: 'YYYY-MM-DD HH:mm' } as const;
export type Mode = keyof typeof patterns;

export const defaults = {
  shortFormat: '', longFormat: '', prefix: '', suffix: '', removeOnIndent: true, inheritSiblings: true,
};
export type Settings = typeof defaults;

export function readSettings(saved: unknown): Settings {
  const settings = { ...defaults };
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return settings;
  const record = saved as Record<string, unknown>;
  for (const key of ['shortFormat', 'longFormat', 'prefix', 'suffix'] as const) {
    const value = record[key];
    if (typeof value === 'string') settings[key] = value;
  }
  for (const key of ['removeOnIndent', 'inheritSiblings'] as const) {
    const value = record[key];
    if (typeof value === 'boolean') settings[key] = value;
  }
  return settings;
}

interface Clock {
  (): { format(pattern: string): string };
  (input: string, pattern: string, strict: true): { isValid(): boolean; parsingFlags(): { charsLeftOver: number } };
}

export class TimeFormats {
  readonly settings: Settings;
  private readonly clock: Clock;

  constructor(settings: Settings, clock: Clock) {
    this.settings = settings;
    this.clock = clock;
  }

  pattern(mode: Mode) {
    const custom = this.settings[`${mode}Format`];
    return custom.trim() ? custom : patterns[mode];
  }

  stamp(mode: Mode) {
    return this.settings.prefix + this.clock().format(this.pattern(mode)) + this.settings.suffix;
  }

  match(text: string, edge: 'start' | 'end' = 'start') {
    const { prefix, suffix } = this.settings;
    const available = text.length - prefix.length - suffix.length;
    if (available < 1 || (edge === 'start' ? !text.startsWith(prefix) : !text.endsWith(suffix))) return null;
    let best: { mode: Mode; length: number } | null = null;
    for (const mode of ['short', 'long'] as const) {
      const pattern = this.pattern(mode);
      const fixed = pattern === patterns.short ? 5 : pattern === patterns.long ? 16 : 0;
      let max = fixed || available;
      if (!fixed && edge === 'start') {
        const rest = text.slice(prefix.length);
        const unused = this.clock(rest, pattern, true).parsingFlags().charsLeftOver;
        max = Math.max(rest.length - unused, this.clock().format(pattern).length);
      }
      for (let width = Math.min(max, available); width >= (fixed || 1); width--) {
        const length = prefix.length + width + suffix.length;
        if (best && length <= best.length) break;
        const start = edge === 'start' ? 0 : text.length - length;
        const end = start + length;
        if (start > 0 && !/[ \t]/.test(text[start - 1])) continue;
        if (end < text.length && !/[ \t]/.test(text[end])) continue;
        if (!text.startsWith(prefix, start) || !text.startsWith(suffix, end - suffix.length)) continue;
        const value = text.slice(start + prefix.length, end - suffix.length);
        if (this.clock(value, pattern, true).isValid() || (!fixed && this.clock().format(pattern) === value)) {
          best = { mode, length };
          break;
        }
      }
    }
    return best;
  }
}
