# 更新日志

发布时，`## v<版本>` 小节会自动成为对应 GitHub Release 的正文，并显示在扩展的“更新说明”里。

## v0.2.0 - 2026-11-04

首个公开发布版本，适用于 Chrome / Edge / Brave / Arc / Opera 等 Chromium 内核浏览器（版本 ≥ 128）。

**Cookies**
- 列出当前站点（含父域名与子域名）的全部 Cookie，包括 HttpOnly 与分区 Cookie（CHIPS），并标记哪些会随当前 URL 发送
- 新增、编辑、删除、批量删除；保存前校验 `SameSite=None` 需 Secure、`__Host-` / `__Secure-` 前缀等规则
- 值预览：URL 解码、JSON 格式化、JWT 解码
- 复制为 `Cookie:` 请求头，JSON 导出 / 导入

**站点数据**
- Local Storage / Session Storage：查看、搜索、编辑、删除、导出
- IndexedDB、Cache Storage、Service Worker：查看与删除；按当前源清除 HTTP 缓存
- 一键清除站点数据，可选清除后强制刷新页面
- 所有导出操作都可以选择导出到剪贴板或导出为文件

**页面编码**
- 页面乱码时，可在右键菜单“页面编码”或面板顶部切换字符编码（UTF-8、GBK / GB18030、Big5、Shift_JIS、EUC-KR、Windows-125x 等）

**检查更新**
- 手动安装的版本每 12 小时左右检查一次 GitHub Releases，有新版本时在工具栏图标和弹窗中提示

**界面**
- 工具栏弹窗 + 侧边栏，自动适配浅色 / 深色主题，支持简体中文 / English / 日本語

**安装**：下载 `keinepad-0.2.0.zip` 并解压到一个固定的文件夹，在 `chrome://extensions`（Edge 为 `edge://extensions`）打开“开发者模式”，点击“加载已解压的扩展程序”，选择解压出的文件夹。详细步骤见 [README](https://github.com/MayouiY/Keinepad#安装)。
