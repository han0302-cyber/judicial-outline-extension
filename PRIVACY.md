# Privacy Policy — 司法院裁判書閱讀助手

**最後更新：2026-04-15**

## 簡短版

本擴充功能 **不向任何伺服器發送請求、不收集、不傳送任何使用者資料**。所有資料都只存在於你的瀏覽器本機，且絕大多數是記憶體暫存——關閉瀏覽器後自動消失。

## 詳細說明

### 我們收集哪些資料

**無。** 本擴充功能不向任何伺服器發送請求、不使用 cookie、不使用 `chrome.identity`、不收集個人資料、不收集使用統計、不使用分析服務。

### 本機儲存（Local-only）

本擴充功能確實會在**你自己的瀏覽器內**儲存幾項資料，但**完全不離開本機、不同步外部**：

| 儲存位置 | 內容 | 生命週期 |
|---|---|---|
| `chrome.storage.sync` | 使用者設定（複製附字號開關、耳標左右位置、展開深度） | 跨裝置同步給**你自己登入的 Google 帳號**，由 Chrome 管理 |
| `chrome.storage.session` | 判決剪貼簿的卡片紀錄（當次瀏覽期間複製過的文字、裁判字號、時間戳、原始網址） | **僅存記憶體**，關閉瀏覽器即自動清空；不寫入硬碟、不同步 |
| `chrome.storage.local` | 側邊欄字體大小偏好（單一數字） | 保存在你本機 Chrome profile 中，不同步 |

`chrome.storage.session` 是 Chrome 原生的記憶體儲存區，專門用於「只在這次瀏覽期間有用」的資料；它不會寫到硬碟，也不會透過 Google 帳號同步到其他裝置。這是判決剪貼簿側邊欄「關瀏覽器即清空」行為的底層機制。

### 擴充功能的行為

1. **僅在下列網域運作**：
   - `https://legal.judicial.gov.tw/FINT/*`（司法院法令判解系統）
   - `https://judgment.judicial.gov.tw/FJUD/*`（司法院裁判書系統）
   - `https://judgment.law.intraj/FJUD/*`（司法院內網裁判書系統）

   其他任何網站完全不會載入此擴充功能的程式碼。

2. **只讀取當前頁面的 DOM 內容**，用來偵測判決段落的編號層級並產生頁內「判決架構」導覽；所有分析都在你的瀏覽器內以 JavaScript 執行，不會離開本機。

3. **攔截複製事件**（`copy` event）：當你在上述網域選取文字並複製時，擴充功能會將選取的文字移除分行並於尾端附上裁判字號，寫回 clipboard；同時把這段文字記到判決剪貼簿側邊欄（存於 `chrome.storage.session`，關瀏覽器即清空）。內容不會傳送到任何外部伺服器。

4. **判決剪貼簿側邊欄**：使用 Chrome 原生的 `sidePanel` API 呈現卡片列表，讓你能跨分頁檢視與再複製當次紀錄。按下「匯出」時產生的 `.txt` / `.md` 檔案由你的瀏覽器直接下載到本機，擴充功能不接觸檔案內容之外的任何東西。

### 使用的 Permissions

| Permission / Host | 為什麼需要 |
|---|---|
| `host: legal.judicial.gov.tw/FINT/*` | 在法令判解系統的裁判書頁面注入判決架構側欄與攔截複製 |
| `host: judgment.judicial.gov.tw/FJUD/*` | 在裁判書系統的裁判書頁面注入判決架構側欄與攔截複製 |
| `host: judgment.law.intraj/FJUD/*` | 同上，供司法院內網使用 |
| `storage` | 使用者設定（sync）、判決剪貼簿卡片（session / 記憶體）、字體大小偏好（local）|
| `sidePanel` | 提供「判決剪貼簿」瀏覽器原生側邊欄 UI |

本擴充功能**沒有**使用 `tabs`、`activeTab`、`cookies`、`history`、`bookmarks`、`webRequest`、`identity`、`downloads`、`clipboardRead`、`scripting` 等任何具有額外權限風險的 API。

### 第三方服務

**無。** 本擴充功能不與任何第三方服務通訊。

### 原始碼

本擴充功能完全開源，原始碼在：
https://github.com/han0302-cyber/judicial-outline-extension

你可以自行審計、修改、本機編譯使用。

### 聯絡方式

若對本隱私政策有疑問，請於 GitHub repo 開 Issue：
https://github.com/han0302-cyber/judicial-outline-extension/issues
