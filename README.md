# keinepad
查看、编辑、删除当前网页的 Cookie 与缓存。像慧音改写历史一样，轻松掌控网站数据。

Keinepad 是一个 Chromium 内核浏览器（Chrome / Edge / Brave / Arc / Opera 等，版本 ≥ 116）扩展，
用可视化面板管理当前站点的 Cookie、本地存储和各类缓存，减少前端开发中“缓存没清干净”“Cookie 不对”带来的排查成本。

## 功能

**Cookies**
- 列出当前站点（含父域名与子域名）的全部 Cookie，包括 HttpOnly 与分区 Cookie（CHIPS）
- 标记哪些 Cookie 会随当前 URL 发送，可一键只看这些
- 新增 / 编辑 / 删除 / 批量删除；支持修改 名称、值、域名、路径、过期时间、Secure、HttpOnly、SameSite、Partitioned
- 保存前校验 `SameSite=None` 需 Secure、`__Host-` / `__Secure-` 前缀规则等
- 值预览：URL 解码、JSON 格式化、JWT 解码（显示过期时间）
- 复制为 `Cookie:` 请求头，JSON 导出 / 导入（兼容常见 Cookie 编辑器格式）
- Cookie 变化实时刷新

**Local Storage / Session Storage**
- 键值列表、搜索、新增、编辑（JSON 格式化 / 压缩）、删除、清空、导出

**缓存与数据库**
- IndexedDB：列出数据库、版本、对象仓库及记录数，可删除
- Cache Storage：列出缓存及其中的请求 URL，可删除单条或整个缓存
- Service Worker：列出注册信息与状态，可注销
- HTTP 缓存：按当前源清除，支持强制刷新（忽略缓存）

**一键清除站点数据**：勾选要清除的类型（Cookie / Local Storage / Session Storage / IndexedDB / Cache Storage / Service Worker / HTTP 缓存），可选清除后强制刷新页面。

**界面**：工具栏 Popup + 侧边栏（Side Panel，跟随当前标签页切换），自动适配浅色 / 深色主题；
界面语言根据浏览器语言自动切换为 简体中文 / English / 日本語。

## 安装（开发版）

```bash
npm install
npm run build
```

打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启“开发者模式”，点击“加载已解压的扩展程序”，选择 `dist/` 目录。

开发时可以运行 `npm run dev`（`vite build --watch`），修改后在扩展管理页点击刷新即可。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `cookies` | 读取与修改 Cookie |
| `tabs` | 获取当前标签页的 URL，跟随标签页切换 |
| `scripting` | 在当前页面读取 / 修改 localStorage、sessionStorage、IndexedDB、Cache Storage、Service Worker |
| `browsingData` | 按站点清除 HTTP 缓存及其他站点数据 |
| `sidePanel` | 侧边栏视图 |
| `storage` | 预留给扩展自身设置 |
| `<all_urls>` | 访问任意站点的 Cookie 并在页面中执行上述读取 |

扩展不会收集或上传任何数据，所有操作只在本地浏览器中进行。

## 项目结构

```
public/manifest.json         MV3 清单
public/_locales/             i18n 文案（由 scripts/messages.py 生成）
src/background/              Service Worker
src/popup/ src/sidepanel/    两个入口，共用 src/ui/App.vue
src/ui/components/           Cookie 列表与编辑器、Storage 列表、缓存面板、清除对话框等
src/services/                chrome.cookies / scripting / browsingData 封装
src/utils/                   纯函数工具（含单元测试）
scripts/e2e.mjs              Playwright 端到端测试
```

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run build` | 构建到 `dist/` |
| `npm run dev` | 监听构建 |
| `npm run typecheck` | `vue-tsc` 类型检查 |
| `npm test` | Vitest 单元测试 |
| `npm run e2e` | 在 Chromium 中加载 `dist/` 跑端到端测试并截图到 `.e2e/`（需要全局可用的 Playwright） |
| `npm run messages` | 由 `scripts/messages.py` 重新生成三语文案 |
| `npm run icons` | 由 `public/icons/icon.png` 缩放出各尺寸 PNG 图标 |
