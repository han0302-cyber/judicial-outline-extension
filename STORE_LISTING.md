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

**功能**

- 📑 **判決架構側欄**：自動偵測判決書的 `壹/一/(一)/㈠/1./(1)/⒈/⑴` 等多層編號標記以及「主文／事實／理由」三大段標題，在頁面左側產生可點擊的目錄，點擊後平滑捲動到對應段落，自動扣掉 sticky header 的遮擋高度。

- ✂️ **智慧複製**：選取任何一段判決文字後複製，自動移除換行與 CJK 字元間的 padding 空白，並於尾端附上「（<裁判字號>意旨參照）」，方便直接貼進書狀或筆記。ASCII 英數字之間的空格（如 "NT 300"）會被保留。

- 📋 **判決剪貼簿側邊欄**：每次複製自動把「去分行 + 附字號」的完整文字推進 Chrome 原生側邊欄，卡片顯示來源（裁判書 / 判解函釋）、可點擊字號連回原始判決、複製時間、完整內文；切到 Google Docs、Word Online、Obsidian 等任何分頁都能逐一再複製貼上。支援字體四段縮放、完全去重、匯出 `.txt` 或 `.md`（Obsidian 適用）。**資料僅保留在當次瀏覽期間**，關閉瀏覽器自動清空，不寫入硬碟、不上傳雲端。

- 🎨 **自動主題配色**：使用司法院官方色票——判解函釋 `#336666` / 裁判書 `#336633`，與原網站主視覺一致。

**支援頁面**

- 司法院法令判解系統 — `legal.judicial.gov.tw/FINT/*`
- 司法院裁判書系統 — `judgment.judicial.gov.tw/FJUD/*`

搜尋結果列表頁不會顯示側欄，只在實際判決內容頁才作用。

**隱私**

本擴充功能不收集、不儲存、不傳送任何使用者資料，所有處理都在你的瀏覽器本機完成。原始碼 100% 公開於 GitHub：
https://github.com/han0302-cyber/judicial-outline-extension

**適合誰**

律師、法務、法律系學生、研究者 —— 任何需要快速閱讀長篇判決、引用判決文字的人。

---

### English

**Features**

- 📑 **Judgment outline sidebar**: Automatically detects Taiwanese legal numbering markers (壹/一/(一)/㈠/1./(1)/⒈/⑴) and the three section headings (主文/事實/理由), builds a clickable table of contents on the left edge of the page. Clicking an item smoothly scrolls to the corresponding paragraph with the sticky header offset baked in.

- ✂️ **Smart copy**: Select any judgment text and copy it — line breaks and padding whitespace between CJK characters are stripped automatically, and the citation suffix `（<case-number>意旨參照）` is appended. Spaces between ASCII alphanumerics (like "NT 300") are preserved.

- 📋 **Clipboard side panel**: Every copy is also saved as a card in Chrome's native side panel. Each card shows the source system, the clickable case number (opens the original ruling in a new tab), timestamp, and full text. Switch to Google Docs, Word Online, Obsidian Web, etc. and paste copies one by one from the panel. Supports four-step font scaling, exact-match de-duplication, and export to `.txt` or `.md` (Obsidian-friendly format). **Data lives only in the current browser session** (Chrome's in-memory `chrome.storage.session`) and is cleared the moment you close the browser — nothing is written to disk or uploaded.

- 🎨 **Auto theme**: Official Judicial Yuan palette — dark teal `#336666` for FINT, dark green `#336633` for FJUD.

**Supported pages**

- `legal.judicial.gov.tw/FINT/*` — Taiwan Judicial Yuan Legal Search
- `judgment.judicial.gov.tw/FJUD/*` — Taiwan Judicial Yuan Judgments

Search result lists are ignored; the outline only appears on actual ruling pages.

**Privacy**

No data collection, no storage, no network requests. Everything runs locally in your browser. Source code fully open at:
https://github.com/han0302-cyber/judicial-outline-extension

---

## Permission justification

### Host permission: `legal.judicial.gov.tw/FINT/*` and `judgment.judicial.gov.tw/FJUD/*`

**Justification（繁中）**：
擴充功能必須在這兩個網域的裁判書頁面上注入 DOM 元件（判決架構導覽側欄）以及攔截複製事件（移除換行、附上裁判字號、紀錄到判決剪貼簿側邊欄）。功能完全限定於這兩個網域，不會存取其他網站。

**Justification (English)**:
The extension needs to inject DOM elements (the outline sidebar) and intercept the copy event (line-break stripping, citation suffix, and logging to the clipboard side panel) on ruling pages hosted at these two domains. All functionality is strictly limited to these hosts; no other websites are accessed.

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
