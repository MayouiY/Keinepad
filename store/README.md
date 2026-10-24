# Chrome 应用商店上架资料

本目录收集了把 Keinepad 提交到 [Chrome 应用商店](https://chrome.google.com/webstore/devconsole) 所需的全部资料。
提交前按下面的清单逐项填写即可。

| 文件 | 用途 |
| --- | --- |
| [`listing.md`](listing.md) | 三种语言的名称、简短说明、详细说明，以及类别 |
| [`assets/`](assets) | 商店截图（每种语言 4 张，1280×800）与宣传图块（440×280、1400×560） |
| [`../PRIVACY.md`](../PRIVACY.md) | 隐私政策（中英双语），后台需要填写它的 URL |

## 一、打包

```bash
npm ci
npm run typecheck && npm test
npm run build
cd dist && zip -r ../keinepad-$(node -p "require('../package.json').version").zip . && cd ..
```

上传的 zip 根目录必须直接是 `manifest.json`（即压缩 `dist/` 的内容，而不是 `dist/` 目录本身）。
每次重新提交都需要提升 `public/manifest.json` 中的 `version`（同时同步 `package.json`）。

## 二、商品详情（Store listing）

- **说明 / 类别 / 语言**：见 [`listing.md`](listing.md)。
- **图标**：使用打包内的 `icons/icon-128.png`，无需另外上传。
- **截图**：从 [`assets/`](assets) 中按语言上传 `screenshot-1.jpg` ~ `screenshot-4.jpg`（商店最多 5 张，至少 1 张，尺寸 1280×800）。
- **小型宣传图块（必填）**：`assets/promo-small-440x280.jpg`。
- **顶部宣传图块（可选）**：`assets/promo-marquee-1400x560.jpg`。
- **官方网址 / 首页网址**：`https://github.com/MayouiY/Keinepad`
- **支持网址**：`https://github.com/MayouiY/Keinepad/issues`

截图与宣传图由脚本生成，界面改版后可重新生成：

```bash
npm run build && npm run store-assets   # 需要全局可用的 Playwright，输出到 store/assets/
```

## 三、隐私权规范（Privacy practices）

后台“隐私权”标签页的每一项都必须填写，否则无法提交审核。以下内容可直接粘贴。

### 单一用途（Single purpose）

> Keinepad lets the user view, edit and clear the cookies, web storage and caches of the website in the current tab.

### 权限理由（Permission justification）

| 权限 | 填写内容 |
| --- | --- |
| `cookies` | Used to list, create, edit and delete the cookies of the website open in the current tab, which is the core feature of the extension. |
| `tabs` | Used to read the URL of the active tab so the extension knows which site's data to show, to follow tab switches in the side panel, and to reload the page after the user clears site data. |
| `scripting` | Local Storage, Session Storage, IndexedDB, Cache Storage and Service Worker registrations are only reachable from inside the page. The extension injects a small function into the current tab, only when the user opens the extension, to read or modify them on the user's request. |
| `browsingData` | Used to clear the HTTP cache and other site data of the current origin when the user clicks "Clear site data". |
| `sidePanel` | Provides the same interface in the browser side panel so it can stay open while the user browses. |
| 主机权限 `<all_urls>` | The user can open the extension on any website, and must be able to inspect that website's cookies and storage. Host access is required by the cookies and scripting APIs for each site. Data is only accessed when the user opens the extension, and never leaves the browser. |

### 远程代码（Remote code）

选择 **No, I am not using remote code**。所有 JavaScript 都打包在扩展内，不使用 `eval`，也不从网络加载脚本。

### 数据使用（Data usage）

- “收集哪些用户数据”：**全部不勾选**。扩展会在本地读取 Cookie 与存储用于展示，但不会把任何数据发送出浏览器，按商店定义不属于“收集”。
- 三项承诺全部勾选：
  - I do not sell or transfer user data to third parties, outside of the approved use cases
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  - I do not use or transfer user data to determine creditworthiness or for lending purposes
- **隐私政策网址**：`https://github.com/MayouiY/Keinepad/blob/main/PRIVACY.md`

## 四、分发（Distribution）

- 付费：免费
- 公开范围：公开（Public）
- 地区：所有地区

## 五、提交前自查

- [ ] `manifest.json` 中 `version` 已提升，且与 `package.json` 一致
- [ ] `npm run typecheck`、`npm test`、`npm run e2e` 均通过
- [ ] zip 根目录直接包含 `manifest.json`，不含 `node_modules`、源码映射等多余文件
- [ ] 开发者账号已完成注册费支付与邮箱验证
- [ ] 隐私政策链接在未登录状态下可以打开（仓库需为公开）
- [ ] 截图与当前界面一致

## 审核注意事项

- `<all_urls>` 属于宽泛的主机权限，审核通常会更久（可能数天到数周），在权限理由中写清楚“用户可以在任意网站上打开”很重要。
- 商店会拒绝声明了却没有使用的权限。若以后去掉某项功能，记得同步删掉对应权限。
- 图标角色为东方 Project 的二次创作形象。东方 Project 的同人创作指南允许非商业的同人作品，本扩展免费分发；
  如果审核以知识产权为由提出疑问，可在申诉中说明这一点，或换用原创图标。
