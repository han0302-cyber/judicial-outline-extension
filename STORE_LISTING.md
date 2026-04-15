# Chrome Web Store 上架文案草稿

直接複製貼到 Chrome Web Store Developer Dashboard 對應欄位即可。

---

## Short description（≤132 字元）

### 繁體中文
> 在司法院裁判書頁面加上左側「判決架構」導覽，並在複製文字時自動移除分行、附上裁判字號。

### English
> Adds a "Judgment Outline" sidebar to Taiwan judicial ruling pages, plus smart copy that strips line breaks and appends the citation.

---

## Detailed description

### 繁體中文

**功能**

- 📑 **判決架構側欄**：自動偵測判決書的 `壹/一/(一)/㈠/1./(1)/⒈/⑴` 等多層編號標記以及「主文／事實／理由」三大段標題，在頁面左側產生可點擊的目錄，點擊後平滑捲動到對應段落，自動扣掉 sticky header 的遮擋高度。

- ✂️ **智慧複製**：選取任何一段判決文字後複製，自動移除換行與 CJK 字元間的 padding 空白，並於尾端附上「（<裁判字號>意旨參照）」，方便直接貼進書狀或筆記。ASCII 英數字之間的空格（如 "NT 300"）會被保留。

- 🎨 **自動主題配色**：在法令判解系統 (legal.judicial.gov.tw) 顯示 muted teal，在裁判書系統 (judgment.judicial.gov.tw) 顯示綠色，與原網站主視覺融合。

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

- 🎨 **Auto theme**: Muted teal on legal.judicial.gov.tw (FINT), green on judgment.judicial.gov.tw (FJUD), matching each site's branding.

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
擴充功能必須在這兩個網域的裁判書頁面上注入 DOM 元件（判決架構導覽側欄）以及攔截複製事件（移除換行、附上裁判字號）。功能完全限定於這兩個網域，不會存取其他網站。

**Justification (English)**:
The extension needs to inject DOM elements (the outline sidebar) and intercept the copy event (line-break stripping + citation suffix) on ruling pages hosted at these two domains. All functionality is strictly limited to these hosts; no other websites are accessed.

---

## Category

**Productivity** (生產力)

## Language

主要：**Traditional Chinese (Taiwan)**（繁體中文 - 台灣）
次要：English

## Target regions

Taiwan 為主，全球可用。
