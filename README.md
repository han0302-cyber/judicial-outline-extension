# 司法院裁判書閱讀助手

在瀏覽司法院法學資料檢索系統時，自動在頁面左側注入「判決架構」導覽卡片，讓長篇判決的結構一目瞭然；複製文字時自動移除換行、附上裁判字號；並提供瀏覽器側邊欄「判決剪貼簿」，以卡片形式保存當次瀏覽期間複製過的段落，方便跨分頁貼到 Word、Google Docs、Obsidian 等外部編輯器。

---

## 🆕 更新說明

**目前版本：v0.2.5**

本次更新重點：

- **判決架構新增「附表」章段偵測**：判決書末尾的 `附表` 視為與主文、事實、理由同級之章段標題，自動納入耳標。支援純 `附表：`、`附表一／二`（中文數字）、`附表甲／乙`（天干）、`附表壹／貳`（全形中文數字）、`附表1／２`（半形或全形阿拉伯數字）等多種編號形式，亦涵蓋 `附表X（即起訴書附表X）：`、`附表X【被告某某部分併辦】：` 等編號後夾全形括號或方括號註記之實務格式。
- **嚴格收斂誤判**：硬性要求 `附表X` 所在行必須以換行字元為起點，且編號後緊接全形或半形冒號或為行尾，始視為章段標題。正文中「如附表一所示」「附表一、二所示建物」「附表所載金額」等行文即使恰巧落於句號後之行首候選位置，亦因缺少冒號或非獨立行首而不致誤判。
- **標籤維持簡潔**：耳標只顯示「附表」或「附表X」前綴，不收編後續標題與括號註記，使側欄視覺高度不受標題長度影響。

歷史版本 changelog（v0.2.4 以前）請見 [STORE_LISTING.md](./STORE_LISTING.md) 的「更新」章節。

---

## 📥 安裝

### 🟢 Chrome / Edge → Chrome Web Store

👉 **<https://chromewebstore.google.com/detail/nigjaldhpljkcgedolepmhmifaplpadn>**

點連結 → 按「加到 Chrome」→ 完成。之後 Chrome 會自動更新到最新版，不需任何手動操作。Edge 也可直接從這個連結安裝。

### 🔵 Safari on macOS → 下載 ZIP

👉 **[點此直接下載 judicial-outline-helper-0.1.2.zip](https://github.com/han0302-cyber/judicial-outline-extension/releases/download/v0.1.2/judicial-outline-helper-0.1.2.zip)**

（或到 [Releases 頁面](https://github.com/han0302-cyber/judicial-outline-extension/releases) 挑選其他版本）

> ℹ️ **Safari 版維持在 0.1.2**：0.1.3 以後加入的「事實及理由」偵測、後台設定頁等功能在 Safari Web Extension 上有相容性問題尚待修復，因此 Safari 下載暫時鎖定在 0.1.2，以確保耳標能正常出現。需要新功能或自訂設定請改用 Chrome / Edge 版本。

1. 下載後雙擊 ZIP 解壓縮，得到 `司法院裁判書閱讀助手.app`
2. 把 `.app` 拖到 **Applications** 資料夾
3. 打開 `.app` 一次（會顯示「請到 Safari 設定啟用」的說明畫面，可以關掉）
4. Safari → **設定 / Settings → 延伸功能 / Extensions** → 勾選「司法院裁判書閱讀助手」
5. 首次使用時網址列右邊會出現一個「判」字 icon，點它 → **一律在這些網站允許**
6. 打開任一篇判決頁即可使用

`.app` 已用 **Apple Developer ID** 簽章並通過 **Apple Notarization**，可直接雙擊執行，不會有 Gatekeeper 警告。

---

## ✨ 功能

1. **判決架構側欄**（hover tab）
   - 偵測台灣判決常見的完整 6 層編號階層：`壹/貳` → `一/二` → `(一)(二)/㈠㈡` → `1./⒈/１．` → `(1)/⑴/（１）` → `①/②/③`
   - 全形 / 半形 / 圓圈 / 帶括號的阿拉伯數字一律歸為同一層，視覺縮排一致
   - 額外偵測段落標題：`主文 / 事實 / 理由 / 事實及理由`（後者地院刑事判決常用）
   - 判決末尾`附表`章段亦納入耳標，支援`附表`、`附表一/二`、`附表甲/乙`、`附表壹/貳`、`附表1/2`等編號形式
   - 「主文」若後接無編號正文，自動補一個子條目供跳轉
   - 點擊條目平滑捲動到對應段落，自動扣掉 sticky header 高度
   - 支援「判決易讀小幫手」包住專有名詞的 `<a>` 連結，不會截斷標籤文字
   - 自動跳過引用條文：`「按 X 法第 N 條規定：⋯」` 內的 `一、二、三` 不會被誤抓進耳標
   - 卡片寬度依當下展開的最深層級**自動調整**，淺判決保持窄、深判決自動加寬避免標籤被截斷
   - 耳標可由設定頁切換停靠在頁面**左側或右側**

2. **智慧複製**
   - 選取文字後複製，自動移除所有分行與中日韓字元間的多餘空白
   - 保留 ASCII 英數之間的空格（例如 `NT 300` 不會變成 `NT300`）
   - 尾端自動附上 `（<裁判字號>意旨參照）` —— 字號從頁面「裁判字號：」欄位擷取，可在設定頁或側邊欄一鍵關閉
   - **Cmd+X / Ctrl+X 快速鍵**：正規化後寫入剪貼簿，但**不**存入剪貼簿卡片，適用於僅需一次性貼到外部工具、不希望累積卡片清單的情境；可編輯欄位（搜尋框、登入框等）保留原生剪下行為不受影響
   - Windows / macOS 共用同一套複製處理邏輯

3. **判決剪貼簿側邊欄（瀏覽器側邊欄）**
   - 每次 Cmd+C / Ctrl+C 複製後，自動把「去分行 + 附字號」的完整文字推進瀏覽器原生側邊欄（Chrome Side Panel），以卡片形式保存當次瀏覽期間的所有判決段落
   - 側邊欄由點擊 toolbar 的擴充功能圖示開啟，**不限於裁判書頁面**——切到 Google Docs、Word Online、Obsidian Web、Notion 等任何分頁都看得到同一份卡片清單，點卡片上的「複製」鈕即可貼上
   - 卡片含來源標籤（裁判書 / 判解函釋 / 內網判解函釋 / 內網裁判書）、裁判字號（可點擊在新分頁開啟原始判決頁面）、複製時間、完整內文；色系依來源系統自動切換，使用司法院官方色票 `#336633` / `#336666` / `#006699`
   - **前往原文段落**：每張卡片的「前往」按鈕會直接跳回該段落在原始判決頁面的位置，滾動到段落處並以黃色高亮標示。複製當下會在選取文字的起迄位置插入隱形錨點，前往時用 DOM 直接定位，不依賴 URL 比對；原分頁還開著就切換過去，若已關或導航到其他判決則自動開新分頁載入原文再跳轉
   - **#標籤**：每張卡片可加入自訂 #標籤，以彩色膠囊樣式顯示在卡片上，顏色跟隨來源主題；搜尋列下方自動彙整所有標籤，點擊即可快速篩選
   - **備註**：每張卡片可撰寫自由文字備註，儲存後直接顯示在卡片上；點擊備註預覽可再次編輯
   - **關鍵字搜尋**：側邊欄頂端搜尋列可即時篩選卡片內文、字號、備註或 #標籤
   - **拖拉排序**：按住卡片拖曳到目標位置即可重新排列順序，方便依書狀結構整理引文
   - **字號附加即時切換**：側邊欄頂端提供「附上字號 開／關」切換，與設定頁的「複製時自動附上裁判字號」共享同一設定，切換後即時同步至所有分頁與設定頁，免開後台
   - 完全重複的內容自動去重、並以浮動提示顯示「已複製過相同內容」
   - 字體大小可四段調整（小 / 中 / 大 / 特大），標籤與字號隨內文一起縮放，偏好跨瀏覽期間保留
   - 支援匯出成 `.txt` 純文字或 `.md` Markdown 檔（專為 Obsidian 設計的 blockquote 格式），匯出時一併帶出 #標籤與備註
   - **僅保留當次瀏覽器開啟期間的紀錄**：資料只存在 `chrome.storage.session`（記憶體），關閉瀏覽器後自動清空；不寫入硬碟、不同步、不傳送任何外部服務

4. **自動主題配色**
   - `legal.judicial.gov.tw` (FINT / 法令判解系統) → 深青主色 `#336666`
   - `judgment.judicial.gov.tw` (FJUD / 裁判書系統) → 深綠主色 `#336633`
   - `legal.law.intraj` / `judgment.law.intraj`（司法院內網） → 海軍藍主色 `#006699`，搭配內網頁面背景色
   - 每次 iframe 導航自動清理舊側欄、重新建構

5. **使用者設定（後台選項頁面）**
   - 任意時間可調整、立即套用、跨裝置同步（透過 `chrome.storage.sync`）
   - 詳見下方「⚙️ 設定」段

## ⚙️ 設定

開啟設定頁面的方法：

- **方法 A**：`chrome://extensions` → 找到「司法院裁判書閱讀助手」卡片 → **「詳細資料 / Details」** → 往下捲到 **「擴充功能選項 / Extension options」** → 點開
- **方法 B**：右鍵點 Chrome 右上角的擴充功能圖示 → **「選項 / Options」**

設定頁目前包含三個區塊：

| 區塊 | 設定項 | 說明 | 預設 |
|---|---|---|---|
| **複製設定** | 複製時自動附上裁判字號 | 開啟時，選取文字複製後尾端追加「（XX意旨參照）」；關閉時只移除分行不附字號。同一設定亦可在判決剪貼簿側邊欄頂端即時切換 | 開 |
| **耳標位置** | 法令判解系統（FINT）左 / 右 | 「判決架構」直條耳標停靠在頁面左側或右側 | 左 |
| **耳標位置** | 裁判書系統（FJUD）左 / 右 | 同上，每個網站獨立設定 | 左 |
| **耳標位置** | 判解函釋 — 司法院內網（intraj_fint）左 / 右 | 同上，內網判解函釋獨立設定 | 左 |
| **耳標位置** | 裁判書系統 — 司法院內網（intraj_fjud）左 / 右 | 同上，內網裁判書獨立設定 | 左 |
| **展開深度** | 耳標展開到第幾層（1–6） | 1 = 只到 `主文/壹`、2 = `+一`、**3 = `+(一)/㈠`（預設）**、4 = `+1./⒈`、5 = `+(1)/⑴`、6 = `+①` | 3 |

所有設定**變更後立即套用**，已開啟的判決頁不需重新載入 —— 側欄會在 1 秒內自動切到新位置、新層級、複製功能也會立即遵循新規則。設定透過 `chrome.storage.sync` 儲存，登入同一個 Google 帳號的其他 Chrome 裝置會自動同步。

## 支援頁面

| 網站 | URL pattern | 說明 |
|---|---|---|
| 司法院法令判解系統 | `https://legal.judicial.gov.tw/FINT/*` | 含 default.aspx 內嵌 iframe |
| 司法院裁判書系統 | `https://judgment.judicial.gov.tw/FJUD/*` | 含 default.aspx 內嵌 iframe |
| 司法院內網判解函釋 | `https://legal.law.intraj/FINT/*` | 內網判解函釋，套用海軍藍專屬主題 |
| 司法院內網裁判書系統 | `https://judgment.law.intraj/FJUD/*` | 內網裁判書系統，套用海軍藍專屬主題 |

搜尋結果列表頁不會注入側欄（`#jud` 為 `<table>` 時自動豁免）。

---

## 🟡 從原始碼安裝（開發者）

若你的環境無法存取 Chrome Web Store，或想自己改程式、用最新未發布的版本，可以下載 GitHub 原始碼後以 Chrome / Edge 的「開發人員模式」載入。

### 步驟 1 — 下載原始碼 ZIP

1. 開啟 <https://github.com/han0302-cyber/judicial-outline-extension>
2. 點右上方綠色 **`Code`** 按鈕 → **`Download ZIP`**
3. 下載後雙擊 ZIP 解壓縮，得到 `judicial-outline-extension-main` 資料夾
4. 把這個資料夾搬到一個你**不會誤刪**的位置（例如 `~/Documents/` 或 `D:\Tools\`）

> ⚠️ **重要**：資料夾**不要再移動、刪除或改名**，Chrome 會持續從這個路徑讀取擴充功能，一旦路徑變動就會失效。

> 進階：若你已安裝 git，也可改用 `git clone https://github.com/han0302-cyber/judicial-outline-extension.git`，後續更新只要 `git pull` 即可。

### 步驟 2 — 在 Chrome / Edge 載入擴充功能

1. 網址列輸入 `chrome://extensions`（Edge 為 `edge://extensions`）按 Enter
2. 打開右上角 **「開發人員模式 / Developer mode」** 開關
3. 左上角點 **「載入未封裝項目 / Load unpacked」**
4. 選剛解壓的 `judicial-outline-extension-main` 資料夾（裡面要看得到 `manifest.json`）
5. 列表中出現「司法院裁判書閱讀助手」卡片、開關打開即完成

### 步驟 3 — 測試

打開任一篇判決頁，例如 <https://judgment.judicial.gov.tw/FJUD/default.aspx>，頁面左側應出現「判決架構」直條耳標，滑鼠移入即展開導覽卡片。

### 之後要更新版本

- **ZIP 方式**：重新下載新版 ZIP → 解壓後**覆蓋**原資料夾（路徑保持一致）→ `chrome://extensions` 卡片點 🔄
- **git clone 方式**：`git pull` → `chrome://extensions` 卡片點 🔄

### 常見問題

- **`chrome://extensions` 沒有「載入未封裝項目」按鈕** → 右上角的「開發人員模式」開關沒打開
- **看不到耳標** → 確認你在的是「判決詳情頁」而不是搜尋結果列表；列表頁不會注入側欄
- **重啟瀏覽器後擴充功能消失** → 表示原始碼資料夾被移動或刪除，需重新「載入未封裝項目」指向正確路徑

---

## 🐞 疑難排解

- **看不到耳標** → 確認你在的頁面是「判決詳情」而不是搜尋結果列表；列表頁不會注入側欄
- **複製時沒附上字號** → 確認你選取的文字**在判決正文區塊內**；若選到頁首按鈕或導覽就不會觸發；或檢查設定頁／側邊欄頂端的「附上字號」是否被關掉
- **想複製但不要加入剪貼簿卡片** → 改按 Cmd+X / Ctrl+X，剪貼簿內容照舊正規化（含字號設定），但不會新增卡片
- **耳標位置想換到右邊** → 開設定頁（chrome://extensions → 詳細資料 → 擴充功能選項），對該網站選「右側」，不用 reload 立即套用
- **Safari 安裝後要求「允許未簽署的延伸功能」** → 你裝到的是 Xcode dev build 而不是 Release ZIP。從本 README 的 GitHub Release 連結重新下載 ZIP，安裝後就不需要這個選項
- **Chrome 開發人員模式裝的版本重啟後消失** → 請改從 Chrome Web Store 安裝，免維護

---

## 🔐 技術細節

- Manifest V3，核心 content script + 輕量 service worker（僅設定 side panel 行為與 `chrome.storage.session` 存取層級）
- 判決剪貼簿側邊欄透過 Chrome `sidePanel` API 實作；資料存在 `chrome.storage.session`（記憶體、關瀏覽器即清空），字體大小偏好存 `chrome.storage.local`
- 使用 `TreeWalker` 扁平化 `#jud` / `#plCJData` 等正文容器的文字節點，維護每個 text node 在扁平字串中的偏移表
- 在扁平字串上執行三 pass 偵測（物理行首 / 句尾後 inline / CJK enclosed）後，用 `splitText` 在正確的 text node 插入隱形 `<span id>` anchor，不動到原排版
- 側欄 DOM 掛到 `window.top.document`，讓 `position: fixed` 以最外層 viewport 為基準（解決 FJUD 把內容塞進 iframe 時 fixed 被當成 absolute 的問題）
- 點擊跳轉時沿 frame chain 計算 target 在 top viewport 的絕對 Y，一次 `scrollTo` 扣除 header offset，避免 `scrollIntoView` + delayed `scrollBy` 的動畫競爭
- 「前往」功能以書籤錨點為主軸：複製當下於選取範圍起、迄各插入一個空 `<span id>`，id 一併寫入卡片；側邊欄以 `chrome.tabs.sendMessage` 對所有司法院網域分頁廣播 `hasAnchor`，命中的分頁即為原頁面，切過去後以 `Range.setStartAfter/EndBefore` 建出區段並用 CSS Highlight API 上色。錨點不在則退回 `pageUrl` / `sourceUrl` 比對與 `rawText` 精確文字搜尋兩層 fallback
- Safari 版由 `xcrun safari-web-extension-converter` 從同一份 Chrome 原始碼生成 Xcode project，編譯成 Safari Web Extension

## 專案結構

| 檔案 / 資料夾 | 用途 |
|---|---|
| `manifest.json` | Chrome Extension MV3 manifest，宣告 match patterns、icons、permissions、content script 路徑、options page、side panel、service worker |
| `content.js` | 核心邏輯：DOM 扁平化、階層偵測、側欄注入、智慧複製 handler、讀取使用者偏好、複製時推送紀錄到剪貼簿側邊欄 |
| `background.js` | Service worker：設定 side panel 開啟行為，並開放 `chrome.storage.session` 給 content script 存取 |
| `sidebar.css` | 頁內「判決架構」側欄與 toast 的樣式，含 FINT / FJUD / 內網三主題 CSS variables、左右側位置 |
| `sidepanel.html` / `sidepanel.css` / `sidepanel.js` | 瀏覽器原生側邊欄「判決剪貼簿」的 UI、樣式與邏輯（卡片列表、字體縮放、匯出 .txt/.md、複製回剪貼簿） |
| `options.html` | 後台設定頁面（擴充功能選項）—— 複製設定 + 耳標位置 |
| `options.js` | 設定頁面的讀寫邏輯，使用 `chrome.storage.sync` |
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
