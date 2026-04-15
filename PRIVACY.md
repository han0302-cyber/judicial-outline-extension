# Privacy Policy — 司法院裁判書閱讀助手

**最後更新：2026-04-15**
**擴充功能版本：v0.2.0**

---

## 📌 一句話摘要

本擴充功能 **不向任何遠端伺服器發送任何請求**、**開發者完全接觸不到你的任何資料**、**不追蹤、不分析、不廣告、不轉售**。所有運算都在你自己的瀏覽器本機完成；你在側邊欄看到的剪貼簿紀錄只存在記憶體，關閉瀏覽器就消失。

---

## ✅ 我們明確承諾「不做的事」

以下為本擴充功能在設計上**技術上就做不到**的行為，並非「政策上承諾」：

- ❌ 不向任何遠端伺服器發送任何 HTTP / HTTPS / WebSocket / fetch 請求
- ❌ 不使用任何第三方分析服務（Google Analytics、Sentry、Mixpanel、等等均無）
- ❌ 不使用任何廣告 SDK
- ❌ 不發送 telemetry、crash report、usage metrics
- ❌ 不將使用者資料傳送、轉售、或授權給任何第三方
- ❌ 不將使用者資料用於信用評估、放款決策、或任何與本擴充功能單一用途無關的目的
- ❌ 不讀取、儲存或上傳你的其他瀏覽紀錄、書籤、cookie、密碼、或帳號資訊
- ❌ 不在除了司法院裁判書系統以外的任何網站運作
- ❌ 不使用 `chrome.identity`、`webRequest`、`cookies`、`history`、`bookmarks`、`tabs`、`activeTab`、`clipboardRead`、`scripting`、`downloads` 等任何高風險 API

上述任何一項都可以透過檢視原始碼（見文末連結）自行驗證。

---

## 📂 本機儲存的所有資料（完整清單）

本擴充功能確實會在**你自己的瀏覽器程式內**暫存一些資料，但**所有資料都僅限於你本機、開發者完全接觸不到**：

| 儲存位置 | 內容 | 大小量級 | 生命週期 | 開發者是否能存取 |
|---|---|---|---|---|
| `chrome.storage.session` | 判決剪貼簿卡片（當次瀏覽期間複製過的文字、裁判字號、時間戳、原始網址） | 數 KB ~ 數百 KB | **僅存記憶體**；關閉瀏覽器立即自動清空；不寫入硬碟 | ❌ 否。資料從不離開使用者本機瀏覽器程序 |
| `chrome.storage.sync` | 使用者偏好設定（複製附字號開關、耳標左右位置、展開深度） | < 1 KB | 跨裝置同步給**使用者自己**的 Google 帳號，由 Chrome 直接加密同步 | ❌ 否。同步由 Google Chrome 基礎設施管理，開發者無 API 可讀取任何使用者的 sync 內容 |
| `chrome.storage.local` | 側邊欄字體大小偏好（單一整數） | 幾 bytes | 保存在你本機 Chrome profile 中，不同步 | ❌ 否。只存在使用者本機磁碟 |

### 關於 `chrome.storage.session` 的強調

`chrome.storage.session` 是 Chrome 於 Manifest V3 引入的**原生記憶體儲存區**，技術特性：

- **完全不寫入硬碟**，只存在 Chrome 程序的 RAM 中
- 關閉瀏覽器、登出使用者、Chrome crash 或重啟 → 自動清空
- **不透過 `chrome.storage.sync` 同步**、不會同步到其他裝置
- 擴充功能的不同 context（content script、service worker、side panel）共享同一份資料，但資料**永遠不離開該 Chrome 使用者 profile**

這是判決剪貼簿「關瀏覽器即清空」行為的底層保證，不是政策承諾，是技術層面的不可能。

---

## 🔍 擴充功能的實際行為（逐步說明）

1. **僅在下列網域載入**：
   - `https://legal.judicial.gov.tw/FINT/*` — 司法院法令判解系統
   - `https://judgment.judicial.gov.tw/FJUD/*` — 司法院裁判書系統
   - `https://judgment.law.intraj/FJUD/*` — 司法院內部網路裁判書系統（限院內環境）

   任何其他網站**完全不會載入**此擴充功能的程式碼——瀏覽器根本不會把 content script 注入到這三個 match pattern 以外的任何頁面。

2. **讀取當前判決頁面的 DOM 結構**：用 JavaScript 分析頁面文字節點，偵測判決書常見的層級編號（壹／一／(一)／1./(1)／①）以便產生左側「判決架構」導覽。所有分析過程都在你的瀏覽器 JavaScript engine 內完成，**任何文字片段都不會離開你的電腦**。

3. **攔截複製事件**（`copy` event）：當你在上述網域選取文字並按 Cmd+C / Ctrl+C，擴充功能會：
   - 把選取文字的換行與 CJK 字元間的 padding 空白移除
   - 在尾端附上「（<裁判字號>意旨參照）」
   - 寫回你自己的系統剪貼簿
   - 把這段完整文字加入判決剪貼簿側邊欄（存於 `chrome.storage.session` 記憶體，關瀏覽器即清空）

   **文字只會在你的瀏覽器 → 你的剪貼簿 → 你的記憶體**之間流動，絕對不會送出網路。

4. **判決剪貼簿側邊欄**：使用 Chrome 原生的 `sidePanel` API 呈現卡片列表。點擊卡片上的「複製」鈕會觸發 `navigator.clipboard.writeText()` 把該卡片內容寫回系統剪貼簿，供你在其他分頁（Google Docs、Obsidian 等）貼上。按下「匯出」時產生的 `.txt` / `.md` 檔案由**你自己的瀏覽器**直接下載到本機磁碟——擴充功能本身沒有 `downloads` 權限，無法主動存取檔案系統，純粹是瀏覽器的原生下載行為。

---

## 📋 CWS Data Disclosure 對照

為配合 Chrome Web Store 的資料揭露要求，下表逐項說明本擴充功能**是否接觸/收集**各類 CWS 定義的使用者資料：

| CWS 資料類型 | 是否收集 | 說明 |
|---|---|---|
| Personally identifiable information（個人識別資料） | ❌ 否 | 不讀取姓名、email、電話、地址、ID 等任何個人資料 |
| Health information（健康資料） | ❌ 否 | 不接觸任何健康資料 |
| Financial and payment information（金融支付資料） | ❌ 否 | 不處理任何付款或金融資料 |
| Authentication information（驗證資料） | ❌ 否 | 不讀取密碼、Token、cookie 或其他驗證資訊 |
| Personal communications（個人通訊） | ❌ 否 | 不讀取 email、訊息或通話紀錄 |
| Location（地理位置） | ❌ 否 | 不使用 geolocation 或任何位置 API |
| Web history（瀏覽紀錄） | ❌ 否 | 不讀取瀏覽紀錄、書籤、或分頁清單 |
| User activity（使用者行為） | ❌ 否 | 不追蹤點擊、捲動、按鍵或 session 長度 |
| Website content（網頁內容） | ⚠️ 見下方說明 | 擴充功能會在 JavaScript 層**臨時讀取**裁判書頁面的文字以產生導覽與智慧複製；此類文字**從未離開使用者本機**，依 CWS 政策不構成「data collection」 |

### 關於 Website content 的詳細說明

擴充功能為了產生判決架構導覽與智慧複製功能，**必須**用 JavaScript 讀取當前裁判書頁面的文字內容（這也是所有 content script 類擴充功能的共同特性）。這些文字：

1. 僅在**你的瀏覽器 JavaScript engine 記憶體內**被處理
2. 從不透過 fetch、XHR、WebSocket 或任何其他方式傳送到遠端
3. 當你**複製**時會同時被寫入 `chrome.storage.session`（記憶體暫存），關閉瀏覽器即消失
4. 開發者與任何第三方都**沒有任何管道**能存取這些文字

依 Chrome Web Store Developer Program Policies，資料若**僅在使用者本機裝置暫時處理、從不離開裝置**，不構成「data collection」。本擴充功能完全符合此條件。

---

## ✅ Chrome Web Store 合規聲明

本擴充功能正式聲明：

1. **I do not sell or transfer user data to third parties, outside of the approved use cases.**
   本擴充功能不販售、不轉移使用者資料給任何第三方。技術上也做不到——因為完全不收集資料。

2. **I do not use or transfer user data for purposes that are unrelated to my item's single purpose.**
   本擴充功能不將使用者資料用於與單一用途（協助閱讀與引用台灣司法院裁判書）無關的任何目的。

3. **I do not use or transfer user data to determine creditworthiness or for lending purposes.**
   本擴充功能不將使用者資料用於信用評估或放款決策。

---

## 🔑 使用的 Permissions 與用途

| Permission | 為什麼需要 |
|---|---|
| `host: legal.judicial.gov.tw/FINT/*` | 在法令判解系統的裁判書頁面注入判決架構側欄、攔截複製事件 |
| `host: judgment.judicial.gov.tw/FJUD/*` | 在裁判書系統的裁判書頁面注入判決架構側欄、攔截複製事件 |
| `host: judgment.law.intraj/FJUD/*` | 同上，供司法院內網環境使用 |
| `storage` | 儲存使用者設定（sync）、判決剪貼簿卡片（session 記憶體）、字體大小偏好（local）——全部為本機儲存，無任何遠端傳輸 |
| `sidePanel` | 提供「判決剪貼簿」瀏覽器原生側邊欄 UI，讓使用者跨分頁檢視與再複製當次紀錄 |

**未使用**的敏感 API（明確聲明）：`tabs`、`activeTab`、`cookies`、`history`、`bookmarks`、`webRequest`、`webRequestBlocking`、`declarativeNetRequest`、`identity`、`downloads`、`clipboardRead`、`scripting`、`nativeMessaging`、`management`、`geolocation`、`notifications`。

---

## 🌐 第三方服務

**零**。本擴充功能的 runtime 程式碼不載入任何第三方 library、不呼叫任何第三方 API、不嵌入任何遠端 script 或 iframe。所有程式碼都在本 repo 內,可完整審計。

---

## 📂 原始碼與審計

本擴充功能 100% 開源，所有 runtime 程式碼都可在以下 GitHub repo 檢視：

<https://github.com/han0302-cyber/judicial-outline-extension>

你可以：
- 審計每一行程式碼
- 驗證本政策的所有聲明
- fork 後自行編譯為 unpacked extension 載入

如果在原始碼裡發現任何與本政策不符的行為，歡迎開 Issue 或寄 email 告知。

---

## 📧 聯絡方式

- **GitHub Issues**：<https://github.com/han0302-cyber/judicial-outline-extension/issues>
- **Email**：tinghan.lin@stellexlaw.com

---

## 📝 本政策的變更紀錄

- **2026-04-15（v0.2.0）**：新增判決剪貼簿側邊欄、Side Panel API、`chrome.storage.session`/`local` 說明；擴充 CWS Data Disclosure 對照表；新增合規聲明段落；加上完整「不做的事」清單
- 更早版本：請見 git 歷史 <https://github.com/han0302-cyber/judicial-outline-extension/commits/main/PRIVACY.md>
