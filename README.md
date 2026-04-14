# 司法院裁判書閱讀助手

在瀏覽司法院法學資料檢索系統與裁判書系統時，自動在頁面左側注入「判決架構」導覽卡片，讓長篇判決的結構一目瞭然；並在複製文字時自動移除換行、附上裁判字號。

---

## 📥 安裝

### 🟢 Chrome / Edge → Chrome Web Store

👉 **<https://chromewebstore.google.com/detail/nigjaldhpljkcgedolepmhmifaplpadn>**

點連結 → 按「加到 Chrome」→ 完成。之後 Chrome 會自動更新到最新版，不需任何手動操作。Edge 也可直接從這個連結安裝。

### 🔵 Safari on macOS → 下載 ZIP

👉 **[點此直接下載 judicial-outline-helper-0.1.2.zip](https://github.com/han0302-cyber/judicial-outline-extension/releases/download/v0.1.2/judicial-outline-helper-0.1.2.zip)**

（或到 [Releases 頁面](https://github.com/han0302-cyber/judicial-outline-extension/releases) 挑選其他版本）

> 註：Safari 版目前**鎖定在 0.1.2**。0.1.3 以後加入的「事實及理由」偵測、後台設定頁等功能在 Safari 上有相容性問題尚待修復，請暫時使用此版本以確保耳標能正常出現。

1. 下載後雙擊 ZIP 解壓縮，得到 `司法院裁判書閱讀助手.app`
2. 把 `.app` 拖到 **Applications** 資料夾
3. 打開 `.app` 一次（會顯示「請到 Safari 設定啟用」的說明畫面，可以關掉）
4. Safari → **設定 / Settings → 延伸功能 / Extensions** → 勾選「司法院裁判書閱讀助手」
5. 首次使用時網址列右邊會出現一個「判」字 icon，點它 → **一律在這些網站允許**
6. 打開任一篇判決頁即可使用

`.app` 已用 **Apple Developer ID** 簽章並通過 **Apple Notarization**，可直接雙擊執行，不會有 Gatekeeper 警告。

> ⚠️ **Safari 版的後台設定頁面（耳標位置切換、複製附字號開關）尚未完成**，因此 Safari 提供的下載暫時鎖定在 **0.1.2**。
> 0.1.2 行為固定為：耳標停靠在頁面**左側**、複製時**自動附上**裁判字號，且尚未支援「事實及理由」段落偵測。
> 若你需要這些較新的功能或想自訂設定，請改用 Chrome / Edge 版本；Safari 版待後續修復完畢後再升版。

---

## ✨ 功能

1. **判決架構側欄**（hover tab）
   - 自動偵測 `壹/貳`、`一、二、`、`(一)(二)`、`㈠㈡㈢`、`1. 2.`、`⒈⒉⒊`、`⑴⑵⑶`、`(1)(2)` 等多層編號標記
   - 額外偵測段落標題：`主文 / 事實 / 理由 / 事實及理由`（後者地院刑事判決常用）
   - 「主文」若後接無編號正文，自動補一個子條目供跳轉
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

---

## 🔧 進階：從原始碼載入（開發者）

若你想自己改程式、或用最新未發布的版本，可以用 Chrome 的開發人員模式載入原始碼。

<details>
<summary><b>展開原始碼安裝教學</b></summary>

### 步驟 1 — 下載原始碼（1-A 或 1-B 擇一）

#### 1-A　下載 ZIP（不需 git）

1. 開啟 <https://github.com/han0302-cyber/judicial-outline-extension>
2. 點右上方綠色 **`Code`** 按鈕 → **`Download ZIP`**
3. 下載後解壓縮到你容易找到的位置，例如 `~/Downloads/judicial-outline-extension-main/`
4. **重要**：資料夾**不要移動、不要刪除、不要改名**，Chrome 會持續從這個路徑讀取 extension

#### 1-B　git clone（需先裝 git）

```bash
cd ~/Downloads
git clone https://github.com/han0302-cyber/judicial-outline-extension.git
```

### 步驟 2 — 在 Chrome 中載入 extension

1. 網址列輸入 `chrome://extensions` 按 Enter
2. 右上角打開 **「開發人員模式 / Developer mode」**
3. 左上角點 **「載入未封裝項目 / Load unpacked」**
4. 選剛解壓 / clone 的資料夾（裡面要看得到 `manifest.json`）
5. Extensions 列表出現「司法院裁判書閱讀助手」卡片、開關打開

### 更新

- **ZIP 方式**：重新下載新版 ZIP → 刪除舊資料夾 → 解壓到原位 → `chrome://extensions` 點 🔄
- **git clone 方式**：`git pull` → `chrome://extensions` 點 🔄

</details>

---

## 🐞 疑難排解

- **看不到耳標** → 確認你在的頁面是「判決詳情」而不是搜尋結果列表；列表頁不會注入側欄
- **複製時沒附上字號** → 確認你選取的文字**在判決正文區塊內**；若選到頁首按鈕或導覽就不會觸發
- **Safari 安裝後要求「允許未簽署的延伸功能」** → 你裝到的是 Xcode dev build 而不是 Release ZIP。從本 README 的 GitHub Release 連結重新下載 ZIP，安裝後就不需要這個選項
- **Chrome 開發人員模式裝的版本重啟後消失** → 請改從 Chrome Web Store 安裝，免維護

---

## 🔐 技術細節

- Manifest V3，純 content script，無 background / service worker
- 使用 `TreeWalker` 扁平化 `#jud` / `#plCJData` 等正文容器的文字節點，維護每個 text node 在扁平字串中的偏移表
- 在扁平字串上執行三 pass 偵測（物理行首 / 句尾後 inline / CJK enclosed）後，用 `splitText` 在正確的 text node 插入隱形 `<span id>` anchor，不動到原排版
- 側欄 DOM 掛到 `window.top.document`，讓 `position: fixed` 以最外層 viewport 為基準（解決 FJUD 把內容塞進 iframe 時 fixed 被當成 absolute 的問題）
- 點擊跳轉時沿 frame chain 計算 target 在 top viewport 的絕對 Y，一次 `scrollTo` 扣除 header offset，避免 `scrollIntoView` + delayed `scrollBy` 的動畫競爭
- Safari 版由 `xcrun safari-web-extension-converter` 從同一份 Chrome 原始碼生成 Xcode project，編譯成 Safari Web Extension

## 專案結構

| 檔案 / 資料夾 | 用途 |
|---|---|
| `manifest.json` | Chrome Extension MV3 manifest，宣告 match patterns、icons、content script 路徑 |
| `content.js` | 核心邏輯：DOM 扁平化、階層偵測、側欄注入、智慧複製 handler |
| `sidebar.css` | 側欄與 toast 的樣式，含 FINT / FJUD 雙主題 CSS variables |
| `icons/` | 擴充功能圖示（16 / 32 / 48 / 128 PNG）與原稿 SVG |
| `README.md` | 你正在看的這份文件 |
| `PRIVACY.md` | 隱私政策（無資料收集聲明） |
| `STORE_LISTING.md` | Chrome Web Store 上架文案草稿（繁中 + 英） |
| `build.sh` | 將 runtime 檔案封裝成 `dist/*.zip` 供 CWS 上傳 |
| `LICENSE` | MIT License |
| `.gitignore` | macOS / 編輯器 / 封裝產物排除規則 |

## 授權

MIT License — 詳見 [LICENSE](./LICENSE)。

## 聯絡

使用上有任何問題或建議，歡迎來信 **tinghan.lin@stellexlaw.com**。
