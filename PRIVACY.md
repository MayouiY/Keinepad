# Privacy Policy / 隐私政策

_Last updated / 最后更新：2026-10-24_

[English](#english) · [简体中文](#简体中文)

## English

Keinepad ("the extension") is a browser extension that lets you view, edit and clear the
cookies, storage and caches of the web page you are currently looking at.

**Keinepad does not collect, store, transmit, sell or share any personal data.**

- **Everything stays in your browser.** The extension reads cookies, Local Storage,
  Session Storage, IndexedDB, Cache Storage and Service Worker registrations of the current
  site only when you open its popup or side panel, and only to display them to you. Changes
  and deletions happen only when you trigger them.
- **No network requests.** The extension does not contact any server, has no analytics,
  telemetry, advertising or tracking code, and does not load remote code.
- **No accounts.** There is no sign-in and no user identifier.
- **Exports are yours.** When you export data, it is copied to your clipboard or saved as a
  file on your device. Nothing is uploaded.
- **No browsing history.** The extension reads the address of the active tab only to know
  which site's data to show. It does not record or keep a list of visited pages.
- **No data saved by the extension.** Keinepad does not keep its own copy of any of the data
  it shows.

### Permissions

| Permission | Why it is needed |
| --- | --- |
| `cookies` | Read, create, edit and delete cookies of the current site. |
| `tabs` | Know the URL of the active tab, follow tab switches, and reload the page after clearing data. |
| `scripting` | Read and modify Local/Session Storage, IndexedDB, Cache Storage and Service Workers inside the current page, which are only reachable from the page itself. |
| `browsingData` | Clear the HTTP cache and other site data for the current origin. |
| `sidePanel` | Show the same interface in the browser side panel. |
| Host access to all sites | The user can open the extension on any website, so it needs access to that site's cookies and storage. Access is used only when the user opens the extension. |

### Data use

The extension's use of information complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements.

### Changes and contact

If this policy changes, the new version will be published in this file with an updated date.
Questions can be asked through [GitHub Issues](https://github.com/MayouiY/Keinepad/issues).

## 简体中文

Keinepad（以下简称“本扩展”）是一个用于查看、编辑和清除当前网页 Cookie、存储与缓存的浏览器扩展。

**本扩展不收集、不存储、不传输、不出售、不共享任何个人数据。**

- **所有操作都在本地浏览器内完成。** 只有在你打开弹出窗口或侧边栏时，本扩展才会读取当前站点的
  Cookie、Local Storage、Session Storage、IndexedDB、Cache Storage 和 Service Worker 注册信息，
  且仅用于向你展示。修改和删除只会在你主动操作时发生。
- **不发起任何网络请求。** 本扩展不连接任何服务器，不包含统计、遥测、广告或跟踪代码，也不加载远程代码。
- **无账号。** 没有登录，也没有任何用户标识。
- **导出的数据归你所有。** 导出时数据只会复制到剪贴板或保存为你设备上的文件，不会上传。
- **不记录浏览历史。** 本扩展读取当前标签页的地址只是为了确定要显示哪个站点的数据，不会记录或保存访问过的页面。
- **不保存数据副本。** 本扩展不会另外保存其显示的任何数据。

### 权限

| 权限 | 用途 |
| --- | --- |
| `cookies` | 读取、新增、编辑、删除当前站点的 Cookie |
| `tabs` | 获取当前标签页的 URL、跟随标签页切换、清除数据后刷新页面 |
| `scripting` | 在当前页面中读取 / 修改 Local Storage、Session Storage、IndexedDB、Cache Storage 和 Service Worker（这些数据只能在页面内访问） |
| `browsingData` | 按当前源清除 HTTP 缓存及其他站点数据 |
| `sidePanel` | 在浏览器侧边栏中显示同样的界面 |
| 访问所有网站 | 用户可以在任意网站上打开本扩展，因此需要访问该站点的 Cookie 与存储。仅在用户打开扩展时使用。 |

### 数据使用

本扩展对信息的使用遵守
[Chrome 应用商店用户数据政策](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)，
包括其中的“有限使用”要求。

### 变更与联系

如本政策有变更，新版本将发布在此文件中并更新日期。如有疑问，请在
[GitHub Issues](https://github.com/MayouiY/Keinepad/issues) 中提出。
