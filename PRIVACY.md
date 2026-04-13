# Privacy Policy — 司法院裁判書助手

**最後更新：2026-04-13**

## 簡短版

本擴充功能 **不收集、不儲存、不傳送任何使用者資料**。所有處理都在你的瀏覽器本機完成。

## 詳細說明

### 我們收集哪些資料

**無。** 本擴充功能不向任何伺服器發送請求、不使用 cookie、不使用 localStorage、不使用 IndexedDB、不使用 `chrome.storage`、不使用 `chrome.identity`、不收集個人資料或使用統計。

### 擴充功能的行為

1. **僅在下列網域運作**：
   - `https://legal.judicial.gov.tw/FINT/*`（司法院法學資料檢索系統）
   - `https://judgment.judicial.gov.tw/FJUD/*`（司法院裁判書系統）

   其他任何網站完全不會載入此擴充功能的程式碼。

2. **只讀取當前頁面的 DOM 內容**，用來偵測判決段落的編號層級並產生左側「判決架構」導覽；所有分析都在你的瀏覽器內以 JavaScript 執行，不會離開本機。

3. **攔截複製事件**（`copy` event）：當你在上述網域選取文字並複製時，擴充功能會將選取的文字移除分行並於尾端附上裁判字號，寫回 clipboard。複製的內容只存在於你的系統剪貼簿，擴充功能不會保留、傳送或記錄它。

### 使用的 Permissions

| Permission / Host | 為什麼需要 |
|---|---|
| `host: legal.judicial.gov.tw/FINT/*` | 在法學資料檢索系統的裁判書頁面注入判決架構側欄 |
| `host: judgment.judicial.gov.tw/FJUD/*` | 在裁判書系統的裁判書頁面注入判決架構側欄 |

本擴充功能**沒有**使用 `storage`、`tabs`、`activeTab`、`cookies`、`history`、`bookmarks`、`webRequest`、`identity`、`downloads`、`clipboardWrite` 等任何 API permission。

### 第三方服務

**無。** 本擴充功能不與任何第三方服務通訊。

### 原始碼

本擴充功能完全開源，原始碼在：
https://github.com/han0302-cyber/judicial-outline-extension

你可以自行審計、修改、本機編譯使用。

### 聯絡方式

若對本隱私政策有疑問，請於 GitHub repo 開 Issue：
https://github.com/han0302-cyber/judicial-outline-extension/issues
