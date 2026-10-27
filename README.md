# keinepad
查看、编辑、删除当前网页的 Cookie 与缓存。像慧音改写历史一样，轻松掌控网站数据。

Keinepad 是一个 Chromium 内核浏览器（Chrome / Edge / Brave / Arc / Opera 等，版本 ≥ 128）扩展，
用可视化面板管理当前站点的 Cookie、本地存储和各类缓存，减少前端开发中“缓存没清干净”“Cookie 不对”带来的排查成本。

## 功能

**Cookies**
- 列出当前站点（含父域名与子域名）的全部 Cookie，包括 HttpOnly 与分区 Cookie（CHIPS）
- 标记哪些 Cookie 会随当前 URL 发送，可一键只看这些
- 新增 / 编辑 / 删除 / 批量删除；支持修改 名称、值、域名、路径、过期时间、Secure、HttpOnly、SameSite、Partitioned
- 保存前校验 `SameSite=None` 需 Secure、`__Host-` / `__Secure-` 前缀规则等
- 值预览：URL 解码、JSON 格式化、JWT 解码（显示过期时间）
- 复制为 `Cookie:` 请求头，JSON 导出 / 导入（兼容常见 Cookie 编辑器格式）
- 所有导出操作都可选择“导出到剪贴板”或“导出为文件”
- Cookie 变化实时刷新

**Local Storage / Session Storage**
- 键值列表、搜索、新增、编辑（JSON 格式化 / 压缩）、删除、清空、导出

**缓存与数据库**
- IndexedDB：列出数据库、版本、对象仓库及记录数，可删除
- Cache Storage：列出缓存及其中的请求 URL，可删除单条或整个缓存
- Service Worker：列出注册信息与状态，可注销
- HTTP 缓存：按当前源清除，支持强制刷新（忽略缓存）

**页面编码**：页面出现乱码时，可在右键菜单“页面编码”或面板顶部的编码下拉框中改用其他字符编码重新加载页面，
覆盖 UTF-8 / UTF-16、GBK（GB2312）/ GB18030、Big5、Shift_JIS / EUC-JP / ISO-2022-JP、EUC-KR、Windows-125x、ISO-8859-x、KOI8-R / KOI8-U 等常用编码。
设置对当前标签页中的当前站点生效（在站内跳转时保持），关闭标签页或重启浏览器后恢复自动检测。

**一键清除站点数据**：勾选要清除的类型（Cookie / Local Storage / Session Storage / IndexedDB / Cache Storage / Service Worker / HTTP 缓存），可选清除后强制刷新页面。

**界面**：工具栏 Popup + 侧边栏（Side Panel，跟随当前标签页切换），自动适配浅色 / 深色主题；
界面语言根据浏览器语言自动切换为 简体中文 / English / 日本語。

## 安装

### 方式一：Chrome 应用商店

上架后可直接在 Chrome 应用商店搜索 “Keinepad” 安装，之后会自动更新。Edge、Brave、Arc、Opera 等浏览器也可以从 Chrome 应用商店安装（Edge 需在页面顶部点击“允许来自其他应用商店的扩展”）。

### 方式二：下载发布包手动安装（不通过商店）

适合暂时无法访问商店，或想使用尚未上架的新版本的情况。

1. 打开 [GitHub Releases](https://github.com/MayouiY/Keinepad/releases)，在最新版本的 Assets 中下载 `keinepad-<版本>.zip`。
2. 把 zip **解压**到一个固定的文件夹，例如 `D:\Extensions\keinepad`（之后浏览器会一直从这里读取扩展，请不要删除或移动它）。
3. 在地址栏打开扩展管理页：
   - Chrome / Brave / Arc：`chrome://extensions`
   - Edge：`edge://extensions`
   - Opera：`opera://extensions`
4. 打开右上角（Edge 在左下角）的 **开发者模式** 开关。
5. 点击 **加载已解压的扩展程序**，选择第 2 步解压出的文件夹（里面直接能看到 `manifest.json` 的那一层）。
6. 点击浏览器工具栏的拼图图标，把 Keinepad 固定到工具栏，方便使用。

注意事项：

- 不能把 zip 文件直接拖进扩展页面安装，必须先解压。
- 手动安装的版本 **不会自动更新**。更新时下载新的 zip，解压覆盖原文件夹，然后在扩展管理页点击 Keinepad 卡片上的刷新按钮即可，Cookie 等数据不受影响。
- 浏览器启动时可能会提示“请停用以开发者模式运行的扩展程序”，点击关闭即可，扩展会继续工作。
- 部分公司或学校统一管理的浏览器禁用了开发者模式，这种情况下只能通过商店安装。

### 方式三：从源码构建

需要 Node.js 20.19 及以上版本（Vite 7 的要求）。

```bash
git clone https://github.com/MayouiY/Keinepad.git
cd Keinepad
npm ci
npm run build
```

然后按方式二的第 3～6 步加载生成的 `dist/` 目录。

开发时可以运行 `npm run dev`（`vite build --watch`），修改后在扩展管理页点击刷新即可。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `cookies` | 读取与修改 Cookie |
| `tabs` | 获取当前标签页的 URL，跟随标签页切换 |
| `scripting` | 在当前页面读取 / 修改 localStorage、sessionStorage、IndexedDB、Cache Storage、Service Worker |
| `browsingData` | 按站点清除 HTTP 缓存及其他站点数据 |
| `sidePanel` | 侧边栏视图 |
| `contextMenus` | 右键菜单中的“页面编码” |
| `declarativeNetRequestWithHostAccess` | 切换页面编码时改写当前标签页页面响应头 `Content-Type` 中的 charset |
| `<all_urls>` | 访问任意站点的 Cookie 并在页面中执行上述读取 |

扩展不会收集或上传任何数据，所有操作只在本地浏览器中进行，详见 [隐私政策](PRIVACY.md)。

## 上架应用商店

商店文案（中 / 英 / 日）、截图与宣传图、隐私权规范的填写内容以及打包步骤都在 [`store/`](store/README.md) 目录中：

- Chrome 应用商店：[`store/README.md`](store/README.md)
- Microsoft Edge 加载项：[`store/edge.md`](store/edge.md)

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
scripts/store-assets.mjs     生成商店截图与宣传图
store/                       Chrome / Edge 商店上架资料
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
| `npm run store-assets` | 基于 `dist/` 生成商店截图、宣传图与 Edge 徽标到 `store/assets/`（需要全局可用的 Playwright） |

## 发布

推送 `v` 开头的 tag 会触发 `.github/workflows/release.yml`：类型检查、单元测试、构建，然后把 `dist/` 打包成 `keinepad-<版本>.zip`，上传到对应的 GitHub Release（同时保留为 Actions 构建产物）。这个 zip 可以直接上传到 Chrome 应用商店 / Edge 加载项后台。

tag 版本必须和 `public/manifest.json`、`package.json` 里的 `version` 一致，否则工作流会失败。发布步骤：

```sh
# 先把 manifest.json 和 package.json 的 version 改成 0.2.0 并提交
git tag v0.2.0
git push origin v0.2.0
```
