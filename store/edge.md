# Microsoft Edge 加载项上架资料

Edge 加载项（Microsoft Edge Add-ons）通过 [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) 提交。
Keinepad 是标准的 Manifest V3 扩展，**和 Chrome 用同一个 zip，不需要改代码**。
大部分文案和图片与 Chrome 共用，本文只列出 Edge 后台各页面要填什么。

## 一、准备

- 注册 [Partner Center 开发者账号](https://partner.microsoft.com/dashboard/registration)（Edge 加载项计划，个人账号免费）。
- 打包：与 Chrome 相同，推送 `v<版本>` tag 后从 GitHub Release 下载 `keinepad-<版本>.zip`，或按 [`README.md`](README.md) 的“一、打包”本地打包。
- 每次更新都要提升 `manifest.json` 的 `version`，且版本号不能低于已提交过的版本。

## 二、Packages（程序包）

上传 zip。后台会读取 manifest 中的名称、说明和 `_locales`，自动识别出 English / 简体中文 / 日本語 三种语言。

## 三、Availability（可用性）

- **Visibility**：Public（公开）
- **Markets**：全部市场（默认全选）

## 四、Properties（属性）

| 字段 | 填写内容 |
| --- | --- |
| Category | Developer tools |
| Privacy policy requirements | 选 **Yes**：扩展会读取网站 Cookie 等数据（虽然只在本地处理），选 Yes 并提供隐私政策最稳妥 |
| Privacy policy URL | `https://github.com/MayouiY/Keinepad/blob/main/PRIVACY.md` |
| Website URL | `https://github.com/MayouiY/Keinepad` |
| Support contact details | `https://github.com/MayouiY/Keinepad/issues` |
| Mature content | 不勾选 |

## 五、Store listings（商店详情）

每种语言（en、zh-CN、ja）分别填写一份：

| 字段 | 要求 | 来源 |
| --- | --- | --- |
| Description | 250～10000 字符 | 复制 [`listing.md`](listing.md) 中对应语言的“详细说明”（均超过 250 字符） |
| Short description | 可选（后台有这一栏时填写） | 复制 `listing.md` 中对应语言的“简短说明” |
| Extension Store logo | 必填，1:1，至少 128×128，建议 300×300 | [`assets/edge-logo-300x300.png`](assets/edge-logo-300x300.png) |
| Small promotional tile | 可选，440×280 | [`assets/promo-small-440x280.jpg`](assets/promo-small-440x280.jpg) |
| Large promotional tile | 可选，1400×560 | [`assets/promo-marquee-1400x560.jpg`](assets/promo-marquee-1400x560.jpg) |
| Screenshots | 可选，最多 10 张，640×480 或 1280×800 | `assets/<语言>/screenshot-1.jpg` ~ `screenshot-4.jpg`（zh-CN 用 `zh_CN` 目录） |
| YouTube video URL | 可选 | 留空 |
| Search terms | 可选，最多 7 个，每个不超过 30 字符，合计不超过 21 个词 | 见下 |

**Search terms**

- English：`cookie editor`、`clear cache`、`local storage`、`indexeddb`、`site data`、`developer tools`、`jwt decoder`
- 简体中文：`cookie 编辑`、`清除缓存`、`本地存储`、`indexeddb`、`站点数据`、`开发者工具`、`jwt 解码`
- 日本語：`cookie 編集`、`キャッシュ削除`、`ローカルストレージ`、`indexeddb`、`サイトデータ`、`開発者ツール`、`jwt デコード`

## 六、Notes for certification（给审核员的说明）

提交页最后有一栏给审核员的备注，不对外显示。可直接粘贴：

```text
Keinepad has no account, no server and no network requests. To test:
1. Open any website, e.g. https://www.bing.com, and sign in or accept cookies so the site has some data.
2. Click the Keinepad toolbar icon. The Cookies tab lists the site's cookies; click one to edit it, or use "+ Add" to create one.
3. The Local Storage / Session Storage tabs list web storage entries of the page.
4. The "Cache & DB" tab lists IndexedDB databases, Cache Storage and Service Workers, and can clear the HTTP cache.
5. "Clear site data" (red button) lets you choose data types to delete for the current site.
6. The side panel button in the header opens the same UI in the Edge sidebar.
7. Page encoding: right-click any web page → "Page encoding" → pick e.g. "Chinese Simplified (GBK / GB2312)", or use the encoding dropdown in the popup header. The page reloads decoded with that encoding; "Auto-detect" restores the default.

Permissions: cookies (read/edit cookies of the current site), tabs (URL of the active tab), scripting (read/modify web storage, IndexedDB, Cache Storage and Service Workers inside the current page), browsingData (clear HTTP cache for the current origin), sidePanel (sidebar UI), contextMenus ("Page encoding" right-click menu), declarativeNetRequestWithHostAccess (when the user picks a page encoding, a session rule limited to that tab and site sets the charset of the page's Content-Type response header; nothing is blocked or redirected), host access to all sites (the user can inspect any site they open).
The code contains an update check against the GitHub Releases API (api.github.com). It only runs for copies installed manually without a store (no update_url in the installed manifest), so the Add-ons version never makes this request and is updated by the store.
Browser internal pages (edge://) and the Add-ons store cannot be inspected; this is expected.
Privacy policy: https://github.com/MayouiY/Keinepad/blob/main/PRIVACY.md
```

## 七、审核与发布

- 审核一般需要几个工作日，最长可能 7 个工作日；进度在 Partner Center 的 Overview 页查看。
- 通过后，扩展会出现在 `https://microsoftedge.microsoft.com/addons/` 上。之后可以把商店链接补进根目录 README 的“安装”一节。
- 发布更新：上传新版本 zip，然后点击 **Publish**，同样需要重新审核。
- 被拒时，邮件里会说明原因。最常见的原因是说明文字与实际功能不符、权限理由不清楚，或缺少隐私政策。
