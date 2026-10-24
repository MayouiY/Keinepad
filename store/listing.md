# 商店文案（Store listing）

在 Chrome 应用商店开发者后台的“商品详情 → 商店详情”中，按语言分别粘贴下列内容。
扩展名称与简短说明由 `_locales/*/messages.json` 中的 `extName` / `extDescription` 提供，
后台会自动读取，不需要在这里填写；如需修改请改 `scripts/messages.py` 后运行 `npm run messages`。

- 默认语言：English（与 `manifest.json` 的 `default_locale` 一致）
- 其他语言：简体中文（zh_CN）、日本語（ja）
- 类别（Category）：Developer Tools（开发者工具）

---

## English

**Name:** Keinepad - Cookie & Cache Editor

**Summary (≤132 chars):** View, edit and clear cookies, storage and caches of the current site.

**Description:**

```text
Keinepad is a cookie and site data editor for the page you are on. Open it from the toolbar or the side panel to see everything the current site has stored in your browser, change it, or wipe it clean in one click. It is made for web developers, testers and anyone who is tired of "did the cache really clear?".

COOKIES
• All cookies of the current site, including parent domains and subdomains
• HttpOnly and partitioned (CHIPS) cookies are shown too
• See which cookies are sent with the current URL, or filter to only those
• Add, edit, delete and bulk-delete cookies; edit name, value, domain, path, expiry, Secure, HttpOnly, SameSite and Partitioned
• Validation before saving: SameSite=None requires Secure, __Host- / __Secure- prefix rules, and more
• Value preview: URL decoding, JSON formatting, JWT decoding with expiry time
• Copy as a Cookie: request header, export and import JSON (compatible with common cookie editor formats)
• The list refreshes live when cookies change

LOCAL STORAGE / SESSION STORAGE
• Browse, search, add, edit (format or minify JSON), delete, clear and export key–value pairs

CACHES AND DATABASES
• IndexedDB: databases, versions, object stores and record counts; delete databases
• Cache Storage: caches and the request URLs inside them; delete entries or whole caches
• Service Workers: registrations and their state; unregister
• HTTP cache: clear it for the current origin, or hard-reload the page

CLEAR SITE DATA IN ONE CLICK
Pick which data types to clear (cookies, Local Storage, Session Storage, IndexedDB, Cache Storage, Service Workers, HTTP cache) and optionally reload the page afterwards.

EXPORT YOUR WAY
Every export can be copied to the clipboard or saved as a file.

COMFORTABLE TO USE
• Toolbar popup and side panel (the side panel follows the active tab)
• Light and dark theme follow your system
• Interface in English, 简体中文 and 日本語

PRIVACY
Keinepad works entirely inside your browser. It does not collect or upload any data, has no analytics, and makes no network requests. The source code is open: https://github.com/MayouiY/Keinepad

Note: browser internal pages (chrome://) and the Chrome Web Store cannot be inspected because browsers do not allow extensions to access them.
```

---

## 简体中文

**名称：** Keinepad - Cookie 与缓存编辑器

**简短说明（≤132 字符）：** 可视化查看、编辑、清除当前站点的 Cookie、本地存储与缓存。

**详细说明：**

```text
Keinepad 是一个面向当前网页的 Cookie 与站点数据编辑器。从工具栏或侧边栏打开，就能看到当前站点保存在浏览器中的全部数据，随手修改，或一键清空。像慧音改写历史一样，轻松掌控网站数据。适合前端开发、测试，以及所有被“缓存到底清没清干净”困扰过的人。

Cookie
• 列出当前站点（含父域名与子域名）的全部 Cookie
• 同样显示 HttpOnly 与分区 Cookie（CHIPS）
• 标记哪些 Cookie 会随当前 URL 发送，可一键只看这些
• 新增 / 编辑 / 删除 / 批量删除；可修改名称、值、域名、路径、过期时间、Secure、HttpOnly、SameSite、Partitioned
• 保存前自动校验：SameSite=None 需要 Secure、__Host- / __Secure- 前缀规则等
• 值预览：URL 解码、JSON 格式化、JWT 解码（显示过期时间）
• 复制为 Cookie: 请求头，JSON 导出 / 导入（兼容常见 Cookie 编辑器格式）
• Cookie 变化时实时刷新

Local Storage / Session Storage
• 键值列表、搜索、新增、编辑（JSON 格式化 / 压缩）、删除、清空、导出

缓存与数据库
• IndexedDB：数据库、版本、对象仓库与记录数，可删除数据库
• Cache Storage：缓存及其中的请求 URL，可删除单条或整个缓存
• Service Worker：注册信息与状态，可注销
• HTTP 缓存：按当前源清除，或强制刷新页面

一键清除站点数据
自由勾选要清除的类型（Cookie、Local Storage、Session Storage、IndexedDB、Cache Storage、Service Worker、HTTP 缓存），可选清除后刷新页面。

导出方式随你选
所有导出都可以选择复制到剪贴板或保存为文件。

顺手好用
• 工具栏弹窗 + 侧边栏（侧边栏跟随当前标签页切换）
• 自动适配浅色 / 深色主题
• 界面支持简体中文、English、日本語

隐私
Keinepad 的所有操作都在本地浏览器中完成，不收集、不上传任何数据，不含统计代码，也不发起网络请求。源代码开放：https://github.com/MayouiY/Keinepad

注意：浏览器内置页面（chrome://）和 Chrome 应用商店页面不允许扩展访问，因此无法查看。
```

---

## 日本語

**名前：** Keinepad - Cookie & キャッシュエディタ

**概要（132 文字以内）：** 現在のサイトの Cookie・ストレージ・キャッシュを表示、編集、削除します。

**説明：**

```text
Keinepad は、いま開いているページの Cookie とサイトデータを扱うエディタです。ツールバーまたはサイドパネルから開くと、現在のサイトがブラウザに保存しているデータをすべて確認でき、その場で編集したり、ワンクリックで削除したりできます。Web 開発者やテスター、「キャッシュは本当に消えた？」に悩んだことのあるすべての人に。

COOKIE
• 現在のサイト（親ドメイン・サブドメインを含む）のすべての Cookie を表示
• HttpOnly やパーティション Cookie（CHIPS）も表示
• 現在の URL に送信される Cookie を表示し、それだけに絞り込み可能
• 追加・編集・削除・一括削除。名前、値、ドメイン、パス、有効期限、Secure、HttpOnly、SameSite、Partitioned を編集可能
• 保存前の検証：SameSite=None には Secure が必要、__Host- / __Secure- プレフィックスの規則など
• 値のプレビュー：URL デコード、JSON 整形、JWT デコード（有効期限を表示）
• Cookie: リクエストヘッダーとしてコピー、JSON のエクスポート / インポート（一般的な Cookie エディタ形式に対応）
• Cookie の変更をリアルタイムに反映

LOCAL STORAGE / SESSION STORAGE
• キーと値の一覧、検索、追加、編集（JSON 整形 / 圧縮）、削除、クリア、エクスポート

キャッシュとデータベース
• IndexedDB：データベース、バージョン、オブジェクトストアとレコード数。データベースを削除可能
• Cache Storage：キャッシュと含まれるリクエスト URL。エントリ単位・キャッシュ単位で削除可能
• Service Worker：登録情報と状態。登録解除可能
• HTTP キャッシュ：現在のオリジン単位で削除、またはハード再読み込み

サイトデータをワンクリックで削除
削除するデータの種類（Cookie、Local Storage、Session Storage、IndexedDB、Cache Storage、Service Worker、HTTP キャッシュ）を選び、削除後にページを再読み込みすることもできます。

エクスポート先を選べる
すべてのエクスポートで、クリップボードへのコピーとファイル保存を選択できます。

使いやすさ
• ツールバーのポップアップとサイドパネル（サイドパネルはアクティブなタブに追従）
• システムに合わせてライト / ダークテーマを自動切り替え
• 日本語・English・简体中文の UI

プライバシー
Keinepad はすべてブラウザ内で動作します。データを収集・送信することはなく、解析コードもなく、ネットワーク通信も行いません。ソースコードは公開されています：https://github.com/MayouiY/Keinepad

注意：ブラウザの内部ページ（chrome://）と Chrome ウェブストアは、拡張機能からのアクセスがブラウザによって禁止されているため表示できません。
```
