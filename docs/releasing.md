# 发布与上架

1. **准备版本。** 仓库的默认分支须包含源码、`README.md`、`LICENSE`、`manifest.json` 和 `versions.json`。`time-bullet-outlines` 是安装 ID，不是仓库名。每次正式发布同步更新 manifest、npm 版本及锁文件，并在 `versions.json` 记录最低 Obsidian 版本。
2. **验证并打包。** 使用 Node.js 22.18+ 和 PowerShell 7，依次运行 `npm ci`、`npm run lint`、`npm test`、`npm run package`。手动安装 ZIP 内层目录须与 manifest 的 ID 相同。
3. **发布 GitHub Release。** 标签和发布标题均使用 manifest 的版本号（如 `0.0.1`，无 `v`）。从同一提交构建，单独上传 `main.js`、`manifest.json`，以及存在时的 `styles.css`。`dist/obsidian-time-bullet.zip` 仅供手动安装，不能代替独立附件。正式版不要标为预发布。
4. **验证 BRAT。** 用 BRAT 添加 `pasiooooo/obsidian-time-bullet`，选择 Latest 或指定版本。它从 Release 下载独立附件；不需要额外的 `manifest-beta.json`。
5. **首次提交市场。** 维护者登录 [Obsidian Community](https://community.obsidian.md)，绑定自己的 GitHub 账号，进入 **Plugins → New plugin**，填写仓库 URL 并确认开发者政策与维护承诺。按页面反馈修正问题并选择 **Publish**。发布 GitHub Release 不等于已上架，不需要向旧目录 JSON 提 PR。

官方文档：[提交指南](https://docs.obsidian.md/plugins/releasing/submit-plugin) · [Manifest](https://docs.obsidian.md/Reference/Manifest) · [审核要求](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins) · [开发者政策](https://docs.obsidian.md/community-directory/developer-policies) · [BRAT 开发者指南](https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md)
