# Chrome Web Store 上架文案草稿

直接複製貼到 Chrome Web Store Developer Dashboard 對應欄位即可。

---

## Short description（≤132 字元）

### 繁體中文
> 裁判書頁面加上「判決架構」導覽、最高法院引文參照清單、智慧複製（去分行、附字號），並提供瀏覽器側邊欄「判決剪貼簿」跨分頁保存並匯出複製過的段落。

### English
> Judgment outline sidebar, Supreme Court citation panel, smart copy (strip line breaks + append citation), and a browser side panel clipboard to save and export copied passages across tabs.

---

## Detailed description

### 繁體中文

📑 **判決架構側欄**
自動偵測判決書的多層編號標記 —— 從最外層的「壹／貳」、「一、二、」、「(一)／㈠」，到較深的「1.／⒈／１．」、「(1)／⑴／（１）」、再到最深的「①／②／③」共 6 層階層；以及「主文／事實／理由／事實及理由」段落標題，與判決末尾的「附表／附表一／附表甲／附表壹／附表1」等章段（亦相容「附表X（即起訴書附表X）：」「附表X【被告某某部分併辦】：」等編號後夾括號註記之格式）。在頁面左側（或右側，可設定）產生可點擊的目錄，點擊後平滑捲動到對應段落，自動扣掉頁首固定列的遮擋高度。

側欄會自動跳過引號內被引用的條文（例如「按 X 法第 N 條規定：⋯一、⋯二、⋯」），不會把法條條款誤抓成本篇判決的大綱；卡片寬度也會依當下展開的最深層級自動調整，淺判決保持窄、深判決自動加寬避免標籤被截斷。

🏛 **參照頁籤（裁判意旨引文清單）**
側邊欄另設獨立「參照」頁籤，抽取判決正文所有權威意旨引用並彙整為清單，共涵蓋七類實務寫法：最高法院判決／裁定（`最高法院112年度台上字第187號`）、最高法院大法庭裁定（`最高法院刑事大法庭109年度台上大字第1869號`）、最高法院民刑事庭會議決議（`最高法院94年度第6、7次刑事庭會議決議`，支援多次編號）、法律座談會決議／審查意見（`本院暨所屬法院101年法律座談會民執類提案第18號決議`，涵蓋高院暨所屬法院與高院分院）、大法官釋字解釋（`司法院釋字第679號解釋`）、憲法法庭判決／裁定（`憲法法庭113年憲判字第3號判決`）、最高行政法院庭長法官聯席會議決議（`最高行政法院98年度6月份第1次庭長法官聯席會議決議`）。同一組括號內以頓號並列、第二筆以後省略「最高法院」前綴、跨類混列的寫法亦能逐一拆分並分別歸類。每一筆條目顯示案號 badge 與意旨段落前 90 字摘要（限於同段落內回溯，不跨段抓取），點擊即跳轉至該段落並暫態鵝黃高亮，再點一次清除；七類 badge 依類別分色（主題色／暖琥珀／中性灰／藕紫／深玫瑰紅／淺玫瑰紅／青綠），利於快速辨識。正文中的 `（…）` 引文附記同步以柔和天藍灰底長駐高亮。

✂️ **智慧複製**
選取任何一段判決文字後複製，自動移除換行與中日韓字元間的多餘空白，並於尾端附上「（<裁判字號>意旨參照）」，方便直接貼進書狀或筆記。英數字之間的空格（如 "NT 300"）會被保留。字號附加功能可在設定頁或側邊欄頂端一鍵關閉。另提供 **Cmd+X / Ctrl+X** 快速鍵：同樣正規化後寫入剪貼簿，但不存入剪貼簿卡片，適用於僅需一次性貼到外部工具、不希望累積卡片清單的情境。

📋 **判決剪貼簿側邊欄**
每次 Cmd+C / Ctrl+C 複製後，擴充功能會把「去分行 + 附字號」的完整文字推進 Chrome 瀏覽器原生側邊欄，以卡片形式保存**當次瀏覽期間**的所有判決段落。側邊欄由點擊工具列的擴充功能圖示開啟，**不限於裁判書頁面** —— 切到 Google Docs、Word Online、Obsidian Web、Notion 等任何分頁都看得到同一份卡片清單，點卡片上的「複製」鈕即可貼上，非常適合需要一次引用多段判決文字的書狀撰寫情境。

每張卡片包含來源標籤（裁判書 / 判解函釋 / 內網判解函釋 / 內網裁判書）、可點擊的裁判字號（在新分頁開啟原始判決頁面）、複製時間戳與完整內文；色系依來源系統自動切換，採用司法院官方色票。每張卡片的「**前往**」按鈕可直接跳回該段落在原始判決頁面的位置：原分頁仍開啟即切換並滾動、以黃色持續高亮；已關閉或已導航至其他判決則自動開新分頁載入原文後跳轉。複製當下會於選取文字起迄位置插入隱形錨點，前往時以 DOM 直接定位，不依賴 URL 比對。每張卡片亦可加入自訂 **#標籤**（彩色膠囊樣式，顏色跟隨來源主題）及自由文字**備註**，儲存後直接顯示在卡片上。側邊欄頂端提供**關鍵字搜尋列**，可即時篩選卡片內文、字號、備註或 #標籤；搜尋列下方自動彙整所有標籤為可點選的標籤雲，一鍵篩選特定主題。完全重複的內容自動去重並提示「已複製過相同內容」。字體大小可四段調整（小／中／大／特大），標籤與字號隨內文一起縮放。支援將全部卡片匯出為 `.txt` 純文字或 `.md` Markdown 檔（一併帶出 #標籤與備註），`.md` 為 Obsidian 友善的引用區塊格式，判決字號會做為二級標題、內文為引用區塊，可直接拖進 Obsidian 資料庫檢視。

**隱私設計**：剪貼簿紀錄只存在 `chrome.storage.session`（Chrome 原生記憶體暫存區），關閉瀏覽器即自動清空，**不寫入硬碟、不上傳雲端、不跨裝置同步**。即使同時開多個瀏覽器視窗，紀錄在同一個瀏覽器程序內共享、另開瀏覽器則各自獨立。

⚙️ **後台設定頁面**
  　• 「複製時自動附上裁判字號」開關（預設：開），亦可於判決剪貼簿側邊欄頂端即時切換，兩端共用同一設定
  　• 「顯示參照頁籤」開關（預設：開），關閉後僅保留「判決架構」耳標，正文亦不再長駐高亮括號附記
  　• 法令判解系統、裁判書系統、內網判解函釋、內網裁判書系統的「判決架構」耳標可分別設定停靠在頁面左側或右側
  　• 「展開深度」可在 1 到 6 層之間調整（預設 3）：
  　　　1 — 主文／事實／理由／附表 + 壹、貳、參
  　　　2 — 再加上 一、二、三
  　　　3 — 再加上 (一)、(二) ／ ㈠、㈡（預設）
  　　　4 — 再加上 1.、2. ／ ⒈、⒉ ／ １．、２．
  　　　5 — 再加上 (1)、(2) ／ ⑴、⑵ ／ （１）、（２）
  　　　6 — 再加上 ①、②、③
  　• 設定變更立即套用到開啟中的分頁，跨裝置透過 Chrome 帳號同步

🎨 **自動主題配色**
使用司法院官方色票 —— 判解函釋系統 `#336666`（深青）、裁判書系統 `#336633`（深綠）、司法院內網 `#006699`（海軍藍），與各自原網站主視覺融合。剪貼簿卡片的字號標題、按鈕、滑鼠移入背景也會依來源系統切換主題色。

🔖 **支援頁面**
  - 司法院法令判解系統 — `legal.judicial.gov.tw/FINT/*`
  - 司法院裁判書系統 — `judgment.judicial.gov.tw/FJUD/*`
  - 司法院內部網路判解函釋 — `legal.law.intraj/FINT/*`（限院內網路環境）
  - 司法院內部網路裁判書系統 — `judgment.law.intraj/FJUD/*`（限院內網路環境）

搜尋結果列表頁不會顯示側欄，只在實際判決內容頁才作用。內網版本與外網版本共用同一套邏輯，無需額外安裝。

🙈 **隱私**
本擴充功能不向任何伺服器發送請求，所有資料都只存在於你的瀏覽器本機。判決剪貼簿紀錄只存於記憶體（關瀏覽器即清空），使用者設定透過 Chrome 帳號同步，字體偏好存本機 —— 以上任何資料都不會離開你的瀏覽器、不會傳給任何第三方。原始碼 100% 開源於 GitHub：
https://github.com/han0302-cyber/judicial-outline-extension

**適合誰**
律師、法務、法律系學生、研究者 —— 任何需要快速閱讀長篇判決、引用判決文字、或批次整理判決段落到 Word / Google Docs / Obsidian 的人。

🆕 **v0.2.6 更新**
  • 側邊欄新增「**參照**」頁籤：抽取判決正文所有裁判意旨引用，彙整為獨立清單，點擊即跳轉至被引段落並暫態高亮
  • **七類意旨引用完整涵蓋**：最高法院判決／裁定、最高法院大法庭裁定、最高法院民刑事庭會議決議（含「第6、7次」多次編號）、法律座談會決議／審查意見（本院暨所屬法院、高院暨所屬法院、高院分院等）、大法官釋字解釋、憲法法庭判決／裁定／暫時處分／補充判決、最高行政法院庭長法官聯席會議決議
  • **同一括號內多案號拆分**：以頓號並列、第二筆以後省略前綴、跨類混列寫法皆可正確拆分並分別歸類
  • **隱含「第N號」後續案號回溯**：實務常見「釋字第770號、第488號」或「最高法院90年度台上字第1639號、第2215號、94年度台上字第115號、第2059號」等省略前綴之寫法，解析時依前置 explicit 案號之年度／字別（或釋字屬性）補齊 label，使同一括號內全部案號完整呈現
  • **兩種引用格式相容**：除括號式 `（最高法院…）` 外，亦支援行內無括號寫法（如「有最高法院X年度台上字第N號…判決要旨，及同院Y年度第K次民事庭決議可參」），以鄰近分群與尾隨結論語擴張辨識
  • **嚴格區分援引與反駁**：行內式引用須於尾端出現強結論語（意旨參照／可參／可資參照／足資參照等）始接受，否則視為反駁或討論性引用予以剔除
  • **段落邊界以項目符號劃界**：意旨段落起點以階層編號（壹／一／㈠／(一)／1.／⒈／(1)／⑴／①）及區塊邊界為界，對無明顯空白段落之判決（如司法院內網 FINT 以 `<pre>` 排版之長段落）亦可精準落於當段段首
  • **FINT 軟斷行容錯**：讀取文字節點時將內文之 `\n`／`\r` 正規化為半形空白，使 FINT 視覺折行不致打斷關鍵字比對，亦不致被誤認為段落邊界
  • **同段多引用接續**：同段內多筆引用之跳轉範圍自前一筆結束處起算，不再重複覆蓋段首共同前言；段首項目符號自動剝除
  • **點擊切換暫態高亮**：條目點擊後以鵝黃暫態高亮整段意旨；同條再點擊即清除
  • **一鍵複製並存入卡片**：每筆條目右側提供「複製」按鈕，點擊即將該筆意旨段落正規化後寫入系統剪貼簿（是否附上本篇裁判字號依後台設定），並同步推入判決剪貼簿卡片；插入書籤錨點供日後「前往」跳轉
  • **正文引文括號長駐高亮**：所有 `（…）` 附記以柔和天藍灰底長駐高亮，閱讀時可快速掃視；七類案號以類別分色（主題色／暖琥珀／中性灰／藕紫／深玫瑰紅／淺玫瑰紅／青綠）
  • **後台新增「參照耳標」開關**（預設開）：如無需使用可一鍵關閉，關閉後完全跳過引文抽取與正文長駐高亮

🆕 **v0.2.5 更新**
  • 判決架構耳標新增「**附表**」章段偵測：判決書末尾的 `附表` 視為與主文、事實、理由同級之章段標題，支援 `附表：`、`附表一／二`（中文數字）、`附表甲／乙`（天干）、`附表壹／貳`（全形中文數字）、`附表1／２`（半形或全形阿拉伯數字）等編號形式
  • 相容實務常見的「編號後夾括號註記」寫法：`附表X（即起訴書附表X）：`、`附表X【被告某某部分併辦】：` 等格式亦能正確命中
  • 嚴格收斂誤判：要求 `附表X` 必須獨占新行且緊接全形或半形冒號（或為行尾），正文中「如附表一所示」「附表一、二所示建物」「附表所載」等行文不會被誤判為章段
  • 耳標標籤只顯示「附表」或「附表X」前綴，不含後續標題與括號註記，維持側欄視覺簡潔

🆕 **v0.2.4 更新**
  • 判決剪貼簿側邊欄頂端新增「**附上字號 開／關**」即時切換，與設定頁共用同一設定，任一端變更即時同步至所有分頁、設定頁與 content script，不需開後台
  • 新增 **Cmd+X / Ctrl+X 快速複製但不存卡片**：同樣套用正規化與字號附加（若已開啟）寫入剪貼簿，但跳過「判決剪貼簿」卡片入檔，適用於僅需一次性貼到外部工具、不希望卡片清單累積的情境
  • 可編輯欄位（搜尋框、登入框等）的原生剪下行為保留不受攔截

🆕 **v0.2.3 更新**
  • 判決剪貼簿卡片新增「**前往**」按鈕：一鍵跳回該段落在原始判決頁面的位置
  • **書籤錨點定位**：複製當下在選取文字起迄位置各插入一個隱形錨點，前往時用 DOM 直接定位，不依賴 URL 比對，即使頁面有 SPA 重繪也能穩定命中
  • **智慧分頁處理**：原分頁還開著 → 切換並滾動；分頁已關或導航到其他判決 → 自動開新分頁載入原文再跳轉
  • **持續高亮**：跳轉到的段落以黃色高亮持續顯示，下一次前往時才會覆蓋
  • 內網卡片標籤拆分為「內網判解函釋」與「內網裁判書」兩類，與外網卡片的系統分類對齊

🆕 **v0.2.2 更新**
  • 新增支援司法院內部網路判解函釋 (`legal.law.intraj/FINT/*`)，院內使用 Chrome 亦可在判解函釋使用判決架構耳標與智慧複製功能
  • 設定頁「耳標位置」內網判解函釋與內網裁判書系統可分別設定左右側

🆕 **v0.2.1 更新**
  • 判決剪貼簿新增 **#標籤** 功能：每張卡片可加入自訂 #標籤，以彩色膠囊樣式顯示，顏色跟隨來源主題
  • 判決剪貼簿新增**備註**功能：每張卡片可撰寫自由文字備註，儲存後直接顯示在卡片上
  • 判決剪貼簿新增**關鍵字搜尋列**：即時篩選卡片內文、字號、備註或 #標籤
  • 搜尋列下方自動彙整所有標籤為可點選的**標籤雲**，一鍵篩選特定主題
  • 判決剪貼簿支援**拖拉排序**：按住卡片拖曳到目標位置即可重新排列順序
  • 匯出 `.txt` / `.md` 時一併帶出 #標籤與備註
  • 司法院內網專屬配色（海軍藍 `#006699`），與內網頁面背景色融合
  • 後台設定新增內網耳標位置（左/右）獨立設定
  • 內網裁判書系統支援 `judgment.law.intraj/FJUD/*`
  • 裁判字號擷取改進：正確截斷「量刑趨勢建議」等頁面附加文字，支援判決、裁定、決定書、判例、裁判書等各類書類字號
  • 修正 FJUD data.aspx 頁面的 `<dt>`/`<dd>` metadata 結構，字號擷取不再漏抓
  • 修正「關閉附字號」時卡片不顯示字號標題的問題

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
Automatically detects the full 6-level Taiwanese legal numbering hierarchy — from top-level 壹/貳 → 一/二 → (一)/㈠ → 1./⒈/１． → (1)/⑴/（１） → ①/②/③ — plus the section headings 主文/事實/理由/事實及理由 and trailing 附表 blocks (including 附表一, 附表甲, 附表壹, 附表1 variants). Builds a clickable table of contents on the left (or right, configurable) edge of the page. Clicking an item smoothly scrolls to the corresponding paragraph, with the sticky header offset baked in. Quoted statute citations (e.g. "按 X 法第 N 條規定：⋯一、⋯二、⋯") are skipped so the outline reflects only the ruling's own structure. Card width auto-adjusts to the deepest expanded level, keeping shallow rulings narrow and wide rulings readable.

✂️ **Smart copy**
Select any judgment text and copy it — line breaks and padding whitespace between CJK characters are stripped automatically, and the citation suffix `（<case-number>意旨參照）` is appended. Spaces between ASCII alphanumerics (like "NT 300") are preserved. The citation suffix can be toggled off from either the options page or the side panel header. A secondary shortcut **Cmd+X / Ctrl+X** also writes the normalized (and optionally citation-suffixed) text to the clipboard but skips the clipboard-card store, for one-off pastes that shouldn't accumulate in the card list.

📋 **Clipboard side panel**
Every Cmd+C / Ctrl+C is also saved as a card in Chrome's native side panel, accumulating **every copy made during the current browser session**. Open the panel from the toolbar icon — it's **not limited to ruling pages**, so you can switch to Google Docs, Word Online, Obsidian Web, Notion, etc. and still see the same card list, clicking each card's "Copy" button to paste one by one. Ideal for brief-writing workflows that cite multiple passages.

Each card shows the source tag (裁判書 / 判解函釋 / 內網判解函釋 / 內網裁判書), the clickable case number (opens the original ruling in a new tab), a timestamp, and the full text. Theme colors switch automatically by source. A **"Go to source"** button on each card jumps back to the exact paragraph on the original ruling page: if the original tab is still open, it switches and scrolls with a persistent yellow highlight; if closed or navigated elsewhere, a new tab is opened and auto-scrolls after load. Invisible anchors inserted at copy time allow direct DOM lookup, so positioning does not depend on URL matching. Each card also supports custom **#hashtags** (Obsidian-style colored pills that follow the source theme) and free-text **memos**, both saved and displayed directly on the card. A **keyword search bar** at the top filters cards by text, case number, memo, or #hashtag in real time; below it, an auto-generated **tag cloud** lets you filter by topic with one click. Exact duplicates are de-duplicated with a toast notification. Four-step font scaling (small / medium / large / extra-large) scales the tag, label, and body together. Export all cards as `.txt` or `.md` (including #hashtags and memos) — the `.md` format uses H2 headings for case numbers and blockquotes for judgment text, making it a clean drop-in for Obsidian vaults.

**Privacy by design**: Clipboard history is stored only in `chrome.storage.session` (Chrome's native in-memory storage). It is wiped the moment you close the browser — **never written to disk, never uploaded, never synced across devices**.

⚙️ **Options page**
  • Toggle "append citation on copy" (default: on) — also exposed at the top of the clipboard side panel as an inline switch; both endpoints share the same setting and propagate changes instantly

  • Per-site sidebar position (left / right) for FINT, FJUD, intranet FINT, and intranet FJUD
  • "Expand depth" slider 1–6 (default 3): controls how deep the outline auto-expands
  • All changes apply instantly to open tabs; user settings sync across devices via your Chrome account

🎨 **Auto theme**
Official Judicial Yuan palette — dark teal `#336666` for FINT (judicial interpretations), dark green `#336633` for FJUD (rulings), and navy blue `#006699` for the Judicial Yuan intranet. Clipboard card accent colors, buttons, and hover backgrounds also follow the source system's theme.

🔖 **Supported pages**
  - Taiwan Judicial Yuan Legal Search — `legal.judicial.gov.tw/FINT/*`
  - Taiwan Judicial Yuan Judgments — `judgment.judicial.gov.tw/FJUD/*`
  - Judicial Yuan Intranet Legal Interpretations — `legal.law.intraj/FINT/*` (intranet-only)
  - Judicial Yuan Intranet Judgments — `judgment.law.intraj/FJUD/*` (intranet-only)

Search result lists are ignored; the outline only appears on actual ruling pages. The intranet build shares the same codebase and needs no extra installation.

🙈 **Privacy**
No network requests. All data stays on your local browser. Clipboard cards live in `chrome.storage.session` (in-memory only, cleared on browser close); user settings sync via `chrome.storage.sync`; font-size preference lives in `chrome.storage.local`. None of it ever leaves your browser or reaches any third party. Source code fully open at:
https://github.com/han0302-cyber/judicial-outline-extension

**Who is it for**
Lawyers, legal staff, law students, and researchers — anyone who needs to read long Taiwanese rulings quickly, cite judgment text, or batch-collect passages into Word / Google Docs / Obsidian.

🆕 **v0.2.6 changes**
  • New **"Citations" sidebar tab**: extracts every authoritative opinion citation in the ruling (Supreme Court judgments/rulings, Supreme Court Grand Chamber rulings, Supreme Court civil/criminal chamber resolutions, inter-court symposium resolutions, Grand Justices' interpretations, Constitutional Court judgments, and Supreme Administrative Court presiding-justice joint conference resolutions — seven categories in total), with per-entry jump and transient highlight
  • **Full-text scan with proximity grouping** replaces paren-only detection, covering both parenthesized form `（最高法院…）` and inline prose form (`…有最高法院X年度台上字第N號判決要旨，及同院Y年度第K次民事庭決議可參`); multi-case lists separated by 、 are split even when later entries omit the "最高法院" prefix
  • **Cite vs. rebut disambiguation**: inline citations must end with a strong concluder (意旨參照／要旨參照／可資參照／足資參照／可參／參照 etc.) to be accepted; otherwise treated as a rebuttal reference (e.g., "…援引最高法院XX決議，惟…不同") and omitted, so courts' refuted precedents are not marked as authority
  • **Paragraph boundary via hierarchy markers**: opinion passage start is determined by hierarchy numerals (壹／一／㈠／(一)／1.／⒈／(1)／⑴／①) and block-level boundaries. Even for rulings without visible paragraph breaks (e.g. Judicial Yuan intranet FINT pages that render long passages in `<pre>`-style layout with many soft line wraps), the highlight correctly lands at the current section's head
  • **Implicit bare "第N號" backfill**: Practitioners often omit the prefix on second and later entries (e.g. "釋字第770號、第488號" or "最高法院90年度台上字第1639號、第2215號、94年度台上字第115號、第2059號"); bare 第N號 is resolved by the year/character of the nearest preceding explicit citation (or by the interpretation class), so the full list of cases within one parenthetical is surfaced
  • **FINT soft-wrap tolerance**: `\n` and `\r` within text-node content are normalized to ASCII space at read time (character-for-character substitution, preserving segment lengths and DOM offset mapping), so FINT's visual line wrapping does not break keyword matching or be mistaken for a paragraph boundary
  • **Multi-citation paragraph continuity**: when several citations appear in one paragraph, each subsequent entry's jump range starts from the previous citation's end; leading enumeration markers are automatically stripped
  • **One-click "Copy" button** on each citation entry: normalizes the passage (optionally appending the current judgment's case label, per the "append citation" setting) and writes to the system clipboard while simultaneously pushing it into the clipboard card list with bookmark anchors for later "Go to source" jumps
  • **Persistent inline highlight** on every `（最高法院…）` marker (soft sky-blue tint); case badges are color-coded by category — Supreme Court judgment (theme color) / Grand Chamber (warm amber) / chamber resolution (neutral grey) / symposium (lilac) / Grand Justices interpretation (deep rose) / Constitutional Court (light rose) / Supreme Administrative joint conference (teal)
  • Added **"Show Citations tab" toggle** to the options page (on by default); disabling it skips the extraction entirely and removes both the tab and the inline highlight

🆕 **v0.2.5 changes**
  • Outline now detects **trailing 附表 section headings** as first-level entries alongside 主文 / 事實 / 理由. Supports `附表：`, `附表一／二` (Chinese numerals), `附表甲／乙` (Heavenly Stems), `附表壹／貳` (full-width Chinese numerals), and `附表1／２` (half-width or full-width Arabic numerals)
  • Also handles the common practitioner format where the numeral is followed by a parenthetical or bracketed note before the colon, e.g. `附表X（即起訴書附表X）：` or `附表X【被告某某部分併辦】：`
  • Strict false-positive controls: the heading must occupy its own new line and `附表X` must be followed by a full-width or half-width colon (or end of line). Inline prose such as `如附表一所示`, `附表一、二所示建物`, or `附表所載` is not mistaken for a heading even when it happens to follow a sentence-ending `。`
  • Outline label only shows the `附表` or `附表X` prefix — parenthetical notes and trailing titles are omitted to keep the sidebar compact

🆕 **v0.2.4 changes**
  • New **inline "append citation" toggle** at the top of the clipboard side panel: shares the same setting as the options page, and changes propagate instantly across all tabs, the options page, and the content script — no need to open the backend
  • New **Cmd+X / Ctrl+X shortcut — copy without adding to cards**: applies the same normalization and citation suffix (when enabled) to the clipboard, but skips the clipboard-card store, for one-off pastes to external tools that shouldn't accumulate in the card list
  • Native cut behavior is preserved inside editable fields (search boxes, login forms, etc.) — only non-editable selections on ruling pages are intercepted

🆕 **v0.2.3 changes**
  • New **"Go to source"** button on each clipboard card: jumps back to the exact paragraph on the original ruling page
  • **Bookmark anchor positioning**: two invisible anchor spans are inserted at the selection boundaries at copy time; jump-back uses direct DOM lookup, not URL matching, so it survives SPA re-renders
  • **Smart tab handling**: if the original tab is still open → switch and scroll; if closed or navigated away → open a new tab and auto-scroll after load
  • **Persistent highlight**: the jumped-to paragraph stays highlighted in yellow until the next jump
  • Intranet card labels split into "內網判解函釋" / "內網裁判書", aligning with the external system's per-source classification

🆕 **v0.2.2 changes**
  • Added support for the Judicial Yuan intranet legal interpretations (`legal.law.intraj/FINT/*`)
  • Intranet sidebar position (left / right) now independently configurable for legal interpretations and judgments

🆕 **v0.2.1 changes**
  • New per-card **#hashtag** support: Obsidian-style colored pills, theme-matched to source system
  • New per-card **memo** notes: free-text annotations saved and displayed directly on cards
  • New **keyword search bar**: real-time filtering by text, case number, memo, or #hashtag
  • Auto-generated **tag cloud** below search bar for one-click topic filtering
  • **Drag-and-drop reordering**: hold and drag a card to rearrange its position
  • Export `.txt` / `.md` now includes #hashtags and memos
  • Dedicated navy blue theme (`#006699`) for the Judicial Yuan intranet
  • Intranet sidebar position (left / right) now independently configurable
  • Added support for Judicial Yuan intranet judgment system (`judgment.law.intraj/FJUD/*`)
  • Case label extraction improved: correctly trims trailing page artifacts (e.g. "量刑趨勢建議"); supports 判決, 裁定, 決定書, 判例, and 裁判書 document types
  • Fixed FJUD data.aspx `<dt>`/`<dd>` metadata structure — case label no longer missed
  • Fixed case label not appearing on cards when "append citation" setting is off

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

### Host permissions: `legal.judicial.gov.tw/FINT/*`, `judgment.judicial.gov.tw/FJUD/*`, `legal.law.intraj/FINT/*`, `judgment.law.intraj/FJUD/*`

**Justification（繁中）**：
擴充功能必須在司法院公開網域（FINT 法令判解系統、FJUD 裁判書系統）與司法院內部網路的裁判書及法令判解頁面上注入 DOM 元件（判決架構導覽側欄）以及攔截複製事件（移除換行、附上裁判字號、紀錄到判決剪貼簿側邊欄）。功能完全限定於這四個網域，不會存取其他網站。內網判解函釋網域（`legal.law.intraj`）限定於 `/FINT/*` 路徑；內網裁判書網域（`judgment.law.intraj`）限定於 `/FJUD/*` 路徑。行為與公開網域一致，供院內使用者安裝同一份擴充功能使用。

**Justification (English)**:
The extension needs to inject DOM elements (the outline sidebar) and intercept the copy event (line-break stripping, citation suffix, and logging to the clipboard side panel) on ruling pages hosted at the Taiwan Judicial Yuan's public domains (FINT legal interpretations, FJUD rulings) and the Judicial Yuan's internal intranet. All functionality is strictly limited to these four hosts; no other websites are accessed. The intranet legal interpretations host (`legal.law.intraj`) is scoped to `/FINT/*`; the intranet judgment host (`judgment.law.intraj`) is scoped to `/FJUD/*`. Both behave identically to the public hosts and let Judicial Yuan staff install the same extension for internal use.

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
