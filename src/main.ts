import { getLanguage, moment, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { commandEdit, mapCursor } from './commands.ts';
import type { Action } from './commands.ts';
import { labelsFor } from './i18n.ts';
import { outlineExtension } from './outline.ts';
import { defaults, patterns, readSettings, TimeFormats } from './time.ts';
import type { Mode, Settings } from './time.ts';

export default class TickBullet extends Plugin {
  settings: Settings = { ...defaults };
  formats = new TimeFormats(this.settings, moment);

  async onload() {
    Object.assign(this.settings, readSettings(await this.loadData()));
    this.registerEditorExtension(outlineExtension(this.formats));
    this.addSettingTab(new TickBulletSettings(this));
    const { commands } = labelsFor(getLanguage());
    this.registerAction('toggle-timestamp', commands.toggle, 'toggle');
    this.registerAction('short-time-at-start', commands.short, 'short');
    this.registerAction('long-time-at-start', commands.long, 'long');
    this.registerAction('short-time-at-end', commands.end, 'end');
  }

  private registerAction(id: string, name: string, action: Action) {
    this.addCommand({ id, name, editorCheckCallback: (checking, editor) => {
      if (editor.listSelections().length !== 1 || editor.somethingSelected()) return false;
      if (!checking) {
        const { line, ch } = editor.getCursor();
        const edit = commandEdit(action, editor.getLine(line), this.formats);
        editor.transaction({
          changes: [{ from: { line, ch: edit.from }, to: { line, ch: edit.to }, text: edit.insert }],
          selection: { from: { line, ch: mapCursor(ch, edit) } },
        });
      }
      return true;
    } });
  }
}

class TickBulletSettings extends PluginSettingTab {
  private readonly owner: TickBullet;

  constructor(plugin: TickBullet) {
    super(plugin.app, plugin);
    this.owner = plugin;
  }

  getSettingDefinitions() {
    const { owner } = this;
    const labels = labelsFor(getLanguage());
    const rows: { name: string; desc: string; render: (row: Setting) => void }[] = [];
    const previews = new Map<Mode, Setting>();
    const refresh = () => previews.forEach((row, mode) => {
      row.setDesc(labels.preview(owner.formats.stamp(mode)));
    });
    for (const mode of ['short', 'long'] as const) {
      const key = `${mode}Format` as const;
      rows.push({ name: labels[key], desc: labels.preview(owner.formats.stamp(mode)), render(row) {
        previews.set(mode, row);
        row.addText(field => field.setPlaceholder(patterns[mode]).setValue(owner.settings[key]).onChange(async value => {
          owner.settings[key] = value;
          refresh();
          await owner.saveData(owner.settings);
        }));
      } });
    }
    for (const key of ['prefix', 'suffix'] as const) {
      rows.push({ name: labels[key], desc: key === 'prefix' ? labels.prefixHint : labels.suffixHint, render(row) {
        row.addText(field => field.setPlaceholder(labels.none).setValue(owner.settings[key]).onChange(async value => {
          owner.settings[key] = value;
          refresh();
          await owner.saveData(owner.settings);
        }));
      } });
    }
    for (const [key, description] of [
      ['removeOnIndent', labels.removeHint], ['inheritSiblings', labels.inheritHint],
    ] as const) {
      rows.push({ name: labels[key], desc: description, render(row) {
        row.addToggle(toggle => toggle.setValue(owner.settings[key]).onChange(async value => {
          owner.settings[key] = value;
          await owner.saveData(owner.settings);
        }));
      } });
    }
    return rows;
  }

  display() {
    this.containerEl.empty();
    for (const { name, desc, render } of this.getSettingDefinitions()) {
      render(new Setting(this.containerEl).setName(name).setDesc(desc));
    }
  }
}
