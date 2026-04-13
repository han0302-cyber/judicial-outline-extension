# 司法院裁判書助手 — Chrome Extension

在瀏覽司法院法學資料檢索系統與裁判書系統時，自動在頁面左側注入「判決架構」導覽卡片，讓長篇判決的結構一目瞭然；並在複製文字時自動移除換行、附上裁判字號。

## 功能

1. **判決架構側欄**（hover tab）
   - 自動偵測 `壹/貳`、`一、二、`、`(一)(二)`、`㈠㈡㈢`、`1. 2.`、`⒈⒉⒊`、`⑴⑵⑶`、`(1)(2)` 等多層編號標記
   - 額外偵測三大段標題：`主文 / 事實 / 理由`
   - 點擊條目平滑捲動到對應段落，自動扣掉 sticky header 高度
   - 支援「判決易讀小幫手」包住專有名詞的 `<a>` 連結，不會截斷 label

2. **智慧複製**
   - 選取文字後複製，自動移除所有分行與 CJK 字元間的 padding 空白
   - 保留 ASCII 英數之間的空格（例如 `NT 300` 不會變成 `NT300`）
   - 尾端自動附上 `（<裁判字號>意旨參照）` —— 字號從頁面「裁判字號：」欄位擷取
   - Windows / macOS 共用同一套 copy handler

3. **自動主題配色**
   - `legal.judicial.gov.tw` (FINT / 法學資料檢索系統) → muted teal 主色
   - `judgment.judicial.gov.tw` (FJUD / 裁判書系統) → 綠色主色
   - 每次 iframe 導航自動清理舊側欄、重新建構

## 支援頁面

| 網站 | URL pattern | 說明 |
|---|---|---|
| 司法院法學資料檢索系統 | `https://legal.judicial.gov.tw/FINT/*` | 含 default.aspx 內嵌 iframe |
| 司法院裁判書系統 | `https://judgment.judicial.gov.tw/FJUD/*` | 含 default.aspx 內嵌 iframe |

搜尋結果列表頁不會注入側欄 (`#jud` 為 `<table>` 時自動豁免)。

## 安裝

1. 下載或 clone 本 repo
2. Chrome 開啟 `chrome://extensions`
3. 開啟「開發人員模式」
4. 點「載入未封裝項目」，選這個資料夾
5. 瀏覽任一篇裁判書即可看到左側「判決架構」耳標

## 技術細節

- Manifest V3，純 content script，無 background / service worker
- 使用 `TreeWalker` 扁平化 `#jud` / `#plCJData` 等正文容器的文字節點，維護每個 text node 在扁平字串中的偏移表
- 在扁平字串上執行三 pass 偵測（物理行首 / 句尾後 inline / CJK enclosed）後，用 `splitText` 在正確的 text node 插入隱形 `<span id>` anchor，不動到原排版
- 側欄 DOM 掛到 `window.top.document`，讓 `position: fixed` 以最外層 viewport 為基準（解決 FJUD 把內容塞進 iframe 時 fixed 被當成 absolute 的問題）
- 點擊跳轉時沿 frame chain 計算 target 在 top viewport 的絕對 Y，一次 `scrollTo` 扣除 header offset，避免 `scrollIntoView` + delayed `scrollBy` 的動畫競爭

## 專案結構

| 檔案 / 資料夾 | 用途 |
|---|---|
| `manifest.json` | Chrome Extension MV3 manifest，宣告 match patterns、icons、content script 路徑 |
| `content.js` | 核心邏輯：DOM 扁平化、階層偵測、側欄注入、智慧複製 handler |
| `sidebar.css` | 側欄與 toast 的樣式，含 FINT / FJUD 雙主題 CSS variables |
| `icons/` | 擴充功能圖示（16 / 32 / 48 / 128 PNG）與原稿 SVG |
| `icons/icon.svg` | 圖示原稿（深綠底 + 白色判字 + 三條 outline 橫線） |
| `icons/README.md` | PNG 匯出指令（rsvg / ImageMagick / 線上工具） |
| `README.md` | 你正在看的這份文件 |
| `PRIVACY.md` | 隱私政策（無資料收集聲明） |
| `STORE_LISTING.md` | Chrome Web Store 上架文案草稿（繁中 + 英） |
| `build.sh` | 將 runtime 檔案封裝成 `dist/*.zip` 供 CWS 上傳 |
| `LICENSE` | MIT License |
| `.gitignore` | macOS / 編輯器 / 封裝產物排除規則 |

## 授權

MIT License — 詳見 [LICENSE](./LICENSE)。
