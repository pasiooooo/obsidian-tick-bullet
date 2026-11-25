# Time Bullet for Outlines

[English](#english) · [简体中文](#简体中文)

## English

In Obsidian, type `-` and press `Space` twice to insert the current time. Before typing text, each extra space switches formats: `- 12:34` ↔ `- 2026-01-01 12:34`.

| Key | Result |
| --- | --- |
| `Enter` after text | Start a sibling with the current time in the same format. |
| `Enter` after just the time | Clear the time, keeping the bullet. The next `Enter` is handled by Obsidian or Outliner. |
| `Tab` | Indent and remove the time by default. The text stays. |
| Outdent (`Shift+Tab` or Outliner’s `Enter` on an empty child) | Match the previous sibling at that level, even if it has no timestamp. |

- **Install:** In BRAT, choose **Add beta plugin** and enter `pasiooooo/obsidian-time-bullet`. Or extract the [release ZIP](https://github.com/pasiooooo/obsidian-time-bullet/releases/latest/download/obsidian-time-bullet.zip) into `.obsidian/plugins/`, reload, and enable **Time Bullet for Outlines**. Requires Obsidian 1.8.7 or later.
- **Settings → Time Bullet for Outlines:** Customize the [time formats](https://momentjs.com/docs/#/displaying/format/) (`HH:mm` / `YYYY-MM-DD HH:mm`), prefix and suffix. For example, `[` and `]` give `- [12:34] Note`.
- **Commands:** Search **Time Bullet** in the command palette to toggle a timed bullet or update a timestamp at the start or end of a line.
- **Local preview users (0.1.x):** Disable the preview before installing. To keep settings, copy only `data.json` from `outline-time-bullet` or `obsidian-time-bullet` into the new `time-bullet-outlines` folder, then reload and reassign hotkeys.

## 简体中文

在 Obsidian 中输入 `-`，连按两次空格即可插入当前时间。写正文前，每多按一次空格就切换一次格式：`- 12:34` ↔ `- 2026-01-01 12:34`。

| 按键 | 结果 |
| --- | --- |
| 写完正文按 `Enter` | 新建同级条目，用当前时间，沿用上一条的格式。 |
| 只有时间时按 `Enter` | 清除时间，保留列表项。再按一次，由 Obsidian 或 Outliner 处理空项。 |
| `Tab` | 缩进为子项，默认去掉时间，保留正文。 |
| 退级（`Shift+Tab`，或用 Outliner 在空子项按 `Enter`） | 沿用该层上一个同级条目的格式；上一条没写时间，这一条也不加。 |

- **安装**：在 BRAT 的 **Add beta plugin** 中输入 `pasiooooo/obsidian-time-bullet`；或将[发布页 ZIP](https://github.com/pasiooooo/obsidian-time-bullet/releases/latest/download/obsidian-time-bullet.zip) 解压到 `.obsidian/plugins/`，重载后启用 **Time Bullet for Outlines**。需要 Obsidian 1.8.7 或更高版本。
- **设置 → Time Bullet for Outlines**：可修改[时间格式](https://momentjs.com/docs/#/displaying/format/)（`HH:mm` / `YYYY-MM-DD HH:mm`）和前后缀。例如，前后缀填 `[` 和 `]`，条目就会显示为 `- [12:34] 正文`。
- **命令面板**：搜索 **Time Bullet**，可切换时间条目，或更新行首、行尾的时间。
- **从本地预览版（0.1.x）迁移**：先停用旧版，再安装。要保留设置，只需将旧目录 `outline-time-bullet` 或 `obsidian-time-bullet` 中的 `data.json` 复制到新目录 `time-bullet-outlines`，重载并重新绑定快捷键。

## Build / 构建

Node.js 22.18+: `npm ci && npm run lint && npm test && npm run build` · ZIP (PowerShell 7): `npm run package` · [Release checklist / 上架流程](docs/releasing.md) · [MIT](LICENSE)

## Acknowledgments / 致谢

- https://github.com/quorafind/Obsidian-New-Bullet-With-Time
- https://github.com/pedrogdn/obsidian-time-bullet-plugin
