# 司法院裁判書閱讀助手 — Chrome Extension

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

### 方式 A：從 Chrome Web Store 安裝（推薦）

👉 **[https://chromewebstore.google.com/detail/nigjaldhpljkcgedolepmhmifaplpadn](https://chromewebstore.google.com/detail/nigjaldhpljkcgedolepmhmifaplpadn)**

點上面連結 → 按「加到 Chrome」→ 完成。之後 Chrome 會自動更新到最新版，不需要任何手動操作。

Edge 瀏覽器也可以直接從 Chrome Web Store 安裝。

### 方式 B：從 GitHub 原始碼本機安裝（開發人員模式）

#### 步驟 1 — 下載原始碼

> 以下 **1-A** 和 **1-B** **擇一執行即可**（不是兩種都做）。不熟 git 的使用者請選 1-A。

<details>
<summary><b>1-A　下載 ZIP（不需 git，推薦給一般使用者）</b></summary>

1. 開啟 https://github.com/han0302-cyber/judicial-outline-extension
2. 點右上方綠色 **`Code`** 按鈕
3. 下拉選單選 **`Download ZIP`**
4. 下載後解壓縮到你容易找到的位置，例如 `~/Downloads/judicial-outline-extension-main/`
5. **重要**：解壓後的資料夾**不要移動、不要刪除、不要改名**，Chrome 會持續從這個路徑讀取 extension

做完請直接跳到 **步驟 2**。

</details>

<details>
<summary><b>1-B　git clone（需先裝 git，適合開發者）</b></summary>

```bash
cd ~/Downloads
git clone https://github.com/han0302-cyber/judicial-outline-extension.git
```

做完請直接跳到 **步驟 2**。

</details>

#### 步驟 2 — 在 Chrome 中載入 extension

1. 開啟 Chrome，網址列輸入 `chrome://extensions` 按 Enter
2. 右上角開啟 **「開發人員模式 / Developer mode」** 切換開關
3. 左上角點 **「載入未封裝項目 / Load unpacked」**
4. 選檔案視窗出現後，選取你剛解壓或 clone 的資料夾（裡面要看得到 `manifest.json`、`content.js`、`icons/` 等檔案），點「選擇 / Select」
5. Extensions 列表上會出現「司法院裁判書閱讀助手」卡片，確認開關是**打開**的

#### 步驟 3 — 試用

1. 前往任一裁判書頁面，例如：
   - https://legal.judicial.gov.tw/FINT/default.aspx（法學資料檢索系統）
   - https://judgment.judicial.gov.tw/FJUD/default.aspx（裁判書系統）
2. 搜尋一筆判決、點進詳細內容頁
3. 頁面左側應該會出現一條「判決架構」直條耳標，滑鼠移上去會展開目錄
4. 選取任一段判決文字複製，貼到任何地方，尾端會自動附上「（<裁判字號>意旨參照）」

### 更新

- **方式 A（Web Store）**：Chrome 會自動更新
- **方式 B-1（ZIP）**：重新下載新版 ZIP、刪除舊資料夾、解壓到原位、在 `chrome://extensions` 點擊該 extension 的「🔄 重新載入」按鈕
- **方式 B-2（git clone）**：
  ```bash
  cd ~/Downloads/judicial-outline-extension
  git pull
  ```
  然後在 `chrome://extensions` 點擊「🔄 重新載入」

### 移除

在 `chrome://extensions` 找到該 extension 卡片，點「移除 / Remove」即可。若是方式 B-1 / B-2 安裝，本機的資料夾也可以手動刪除。

### 疑難排解

- **看不到耳標** → 確認你在的頁面是「判決詳情」而不是搜尋結果列表；列表頁不會注入側欄。
- **複製時沒附上字號** → 確認你選取的文字**在判決正文區塊內**；若選到頁首的按鈕或導覽元件就不會觸發。
- **Chrome 跳出「此擴充功能已停用」** → 開發人員模式載入的 extension 每次重啟 Chrome 可能會提示；勾選「繼續允許」或重新啟用即可。
- **刪除了原資料夾後 extension 消失** → 這是方式 B 的副作用；請重新下載並載入一次。

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
| `README.md` | 你正在看的這份文件 |
| `PRIVACY.md` | 隱私政策（無資料收集聲明） |
| `STORE_LISTING.md` | Chrome Web Store 上架文案草稿（繁中 + 英） |
| `build.sh` | 將 runtime 檔案封裝成 `dist/*.zip` 供 CWS 上傳 |
| `LICENSE` | MIT License |
| `.gitignore` | macOS / 編輯器 / 封裝產物排除規則 |

## 授權

MIT License — 詳見 [LICENSE](./LICENSE)。

## 聯絡

有問題歡迎來信 **tinghan.lin@stellexlaw.com**，但不保證修好（笑）。
