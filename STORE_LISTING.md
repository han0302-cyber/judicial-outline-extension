# Chrome Web Store 上架文案草稿

直接複製貼到 Chrome Web Store Developer Dashboard 對應欄位即可。

---

## Short description（≤132 字元）

### 繁體中文
> 裁判書頁面加上「判決架構」導覽、智慧複製（去分行、附字號），並提供瀏覽器側邊欄「判決剪貼簿」跨分頁保存並匯出複製過的段落。

### English
> Judgment outline sidebar, smart copy (strip line breaks + append citation), and a browser side panel clipboard to save and export copied passages across tabs.

---

## Detailed description

### 繁體中文

📑 **判決架構側欄**
自動偵測判決書的多層編號標記 —— 從最外層的「壹／貳」、「一、二、」、「(一)／㈠」，到較深的「1.／⒈／１．」、「(1)／⑴／（１）」、再到最深的「①／②／③」共 6 層階層；以及「主文／事實／理由／事實及理由」段落標題。在頁面左側（或右側，可設定）產生可點擊的目錄，點擊後平滑捲動到對應段落，自動扣掉 sticky header 的遮擋高度。

側欄會自動跳過引號內被引用的條文（例如「按 X 法第 N 條規定：⋯一、⋯二、⋯」），不會把法條條款誤抓成本篇判決的大綱；卡片寬度也會依當下展開的最深層級自動調整，淺判決保持窄、深判決自動加寬避免標籤被截斷。

✂️ **智慧複製**
選取任何一段判決文字後複製，自動移除換行與 CJK 字元間的 padding 空白，並於尾端附上「（<裁判字號>意旨參照）」，方便直接貼進書狀或筆記。ASCII 英數字之間的空格（如 "NT 300"）會被保留。字號附加功能可在設定頁一鍵關閉。

📋 **判決剪貼簿側邊欄**
每次 Cmd+C / Ctrl+C 複製後，擴充功能會把「去分行 + 附字號」的完整文字推進 Chrome 瀏覽器原生側邊欄，以卡片形式保存**當次瀏覽期間**的所有判決段落。側邊欄由點擊 toolbar 的擴充功能圖示開啟，**不限於裁判書頁面** —— 切到 Google Docs、Word Online、Obsidian Web、Notion 等任何分頁都看得到同一份卡片清單，點卡片上的「複製」鈕即可貼上，非常適合需要一次引用多段判決文字的書狀撰寫情境。

每張卡片包含來源標籤（裁判書 / 判解函釋 / 內網）、可點擊的裁判字號（在新分頁開啟原始判決頁面）、複製時間戳與完整內文；色系依來源系統自動切換，採用司法院官方色票。完全重複的內容自動去重並提示「已複製過相同內容」。字體大小可四段調整（小／中／大／特大），標籤與字號隨內文一起縮放。支援將全部卡片匯出為 `.txt` 純文字或 `.md` Markdown 檔，`.md` 為 Obsidian 友善的 blockquote 格式，判決字號會做為 H2 小標題、內文為引用區塊，可直接拖進 Obsidian vault 檢視。

**隱私設計**：剪貼簿紀錄只存在 `chrome.storage.session`（Chrome 原生記憶體暫存區），關閉瀏覽器即自動清空，**不寫入硬碟、不上傳雲端、不跨裝置同步**。即使同時開多個瀏覽器視窗，紀錄在同一個瀏覽器程序內共享、另開瀏覽器則各自獨立。

⚙️ **後台設定頁面**
  　• 「複製時自動附上裁判字號」開關（預設：開）
  　• 法令判解系統、裁判書系統、司法院內網的「判決架構」耳標可分別設定停靠在頁面左側或右側
  　• 「展開深度」可在 1 到 6 層之間調整（預設 3）：
  　　　1 — 主文／事實／理由 + 壹、貳、參
  　　　2 — 再加上 一、二、三
  　　　3 — 再加上 (一)、(二) ／ ㈠、㈡（預設）
  　　　4 — 再加上 1.、2. ／ ⒈、⒉ ／ １．、２．
  　　　5 — 再加上 (1)、(2) ／ ⑴、⑵ ／ （１）、（２）
  　　　6 — 再加上 ①、②、③
  　• 設定變更立即套用到開啟中的分頁，跨裝置透過 Chrome 帳號同步

🎨 **自動主題配色**
使用司法院官方色票 —— 判解函釋系統 `#336666`（深青）、裁判書系統 `#336633`（深綠）、司法院內網 `#006699`（海軍藍），與各自原網站主視覺融合。剪貼簿卡片的字號標題、按鈕、hover 背景也會依來源系統切換主題色。

🔖 **支援頁面**
  - 司法院法令判解系統 — `legal.judicial.gov.tw/FINT/*`
  - 司法院裁判書系統 — `judgment.judicial.gov.tw/FJUD/*`
  - 司法院內部網路 — `judgment.law.intraj/*`（限院內網路環境，不限 FJUD/FINT 路徑）

搜尋結果列表頁不會顯示側欄，只在實際判決內容頁才作用。內網版本與外網版本共用同一套邏輯，無需額外安裝。

🙈 **隱私**
本擴充功能不向任何伺服器發送請求，所有資料都只存在於你的瀏覽器本機。判決剪貼簿紀錄只存於記憶體（關瀏覽器即清空），使用者設定透過 Chrome 帳號同步，字體偏好存本機 —— 以上任何資料都不會離開你的瀏覽器、不會傳給任何第三方。原始碼 100% 開源於 GitHub：
https://github.com/han0302-cyber/judicial-outline-extension

**適合誰**
律師、法務、法律系學生、研究者 —— 任何需要快速閱讀長篇判決、引用判決文字、或批次整理判決段落到 Word / Google Docs / Obsidian 的人。

🆕 **v0.2.1 更新**
  • 司法院內網專屬配色（海軍藍 `#006699`），與內網頁面背景色融合
  • 後台設定新增內網耳標位置（左/右）獨立設定
  • 內網 URL pattern 放寬為 `judgment.law.intraj/*`，不再限於 FJUD 路徑
  • 裁判字號擷取改進：正確截斷「量刑趨勢建議」等頁面附加文字，支援判決、裁定、決定書、判例、裁判書等各類書類字號

🆕 **v0.2.0 更新**
  • 新增「判決剪貼簿」瀏覽器原生側邊欄（Chrome Side Panel API）
  • Cmd+C / Ctrl+C 複製後自動把完整文字入檔為卡片，跨分頁可瀏覽、逐一再貼上，適合處理多段引文的書狀撰寫
  • 卡片含來源標籤（裁判書 / 判解函釋 / 內網）、可點擊字號連回原始判決、複製時間、完整內文
  • 支援將整份紀錄匯出為 `.txt` 純文字或 `.md` Markdown（Obsidian blockquote 格式，字號為 H2 小標題）
  • 字體四段縮放（小／中／大／特大）、完全重複自動去重並提示
  • 真實判決網址抓取：優先讀取頁面「分享網址」dialog 的 `#txtUrl`，避免抓到 `default.aspx` 殼頁；外網與內網邏輯一致
  • 卡片、字號、按鈕主題改採司法院官方色票 `#336633` / `#336666`
  • 資料僅存於 `chrome.storage.session`（記憶體），關閉瀏覽器即自動清空，不寫入硬碟、不同步

🆕 **v0.1.7 更新**
  • 判決架構偵測擴充到完整 6 層階層：壹 → 一 → (一)/㈠ → 1./⒈/１． → (1)/⑴/（１） → ①／②／③
  • 全形與半形阿拉伯數字（含圓圈、帶括號）一律歸為同一層，視覺縮排一致
  • 新增「展開深度」設定，可依判決複雜度自由選擇 1～6 層（預設 3）
  • 自動跳過引號內引用條文：「按 X 法第 N 條規定：⋯」內的 一、二、三 不再被誤抓進耳標
  • 修正長判決後半段大綱消失的 bug（局部封閉配對 + 1500 字跨度上限）
  • 卡片寬度依展開深度自動加寬，避免標籤被截斷

🆕 **v0.1.6 更新**
  • 新增支援司法院內部網路裁判書系統 (`judgment.law.intraj/FJUD/*`)，院內使用 Chrome 亦可使用判決架構耳標與智慧複製功能

🆕 **v0.1.5 更新**
  • 新增「擴充功能選項」設定頁
  • 新增「耳標位置左/右」可分網站設定
  • 新增「複製時自動附上裁判字號」開關
  • 偵測「事實及理由」合併段落為獨立目錄條目

---

### English

📑 **Judgment outline sidebar**
Automatically detects the full 6-level Taiwanese legal numbering hierarchy — from top-level 壹/貳 → 一/二 → (一)/㈠ → 1./⒈/１． → (1)/⑴/（１） → ①/②/③ — plus the section headings 主文/事實/理由/事實及理由. Builds a clickable table of contents on the left (or right, configurable) edge of the page. Clicking an item smoothly scrolls to the corresponding paragraph, with the sticky header offset baked in. Quoted statute citations (e.g. "按 X 法第 N 條規定：⋯一、⋯二、⋯") are skipped so the outline reflects only the ruling's own structure. Card width auto-adjusts to the deepest expanded level, keeping shallow rulings narrow and wide rulings readable.

✂️ **Smart copy**
Select any judgment text and copy it — line breaks and padding whitespace between CJK characters are stripped automatically, and the citation suffix `（<case-number>意旨參照）` is appended. Spaces between ASCII alphanumerics (like "NT 300") are preserved. The citation suffix can be toggled off in the options page.

📋 **Clipboard side panel**
Every Cmd+C / Ctrl+C is also saved as a card in Chrome's native side panel, accumulating **every copy made during the current browser session**. Open the panel from the toolbar icon — it's **not limited to ruling pages**, so you can switch to Google Docs, Word Online, Obsidian Web, Notion, etc. and still see the same card list, clicking each card's "Copy" button to paste one by one. Ideal for brief-writing workflows that cite multiple passages.

Each card shows the source tag (裁判書 / 判解函釋 / intranet), the clickable case number (opens the original ruling in a new tab), a timestamp, and the full text. Theme colors switch automatically by source. Exact duplicates are de-duplicated with a toast notification. Four-step font scaling (small / medium / large / extra-large) scales the tag, label, and body together. Export all cards as `.txt` or `.md` — the `.md` format uses H2 headings for case numbers and blockquotes for judgment text, making it a clean drop-in for Obsidian vaults.

**Privacy by design**: Clipboard history is stored only in `chrome.storage.session` (Chrome's native in-memory storage). It is wiped the moment you close the browser — **never written to disk, never uploaded, never synced across devices**.

⚙️ **Options page**
  • Toggle "append citation on copy" (default: on)
  • Per-site sidebar position (left / right) for FINT, FJUD, and intranet
  • "Expand depth" slider 1–6 (default 3): controls how deep the outline auto-expands
  • All changes apply instantly to open tabs; user settings sync across devices via your Chrome account

🎨 **Auto theme**
Official Judicial Yuan palette — dark teal `#336666` for FINT (judicial interpretations), dark green `#336633` for FJUD (rulings), and navy blue `#006699` for the Judicial Yuan intranet. Clipboard card accent colors, buttons, and hover backgrounds also follow the source system's theme.

🔖 **Supported pages**
  - Taiwan Judicial Yuan Legal Search — `legal.judicial.gov.tw/FINT/*`
  - Taiwan Judicial Yuan Judgments — `judgment.judicial.gov.tw/FJUD/*`
  - Judicial Yuan Intranet — `judgment.law.intraj/*` (intranet-only, all paths)

Search result lists are ignored; the outline only appears on actual ruling pages. The intranet build shares the same codebase and needs no extra installation.

🙈 **Privacy**
No network requests. All data stays on your local browser. Clipboard cards live in `chrome.storage.session` (in-memory only, cleared on browser close); user settings sync via `chrome.storage.sync`; font-size preference lives in `chrome.storage.local`. None of it ever leaves your browser or reaches any third party. Source code fully open at:
https://github.com/han0302-cyber/judicial-outline-extension

**Who is it for**
Lawyers, legal staff, law students, and researchers — anyone who needs to read long Taiwanese rulings quickly, cite judgment text, or batch-collect passages into Word / Google Docs / Obsidian.

🆕 **v0.2.1 changes**
  • Dedicated navy blue theme (`#006699`) for the Judicial Yuan intranet, blending with the intranet page background
  • Intranet sidebar position (left / right) now independently configurable in the options page
  • Intranet URL pattern broadened to `judgment.law.intraj/*` (no longer limited to FJUD path)
  • Case label extraction improved: correctly trims trailing page artifacts (e.g. "量刑趨勢建議"); now supports 判決, 裁定, 決定書, 判例, and 裁判書 document types

🆕 **v0.2.0 changes**
  • New clipboard side panel backed by Chrome's Side Panel API
  • Every copy auto-saves as a card; cards persist across tabs and can be re-pasted one by one — ideal for multi-citation brief writing
  • Cards show source tag, clickable case number (opens original ruling), timestamp, and full text
  • Export all cards to `.txt` plain text or `.md` Markdown (Obsidian-friendly blockquote format with H2 case-number headings)
  • Four-step font scaling, exact-match de-duplication with toast notification
  • Real URL resolution: prefers the page's `#txtUrl` "share URL" dialog and walks child iframes, avoiding the `default.aspx` shell URL — logic works identically on both public and intranet deployments
  • Card, label, and button themes now use the Judicial Yuan's official palette `#336633` / `#336666`
  • Clipboard history lives only in `chrome.storage.session` (in-memory), cleared on browser close, never written to disk or synced

🆕 **v0.1.7 changes**
  • Extended outline detection to full 6-level hierarchy: 壹 → 一 → (一)/㈠ → 1./⒈/１． → (1)/⑴/（１） → ①/②/③
  • Configurable "expand depth" (1–6, default 3)
  • Quoted statute citations inside "按 X 法第 N 條規定：⋯" are no longer mis-detected as outline items
  • Fixed outline disappearing in the back half of long rulings (local quote pairing + 1500-char span cap)
  • Card width auto-expands with depth to avoid label truncation

🆕 **v0.1.6 changes**
  • Added support for the Judicial Yuan intranet judgment system (`judgment.law.intraj/FJUD/*`)

🆕 **v0.1.5 changes**
  • New options page (citation toggle + per-site sidebar position)
  • Detection of the combined "事實及理由" section heading

---

## Permission justification

### Host permissions: `legal.judicial.gov.tw/FINT/*`, `judgment.judicial.gov.tw/FJUD/*`, `judgment.law.intraj/*`

**Justification（繁中）**：
擴充功能必須在司法院公開網域（FINT 法令判解系統、FJUD 裁判書系統）與司法院內部網路的裁判書頁面上注入 DOM 元件（判決架構導覽側欄）以及攔截複製事件（移除換行、附上裁判字號、紀錄到判決剪貼簿側邊欄）。功能完全限定於這三個網域，不會存取其他網站。內網網域（`judgment.law.intraj`）使用 `/*` 萬用路徑，因為內網同時提供 FJUD 與 FINT 等多個子系統，行為與公開網域一致，供院內使用者安裝同一份擴充功能使用。

**Justification (English)**:
The extension needs to inject DOM elements (the outline sidebar) and intercept the copy event (line-break stripping, citation suffix, and logging to the clipboard side panel) on ruling pages hosted at the Taiwan Judicial Yuan's public domains (FINT legal interpretations, FJUD rulings) and the Judicial Yuan's internal intranet. All functionality is strictly limited to these three hosts; no other websites are accessed. The intranet host (`judgment.law.intraj`) uses a `/*` wildcard path because the intranet serves multiple subsystems (FJUD, FINT, etc.) under the same domain. It behaves identically to the public hosts and lets Judicial Yuan staff install the same extension for internal use.

### `storage` permission

**Justification（繁中）**：
- `chrome.storage.sync` 儲存使用者設定（複製附字號開關、耳標位置、展開深度），跨裝置同步需要此權限
- `chrome.storage.session` 儲存判決剪貼簿側邊欄的卡片紀錄；此 namespace 為記憶體暫存，關瀏覽器即清空，不寫入硬碟也不同步
- `chrome.storage.local` 儲存側邊欄字體大小偏好（單一數字）

**Justification (English)**:
- `chrome.storage.sync` stores user preferences (citation toggle, sidebar position, expand depth) with cross-device sync.
- `chrome.storage.session` holds the clipboard side panel cards; this namespace is in-memory only, wiped when the browser closes, never written to disk, never synced.
- `chrome.storage.local` stores a single font-size preference for the side panel.

### `sidePanel` permission

**Justification（繁中）**：
用於提供「判決剪貼簿」瀏覽器原生側邊欄 UI，讓使用者切換分頁時仍可看到當次複製紀錄並再貼到外部編輯器（如 Google Docs、Obsidian）。

**Justification (English)**:
Required to provide the native browser side panel UI for the clipboard feature, so users can view and re-paste the current session's copies while working in any tab (Google Docs, Obsidian, etc.).

---

## Category

**Productivity** (生產力)

## Language

主要：**Traditional Chinese (Taiwan)**（繁體中文 - 台灣）
次要：English

## Target regions

Taiwan 為主，全球可用。
