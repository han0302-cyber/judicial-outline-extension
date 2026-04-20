// 司法院裁判書閱讀助手 — content script
//
// 支援網域：
//   legal.judicial.gov.tw/FINT/*    （法令判解系統）
//   judgment.judicial.gov.tw/FJUD/* （裁判書系統）
//   legal.law.intraj/FINT/*         （內網判解函釋）
//   judgment.law.intraj/FJUD/*      （內網裁判書系統）
//
// 四項主要功能：
//   1. 於頁面側緣注入「判決架構」卡片（以滑鼠停駐式頁籤呈現），偵測正
//      文之階層編號（壹、一、(一)、㈠⋯）與主文／事實／理由／附表等章
//      段，點擊即平滑捲動至對應段落。
//   2. 於同一側邊欄另設「參照」頁籤，抽取正文所有裁判意旨引用（最高法
//      院判決／裁定、最高法院大法庭裁定、最高法院民刑事庭會議決議、
//      法律座談會決議、大法官釋字解釋、憲法法庭判決及最高行政法院庭
//      長法官聯席會議決議共七類），列出每筆意旨段落摘要、案號清單、
//      跳轉按鈕與複製按鈕；正文之括號附記同步以 CSS Highlight API 長
//      駐高亮。
//   3. 攔截 copy 事件：將選取文字之換行壓縮為單行，於尾端附上「（<裁
//      判字號>意旨參照）」後寫入系統剪貼簿（Windows／macOS 通用）。
//      另攔截 cut 事件，提供 Cmd／Ctrl+X「僅複製、不存入剪貼簿卡片」
//      之情境。
//   4. 裁判字號自頁面「裁判字號：」欄位擷取後移除所有空白。
//
// 不改動頁面排版——僅於文字節點插入隱形 <span id> 作為錨點，不影響
// 任何既有之縮排或斷行。

(function () {
  'use strict'

  if (window.__fintHelperInstalled) return
  window.__fintHelperInstalled = true

  // ----- User preferences (from chrome.storage.sync) -----
  //
  // Per-site sidebar placement + global "append citation suffix on copy"
  // toggle. Defaults: positions = left, appendCitation = true. User can
  // change them via the extension's options page; values are populated
  // asynchronously when storage resolves and live-updated via onChanged.
  let userPositions = {
    fint: 'left',
    fjud: 'left',
    intraj_fint: 'left',
    intraj_fjud: 'left',
  }
  let userAppendCitation = true
  // 耳標展開到第幾層（user-facing 深度，1-6）。內部 level 是 0-5，使用者
  // 看到的深度 = 內部 level + 1：
  //   1 = 主文/壹                2 = +一/二              3 = +(一)/㈠ (預設)
  //   4 = +1./⒈/１．             5 = +(1)/⑴/（１）       6 = +①/②/③
  // 預設停在 3 = 三層大綱，多數判決閱讀已足夠。
  let userMaxDepth = 3
  // 參照耳標開關：控制是否渲染「參照」頁籤與正文引文長駐高亮。預設開啟；
  // 關閉後僅保留「判決架構」耳標，適合不熟悉或不想看到最高法院引用清單
  // 的使用者。
  let userShowCitations = true
  const positionsReady = new Promise((resolve) => {
    try {
      chrome.storage.sync.get(
        {
          positions: userPositions,
          appendCitation: true,
          maxDepth: 3,
          showCitations: true,
        },
        (result) => {
          if (result && result.positions) {
            userPositions = Object.assign({}, userPositions, result.positions)
          }
          if (result && typeof result.appendCitation === 'boolean') {
            userAppendCitation = result.appendCitation
          }
          if (result && typeof result.maxDepth === 'number') {
            userMaxDepth = clampDepth(result.maxDepth)
          }
          if (result && typeof result.showCitations === 'boolean') {
            userShowCitations = result.showCitations
          }
          resolve()
        },
      )
    } catch (_) {
      resolve()
    }
  })
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return
      let needsRerender = false
      if (changes.positions) {
        userPositions = Object.assign(
          {},
          userPositions,
          changes.positions.newValue || {},
        )
        needsRerender = true
      }
      if (changes.appendCitation) {
        userAppendCitation = changes.appendCitation.newValue !== false
        // Copy handler reads userAppendCitation lazily on each event,
        // so the new value applies immediately to the next copy.
      }
      if (changes.maxDepth) {
        userMaxDepth = clampDepth(changes.maxDepth.newValue)
        needsRerender = true
      }
      if (changes.showCitations) {
        userShowCitations = changes.showCitations.newValue !== false
        needsRerender = true
      }
      if (needsRerender) {
        sidebarBuilt = false
        removeExistingSidebar()
        tryBuildSidebar()
      }
    })
  } catch (_) {}

  function clampDepth(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 3
    if (n < 1) return 1
    if (n > 6) return 6
    return Math.floor(n)
  }

  // ----- Host document resolution -----
  //
  // FJUD 將判決內容置於 iframe 中，iframe 的高度會隨內容撐開，導致 iframe
  // 內部的 position:fixed 實際表現如同 position:absolute（黏在 iframe 左上
  // 角且不隨捲動）。解法：將側欄 DOM 掛到同源的 top document，使 fixed 以
  // 最外層 viewport 為基準；節點定位仍透過 iframe 內的 anchor element，
  // scrollIntoView 會自動上溯至父層捲軸。
  function resolveHostDoc() {
    try {
      const top = window.top
      if (top && top !== window && top.document && top.document.body) {
        void top.location.href // throws on cross-origin
        return top.document
      }
    } catch (_) {}
    return document
  }
  const hostDoc = resolveHostDoc()

  // ----- Hierarchy detection (ported from frontend/src/utils/judgmentFormatter.js) -----
  const CHINESE_UPPER_NUM = '[壹貳參肆伍陸柒捌玖拾甲乙丙丁戊己庚辛壬癸]'
  const CHINESE_NUM = '[一二三四五六七八九十百零〇]'
  // 阿拉伯數字：半形 0-9 + 全形 ０-９（U+FF10-FF19），兩者一律當同一層
  const ARABIC_NUM = '[\\d\\uff10-\\uff19]'
  // 句點/逗點分隔符：半形 . ,、全形 ． ，、CJK 、 。 全部列入
  const NUM_SEP = '[、，。．,.]'

  // 台灣判決常見的完整 6 層階層：
  //   壹 → 一 → (一)/㈠ → 1./⒈ → (1)/⑴ → ①
  // Pass A 在候選位置（句尾標點後 / 行首）用這些 pattern 抓 level。
  // 呼叫端目前用 `level > 5` 過濾（見下方 startCandidates 迴圈）。
  const HIERARCHY_PATTERNS = [
    { level: 0, pattern: new RegExp('^' + CHINESE_UPPER_NUM + '+\\s*' + NUM_SEP) },
    { level: 1, pattern: new RegExp('^' + CHINESE_NUM + '+\\s*' + NUM_SEP) },
    { level: 2, pattern: /^[\u3220-\u3229]/ },
    { level: 2, pattern: new RegExp('^[（(]\\s*' + CHINESE_NUM + '+\\s*[）)]') },
    // level 3: 1. / 1、 / １． / １、 / ⒈⒉⒊...（U+2488-249B）
    //          全形與半形阿拉伯數字一律算第 3 層
    { level: 3, pattern: new RegExp('^' + ARABIC_NUM + '+\\s*' + NUM_SEP) },
    { level: 3, pattern: /^[\u2488-\u249B]/ },
    // level 4: (1) / （1） / （１） / ⑴⑵⑶...（U+2474-2487）
    { level: 4, pattern: new RegExp('^[（(]\\s*' + ARABIC_NUM + '+\\s*[）)]') },
    { level: 4, pattern: /^[\u2474-\u2487]/ },
    // level 5: ①②③...（U+2460-2473）
    { level: 5, pattern: /^[\u2460-\u2473]/ },
  ]

  function detectLevel(text) {
    const trimmed = (text || '').replace(/^\s+/, '')
    if (!trimmed) return null
    for (const { level, pattern } of HIERARCHY_PATTERNS) {
      if (pattern.test(trimmed)) return level
    }
    return null
  }

  // 於 text[pos..bound) 開頭依序剝除任意階層項目符號（壹/一/(一)/1./㈠/⒈/
  // ⑴/① 等），回傳越過 marker 與其後空白之新起點。用於計算意旨段落的
  // 起始位置時跳過編號字首，使參照 jumpRange 從正文第一字起算而非包含
  // 項目符號本身。重複比對以因應極少見的巢狀起首（如「一、(一)按…」）。
  function skipEnumerationMarkers(text, pos, bound) {
    let p = pos
    while (p < bound) {
      while (p < bound && /[\s\u3000]/.test(text.charAt(p))) p++
      if (p >= bound) break
      const head = text.slice(p, Math.min(p + 24, bound))
      let matchedLen = 0
      for (const { pattern } of HIERARCHY_PATTERNS) {
        const m = head.match(pattern)
        if (m) {
          matchedLen = m[0].length
          break
        }
      }
      if (!matchedLen) break
      p += matchedLen
    }
    return p
  }

  function shortenLabel(text, max) {
    max = max || 28
    if (!text) return ''
    const collapsed = text.replace(/\s+/g, ' ').trim()
    if (collapsed.length <= max) return collapsed
    return collapsed.slice(0, max) + '…'
  }

  // ----- Locate judgment body -----
  function findBodyContainer() {
    // 兩個來源網站結構不同：
    //
    //   FJUD (judgment.judicial.gov.tw/FJUD/data.aspx)：
    //     #jud → .htmlcontent / .text-pre / .jud_content
    //     注意：搜尋結果列表也用 #jud 但 tag 是 <table>，要濾掉。
    //
    //   FINT (legal.judicial.gov.tw/FINT/data.aspx)：
    //     #plCJData .col-all.text-pre  (憲法法庭裁判等)
    //     #plFull   .col-all.text-pre  (精選裁判全文等)

    // FJUD
    const jud = document.querySelector('#jud')
    if (jud && jud.tagName !== 'TABLE') {
      for (const sel of ['.htmlcontent', '.text-pre', '.jud_content']) {
        const el = jud.querySelector(sel)
        if (el && el.textContent.trim().length >= 50) return el
      }
      if (jud.textContent.trim().length >= 50) return jud
    }

    // FINT
    for (const rootSel of ['#plCJData', '#plFull']) {
      const root = document.querySelector(rootSel)
      if (!root) continue
      const body =
        root.querySelector('.col-all.text-pre') ||
        root.querySelector('.col-all') ||
        root.querySelector('.text-pre')
      if (body && body.textContent.trim().length >= 50) return body
    }

    // FINT generic fallback
    const generic = document.querySelector('.col-all.text-pre')
    if (generic && generic.textContent.trim().length >= 50) return generic

    return null
  }

  // ----- Flatten container into a single string + text-node offset map,
  //       detect marker hits on the flat string, then map positions back to
  //       the original text nodes to insert invisible <span id> anchors.
  //
  // 為什麼用扁平字串？
  //   司法院的「判決易讀小幫手」會把專有名詞包進 <a>，使一個段落被拆成多個
  //   text node（例：「㈠關於 / <a>某專有名詞</a> / 即…」）。若逐 text node
  //   處理，label 會被截斷、跨 text node 的 inline 標記會漏掉。先扁平化再
  //   偵測，就能跨 <a> 抓到完整的段落標題。
  //
  // 三層偵測，對齊 Nerikiri 的 normalizeInlineMarkers 邏輯：
  //   (1) 物理行首：壹/一/(一)/1./㈠/⒈/⑴ ...
  //   (2) 任意位置的單字元 CJK enclosed 中文數字 (㈠-㈩)
  //   (3) 句尾標點後的 (一)/（一） 括號式中文數字
  function annotateAnchors(container) {
    if (!container) return []

    const BLOCK_TAGS = /^(DIV|P|PRE|LI|UL|OL|TABLE|TR|TD|TH|H[1-6]|SECTION|ARTICLE|BLOCKQUOTE)$/i

    // --- Flatten DOM ---
    //
    // segments: [{ node, start, end }] — each text node's range within `full`.
    // `full` additionally includes '\n' at block boundaries / <br> so that
    // line-start detection works across block elements.
    const segments = []
    let full = ''
    const ensureNewline = () => {
      if (full && !full.endsWith('\n')) full += '\n'
    }
    const walk = (el) => {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const v = child.nodeValue || ''
          if (!v) continue
          segments.push({ node: child, start: full.length, end: full.length + v.length })
          full += v
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName
          if (tag === 'BR') { ensureNewline(); continue }
          if (tag === 'SCRIPT' || tag === 'STYLE') continue
          const isBlock = BLOCK_TAGS.test(tag)
          if (isBlock) ensureNewline()
          walk(child)
          if (isBlock) ensureNewline()
        }
      }
    }
    walk(container)

    if (!full.trim()) return []

    // --- 引號區段標記表 ---
    //
    // 判決常引用法條，形如：「按 X 法第 N 條規定：『有下列情形之一者：
    // 一、... 二、... 三、...』」。引號內的 一/二/三 不屬於本篇大綱，須從
    // 編號偵測中排除。
    //
    // 採局部封閉配對：遇到 「（或 『）後，向後在 MAX_QUOTE_SPAN 字範圍內找
    // 相對應的 」（或 』）。配對成功則將中間區間標記為「引號內」；配對失敗
    // 則忽略該開引號。不使用累積 depth 計數，避免孤立引號造成後續全段落被
    // 誤判。
    const MAX_QUOTE_SPAN = 1500
    const insideQuote = new Uint8Array(full.length)
    {
      let i = 0
      while (i < full.length) {
        const ch = full.charAt(i)
        if (ch === '「' || ch === '『') {
          const close = ch === '「' ? '」' : '』'
          const limit = Math.min(full.length, i + MAX_QUOTE_SPAN)
          let j = -1
          for (let k = i + 1; k < limit; k++) {
            if (full.charAt(k) === close) { j = k; break }
          }
          if (j !== -1) {
            for (let k = i + 1; k < j; k++) insideQuote[k] = 1
            i = j + 1
            continue
          }
        }
        i++
      }
    }

    // --- Collect hit positions on the flat string ---
    //
    // 判決段落 section heading：
    //   單字段：主文 / 事實 / 理由（可能寫成「主 文」「主　文」）
    //   合併段：事實及理由（部分法院如地院刑事判決常用）
    const SECTION_HEADER_RE = /^(?:[主事理][\s\u3000]*[文實由]|事[\s\u3000]*實[\s\u3000]*及[\s\u3000]*理[\s\u3000]*由)[\s\u3000]*$/
    // 判決末尾附表：與主文、理由同級之章段標題，常見格式：
    //   附表：　　　　　（單獨一行）
    //   附表一：／附表二：（中文數字）
    //   附表甲：／附表乙：（天干）
    //   附表壹：販賣第二級毒品甲基安非他命部分：（全形中文數字與標題同行）
    //   附表1：／附表２：（半形或全形阿拉伯數字）
    //   附表一（即起訴書附表一）：（編號後夾全形括號註記）
    //   附表十四【被告廖威承部分退併辦】：（編號後夾全形方括號註記）
    // 硬性要求「附表X」之後緊接全形或半形冒號（允許中間夾一段全形/半形
    // 括號或方括號註記），或為行尾，始視為章段標題。正文中「附表一、二
    // 所示建物」「附表一所載」「附表所示金額」等行文即使落在「。」後之
    // 行首候選位置，亦因缺少冒號而不致誤判。標籤僅截取「附表」或
    // 「附表X」前綴，不含後續標題與括號註記，以免耳標過長。
    const APPENDIX_HEADER_RE = /^(附[\s\u3000]*表[\s\u3000]*(?:[一二三四五六七八九十百千]+|[甲乙丙丁戊己庚辛壬癸]+|[壹貳參肆伍陸柒捌玖拾]+|[\d\uFF10-\uFF19]+)?)[\s\u3000]*(?:[（(【][^）)】\n]*[）)】][\s\u3000]*)?(?:[：:]|$)/
    // 句尾/段首上下文：這些字元之後的下一個非空白字元是潛在的 line start。
    const START_CONTEXT_RE = /[。！？；：!?;:\n]/

    const lineTextAt = (pos) => {
      let end = full.indexOf('\n', pos)
      if (end === -1) end = full.length
      return full.slice(pos, end).trim()
    }

    const rawSeen = new Set()
    const rawHits = [] // { pos, level, forcedLabel? }
    const pushRaw = (pos, level, forcedLabel) => {
      if (rawSeen.has(pos)) return
      rawSeen.add(pos)
      rawHits.push({ pos, level, forcedLabel })
    }

    // Pass A: line-start-ish candidates. 候選位置 = 0 與任何 START_CONTEXT_RE
    // 字元之後的下一個非空白位置。此設計可涵蓋「。八、……」這類同段內
    // 以句號分界的編號，不僅限於物理 \n 之後。
    const startCandidates = []
    if (full.length > 0) startCandidates.push(0)
    for (let i = 1; i < full.length; i++) {
      if (START_CONTEXT_RE.test(full.charAt(i - 1))) startCandidates.push(i)
    }

    for (const candidate of startCandidates) {
      if (candidate >= full.length) continue
      // 跳過前置空白
      let realPos = candidate
      while (realPos < full.length && /\s/.test(full.charAt(realPos))) realPos++
      if (realPos >= full.length) continue

      const lineText = lineTextAt(realPos)
      if (!lineText) continue

      // 引號內的 一/二/三（法條引用等）不算大綱，直接 skip。
      // Section heading 故意繞過這個檢查 —— 因為 "主文" "事實" "理由" "附表"
      // 不會出現在引號內，這個 check 對它們是 no-op；但 enum 編號就會被濾。
      const appendixMatch = insideQuote[realPos] ? null : lineText.match(APPENDIX_HEADER_RE)
      if (insideQuote[realPos] && !SECTION_HEADER_RE.test(lineText)) continue

      // 附表章段：標籤僅取「附表」或「附表X」前綴，略過後續標題文字。
      // 另要求附表獨占新行（由 realPos 往回僅能跨越水平空白即應撞到
      // 換行字元或文件開頭），排除「。附表壹：…」此類因句號觸發行首
      // 候選、實際仍在前句同一行之誤判。
      if (appendixMatch) {
        let back = realPos - 1
        while (back >= 0 && /[ \t\u3000]/.test(full.charAt(back))) back--
        if (back < 0 || full.charAt(back) === '\n') {
          pushRaw(realPos, 0, appendixMatch[1].replace(/\s+/g, ''))
          continue
        }
      }

      // Section heading (主文/事實/理由) — force short label so the label
      // slicer below doesn't spill into the section's body content when
      // the heading isn't immediately followed by a numbered marker.
      if (SECTION_HEADER_RE.test(lineText)) {
        pushRaw(realPos, 0, lineText.replace(/\s+/g, ''))
        // If the next non-empty line below this heading has no hierarchy
        // marker (typical of 主文 — unnumbered verdict text), synthesise a
        // level-1 entry pointing at the first content line so users can
        // still navigate to the body from the outline.
        const nlPos = full.indexOf('\n', realPos)
        if (nlPos !== -1 && nlPos + 1 < full.length) {
          let contentPos = nlPos + 1
          while (
            contentPos < full.length &&
            /\s/.test(full.charAt(contentPos))
          ) contentPos++
          if (contentPos < full.length) {
            const contentLine = lineTextAt(contentPos)
            if (
              contentLine &&
              !SECTION_HEADER_RE.test(contentLine) &&
              detectLevel(full.slice(contentPos, contentPos + 24)) === null
            ) {
              pushRaw(contentPos, 1)
            }
          }
        }
        continue
      }

      // 只看前 24 字做 level detection，避免第一行過長時正則掃太久
      const head = full.slice(realPos, realPos + 24)
      const level = detectLevel(head)
      if (level === null || level > 5) continue
      pushRaw(realPos, level)
    }

    // Pass B: 任意位置的 enclosed numeral 都可以安全當錨點，因為單一字元本身
    // 就是明確的編號 marker，不會跟正文衝突。涵蓋四組：
    //   ㈠-㈩  U+3220-3229  → level 2
    //   ⒈-⒛  U+2488-249B  → level 3（帶句點的阿拉伯數字）
    //   ⑴-⒇  U+2474-2487  → level 4（括號內阿拉伯數字）
    //   ①-⑳  U+2460-2473  → level 5（圓圈阿拉伯數字）
    // 同樣受引號深度過濾，避免引用條文中的 ⑴ 被誤抓。
    for (let i = 0; i < full.length; i++) {
      if (insideQuote[i]) continue
      const cp = full.charCodeAt(i)
      if (cp >= 0x3220 && cp <= 0x3229) pushRaw(i, 2)
      else if (cp >= 0x2488 && cp <= 0x249b) pushRaw(i, 3)
      else if (cp >= 0x2474 && cp <= 0x2487) pushRaw(i, 4)
      else if (cp >= 0x2460 && cp <= 0x2473) pushRaw(i, 5)
    }

    if (!rawHits.length) return []

    // --- Build labels by slicing between consecutive hits ---
    //
    // 按位置排序後，每個 hit 的 label = full.slice(hit.pos, nextHit.pos)，
    // 上限 80 字。這樣不論 block 邊界在哪，label 都不會越界吃進下一個 marker。
    rawHits.sort((a, b) => a.pos - b.pos)
    const hits = []
    for (let i = 0; i < rawHits.length; i++) {
      const cur = rawHits[i]
      let label
      if (cur.forcedLabel) {
        label = cur.forcedLabel
      } else {
        const next = rawHits[i + 1]
        const labelEnd = Math.min(next ? next.pos : full.length, cur.pos + 80)
        label = full.slice(cur.pos, labelEnd).replace(/\s+/g, '').trim()
      }
      if (!label) continue
      hits.push({ pos: cur.pos, level: cur.level, text: label })
    }

    if (!hits.length) return []

    // --- Map flat-string hit positions to (textNode, offsetInNode) ---
    const locate = (pos) => {
      for (const seg of segments) {
        if (pos >= seg.start && pos < seg.end) {
          return { node: seg.node, offset: pos - seg.start }
        }
      }
      // Fall back to the earliest segment whose start >= pos
      for (const seg of segments) {
        if (seg.start >= pos) return { node: seg.node, offset: 0 }
      }
      return null
    }

    // Sort globally tail→head so every splitText on a given node sees a
    // still-valid offset (splitText on descending positions within one node
    // is safe; across nodes the ordering doesn't matter).
    hits.sort((a, b) => b.pos - a.pos)

    let counter = 0
    const inserted = []
    for (const hit of hits) {
      const loc = locate(hit.pos)
      if (!loc) continue
      try {
        const tail = loc.offset === 0 ? loc.node : loc.node.splitText(loc.offset)
        const id = 'fint-anchor-' + counter++
        const anchor = document.createElement('span')
        anchor.id = id
        anchor.className = 'fint-anchor'
        tail.parentNode.insertBefore(anchor, tail)
        inserted.push({ id: id, level: hit.level, text: hit.text })
      } catch (_) {
        // ignore — offset may exceed a shortened node
      }
    }

    // Return in document order (we inserted descending).
    inserted.reverse()
    return inserted
  }

  // ----- Citation extraction (裁判意旨參照) -----
  //
  // 抽取判決正文中之常見權威意旨引用，包括：
  //   A. 最高法院判決／裁定：最高法院XX年度台（上|非|抗|聲|覆）字第XXX號
  //   B. 最高法院大法庭裁定：最高法院（刑事|民事）?大法庭XX年度台（上|抗|非）大字第XXX號
  //   C. 最高法院庭會議決議：最高法院XX年度第N次（民事|刑事|民刑事）庭會議決議／決定
  //      （含「第6、7次」這類單筆引用涵蓋多場會議之寫法）
  //   D. 法律座談會決議：本院暨所屬法院／臺灣高等法院（分院）／最高法院／司法院
  //      XX年法律座談會（民事|刑事|民執|刑執...）類提案第N號（決議|審查意見|研究意見...）
  //   E. 大法官釋字解釋：司法院釋字第N號解釋（2022 年憲法訴訟法施行前之舊制）
  //   F. 憲法法庭判決／裁定：憲法法庭XX年憲（判|裁|暫|補）字第N號判決／裁定
  //      （2022 年憲法訴訟法施行後之新制）
  //   G. 最高行政法院庭長法官聯席會議決議：本院／最高行政法院XX年度
  //      （M月份）?第N次庭長法官聯席會議決議（對應行政訴訟之權威見解）
  //
  // 架構採「全文掃描 + 鄰近分群」而非「括號內掃描」，以同時涵蓋以下兩種
  // 實務寫法：
  //   A. 括號式：…（最高法院112年度台上字第187號判決意旨參照）。
  //   B. 行內式：有最高法院90年度台上字第1639號、第2215號、94年度台上字
  //              第115號、第2059號判決要旨，及同院95年4月4日95年度第5次
  //              民事庭決議可參。
  //
  // 解析流程：
  //   1. 將容器 DOM 扁平化為單一字串 full 與 segments。
  //   2. 以 7 支案號 regex 於 full 上全文比對，GC 先於 JUD（「大字」同吻合
  //      「字」之特徵，須保留 GC 佔用區間以濾除 JUD 重複匹配）。
  //   3. 鄰近分群：相鄰兩筆匹配之間的 gap 若 ≤ MAX_GROUP_GAP 字且不含 \n
  //      或 。，視為同一引文條目；跨段或跨句自動切為新條目。
  //   4. 每一條目：
  //      - citeRange.end 向後貪婪擷取 尾隨結論語（判決意旨參照／要旨可參／
  //        可資參照／足資參照 等），再貪婪擷取鄰近之 `）`；
  //      - citeRange.start 向前貪婪擷取鄰近之 `（`；
  //      - opinionStart 預設為段落起點（最近 \n 之後）；若前一條目落於
  //        同段落內，則以前一條目之結尾為起點（避免第二、三則引用重複
  //        覆蓋段首共同前言）。
  //
  // 為每一筆引文建立兩組 Live Range：
  //   jumpRange — 涵蓋意旨段落起點至條目結束位置，側邊欄點擊時以
  //               scrollAndHighlightRange 捲動 + 暫態高亮，讓使用者一眼
  //               看到完整被引段落。
  //   citeRange — 僅含引文本身（括號附記或行內案號串），註冊到
  //               CSS.highlights('fint-citation') 作為長駐高亮，閱讀時
  //               可快速掃到。
  //
  // 不插入任何 <span> 錨點（Live Range 會隨後續 splitText 自動修正），避免
  // 與 annotateAnchors 的錨點插入互相干擾。
  //
  // 案號 regex kind 標記：
  //   'grand' | 'judgment' | 'resolution' | 'symposium' |
  //   'interpretation' | 'constitutional' | 'admin'
  //   label 為呈現用的案號字串（保留原文前綴，如「本院暨所屬法院」）。
  // 大法庭裁定的「大字」會同時吻合一般判決的「字」規則，因此先跑 GC_RE，
  // 再將其佔用區間從後續兩組 regex 過濾掉，避免重複抓。
  const GC_CASE_RE =
    /(?:最高法院)?[\s\u3000]*(?:(刑事|民事)?[\s\u3000]*大法庭)[\s\u3000]*(\d+)[\s\u3000]*年[\s\u3000]*度?[\s\u3000]*台[\s\u3000]*(上|抗|非)[\s\u3000]*大[\s\u3000]*字[\s\u3000]*第?[\s\u3000]*(\d+)[\s\u3000]*號(?:[\s\u3000]*(判決|裁定))?/g
  const JUD_CASE_RE =
    /(?:最高法院[\s\u3000]*)?(\d+)[\s\u3000]*年[\s\u3000]*度?[\s\u3000]*台[\s\u3000]*(上|非|抗|聲|覆)[\s\u3000]*字[\s\u3000]*第?[\s\u3000]*(\d+)[\s\u3000]*號(?:[\s\u3000]*(判決|裁定))?/g
  // RES 之第 N 次編號允許「第6、7次」多場合寫法，以 \d+(?:、\d+)* 捕獲整組
  // 數字串，label 時原樣保留。
  const RES_CASE_RE =
    /(?:最高法院[\s\u3000]*)?(\d+)[\s\u3000]*年[\s\u3000]*度?[\s\u3000]*第[\s\u3000]*(\d+(?:[\s\u3000]*[、,][\s\u3000]*\d+)*)[\s\u3000]*次[\s\u3000]*(民事|刑事|民刑事)[\s\u3000]*庭[\s\u3000]*(?:總?會議)?(?:[\s\u3000]*(決議|決定))?/g
  // SYM 法律座談會：
  //   court prefix 強制需為以下清單之一（本院／臺灣高等法院（含四個分院）／
  //   最高法院／司法院），配合 optional「暨所屬法院」後綴；避免把其他文字
  //   誤當成 symposium 的開頭。
  //   category 涵蓋常見類別（民事／刑事／民執／刑執／家事／少年／強制執行／非訟）
  //   motion 多為「提案」，亦見「研究案／審議案」
  //   dispo 多為「決議」，亦見「決定／審查意見／研究意見／研究結果／結論」
  const SYM_CASE_RE =
    /((?:本院(?:暨[\s\u3000]*所屬[\s\u3000]*法院)?|(?:臺灣|台灣)高等法院(?:(?:臺中|高雄|花蓮|金門)分院)?(?:暨[\s\u3000]*所屬[\s\u3000]*法院)?|最高法院|司法院))[\s\u3000]*(\d+)[\s\u3000]*年(?:[\s\u3000]*度)?[\s\u3000]*法律座談會[\s\u3000]*((?:民事|刑事|民執|刑執|家事|少年|強制執行|非訟)類)?[\s\u3000]*(提案|研究案|審議案)?[\s\u3000]*第[\s\u3000]*(\d+)[\s\u3000]*號(?:[\s\u3000]*(決議|決定|審查意見|研究意見|研究結果|結論))?/g
  // INT 大法官釋字解釋：
  //   前綴「司法院」/「大法官」皆為可選，僅憑「釋字」特徵字即足以識別；
  //   釋字解釋號次歷來由 1 持續累加至 813 號後停發（2022 年憲訴法施行），
  //   故不需年度欄位。label 一律正規化為「司法院釋字第N號解釋」。
  const INT_CASE_RE =
    /(?:司法院[\s\u3000]*)?(?:大法官[\s\u3000]*)?釋字[\s\u3000]*第[\s\u3000]*(\d+)[\s\u3000]*號(?:[\s\u3000]*解釋)?/g
  // CON 憲法法庭判決／裁定／暫時處分／補充判決：
  //   前綴「司法院」與「憲法法庭」任一皆可（實務兩種寫法並存），以 * 允許
  //   兩者同時出現或皆略去；字別涵蓋 憲判字／憲裁字／憲暫字／憲補字。
  //   label 一律正規化為「憲法法庭XX年憲X字第N號{判決|裁定|暫時處分|補充判決}」。
  const CON_CASE_RE =
    /(?:(?:司法院|憲法法庭)[\s\u3000]*)*(\d+)[\s\u3000]*年(?:[\s\u3000]*度)?[\s\u3000]*憲[\s\u3000]*(判|裁|暫|補)[\s\u3000]*字[\s\u3000]*第[\s\u3000]*(\d+)[\s\u3000]*號(?:[\s\u3000]*(判決|裁定))?/g
  // ADMIN 最高行政法院庭長法官聯席會議決議：
  //   最高行政法院之權威見解統一以「庭長法官聯席會議決議」形式發布，結構
  //   與最高法院之「民刑事庭會議」不同，故另立一類。year 後可有「M月份」
  //   副標（如 98年度6月份第1次）；次數允許「第N、M次」多次編號。
  //   label 保留原文前綴（「本院」或「最高行政法院」），避免誤標其他行政
  //   法院之自引。
  const ADMIN_CASE_RE =
    /(最高行政法院|本院)[\s\u3000]*(\d+)[\s\u3000]*年(?:[\s\u3000]*度)?[\s\u3000]*(?:(\d+)[\s\u3000]*月份)?[\s\u3000]*第[\s\u3000]*(\d+(?:[\s\u3000]*[、,][\s\u3000]*\d+)*)[\s\u3000]*次[\s\u3000]*庭長法官聯席會議(?:[\s\u3000]*(決議|決定))?/g

  function rangesOverlap(aStart, aEnd, ranges) {
    for (const [s, e] of ranges) {
      if (!(aEnd <= s || aStart >= e)) return true
    }
    return false
  }

  // 全文掃描所有案號 regex，以 GC > JUD 優先序保留佔用區間解決「大字/字」
  // 特徵衝突，其他類別之間結構不重疊。回傳依起點排序的 match 陣列：
  //   [{ kind, label, sortKey, start, end }, ...]
  function collectCaseMatches(full) {
    const out = []
    const occupied = []

    const pushNonOverlap = (start, end, caseObj) => {
      if (rangesOverlap(start, end, occupied)) return
      occupied.push([start, end])
      out.push({ start, end, ...caseObj })
    }

    // Pass 1: 大法庭裁定
    for (const m of full.matchAll(GC_CASE_RE)) {
      const [mtxt, chamber, year, word, no, dispo] = m
      const start = m.index
      const end = start + mtxt.length
      pushNonOverlap(start, end, {
        kind: 'grand',
        label: `最高法院${chamber || ''}大法庭${year}年度台${word}大字第${no}號${dispo || '裁定'}`,
        sortKey: `1-${String(year).padStart(4, '0')}-${word}-${String(no).padStart(6, '0')}`,
      })
    }
    // Pass 2: 一般判決／裁定
    for (const m of full.matchAll(JUD_CASE_RE)) {
      const [mtxt, year, word, no, dispo] = m
      const start = m.index
      const end = start + mtxt.length
      pushNonOverlap(start, end, {
        kind: 'judgment',
        label: `最高法院${year}年度台${word}字第${no}號${dispo || '判決'}`,
        sortKey: `2-${String(year).padStart(4, '0')}-${word}-${String(no).padStart(6, '0')}`,
      })
    }
    // Pass 3: 最高法院民刑事庭會議決議
    for (const m of full.matchAll(RES_CASE_RE)) {
      const [mtxt, year, nth, chamber, dispo] = m
      const start = m.index
      const end = start + mtxt.length
      const firstNo = String(nth).split(/[、,]/)[0].trim()
      pushNonOverlap(start, end, {
        kind: 'resolution',
        label: `最高法院${year}年度第${nth}次${chamber}庭會議${dispo || '決議'}`,
        sortKey: `3-${String(year).padStart(4, '0')}-${chamber}-${firstNo.padStart(3, '0')}`,
      })
    }
    // Pass 4: 法律座談會
    for (const m of full.matchAll(SYM_CASE_RE)) {
      const [mtxt, prefixRaw, year, category, motion, no, dispo] = m
      const start = m.index
      const end = start + mtxt.length
      const prefix = (prefixRaw || '').replace(/[\s\u3000]+/g, '')
      pushNonOverlap(start, end, {
        kind: 'symposium',
        label: `${prefix}${year}年法律座談會${category || ''}${motion || '提案'}第${no}號${dispo || '決議'}`,
        sortKey: `4-${String(year).padStart(4, '0')}-${prefix}-${String(no).padStart(4, '0')}`,
      })
    }
    // Pass 5: 大法官釋字
    for (const m of full.matchAll(INT_CASE_RE)) {
      const [mtxt, no] = m
      const start = m.index
      const end = start + mtxt.length
      pushNonOverlap(start, end, {
        kind: 'interpretation',
        label: `司法院釋字第${no}號解釋`,
        sortKey: `5-${String(no).padStart(4, '0')}`,
      })
    }
    // Pass 6: 憲法法庭
    const dispoDefault = { 判: '判決', 裁: '裁定', 暫: '暫時處分', 補: '補充判決' }
    for (const m of full.matchAll(CON_CASE_RE)) {
      const [mtxt, year, charWord, no, dispo] = m
      const start = m.index
      const end = start + mtxt.length
      pushNonOverlap(start, end, {
        kind: 'constitutional',
        label: `憲法法庭${year}年憲${charWord}字第${no}號${dispo || dispoDefault[charWord] || '判決'}`,
        sortKey: `6-${String(year).padStart(4, '0')}-${charWord}-${String(no).padStart(4, '0')}`,
      })
    }
    // Pass 7: 最高行政法院庭長法官聯席會議
    for (const m of full.matchAll(ADMIN_CASE_RE)) {
      const [mtxt, prefixRaw, year, month, nth, dispo] = m
      const start = m.index
      const end = start + mtxt.length
      const prefix = (prefixRaw || '').replace(/[\s\u3000]+/g, '')
      const monthPart = month ? `${month}月份` : ''
      const firstNo = String(nth).split(/[、,]/)[0].trim()
      pushNonOverlap(start, end, {
        kind: 'admin',
        label: `${prefix}${year}年度${monthPart}第${nth}次庭長法官聯席會議${dispo || '決議'}`,
        sortKey: `7-${String(year).padStart(4, '0')}-${firstNo.padStart(3, '0')}`,
      })
    }

    out.sort((a, b) => a.start - b.start)
    return out
  }

  // 引文結尾結論語解析：
  //   grammar = (等)? (判決|裁定|決議|解釋|判例)? (意旨|要旨)? CONCLUDER
  // CONCLUDER（「強結論語」）為實務上表示「引用此見解」之定型結尾詞。
  // 用途：
  //   1. 為已接受之引文擴張 citeRange，將結論語納入長駐高亮範圍。
  //   2. 對行內式（無括號包裹）引文，強結論語是唯一接受依據 — 若結尾無
  //      結論語，則視為反駁或討論性引用（如「…援引最高法院XX決議，惟
  //      該決議…」「…所引用之XXX…均屬…之前，應無可採」）予以剔除，
  //      避免把法院正在排斥的先例也標示為參照。
  // 括號式引文以 `（…）` 本身為引文定型標記，即便內部無結論語亦接受。
  const STRONG_CONCLUDERS = [
    '同此意旨',
    '同此旨',
    '意旨參照',
    '要旨參照',
    '意旨可參',
    '要旨可參',
    '可資參照',
    '足資參照',
    '參照',
    '可參',
    '參看',
    '同旨',
  ]
  const CONCLUSION_PREFIXES = ['判決', '裁定', '決議', '解釋', '判例']
  const CONCLUSION_IDX = ['意旨', '要旨']

  function consumeConclusion(full, origEnd) {
    let p = origEnd
    const skipWs = () => {
      while (p < full.length && /[\s\u3000]/.test(full.charAt(p))) p++
    }
    skipWs()
    // 可選之「等」前綴（如「…號等判決意旨參照」）
    if (p < full.length && full.charAt(p) === '等') {
      p++
      skipWs()
    }
    // 可選之文書類別前綴
    for (const w of CONCLUSION_PREFIXES) {
      if (full.startsWith(w, p)) {
        p += w.length
        break
      }
    }
    skipWs()
    // 可選之「意旨／要旨」指示詞
    for (const w of CONCLUSION_IDX) {
      if (full.startsWith(w, p)) {
        p += w.length
        break
      }
    }
    skipWs()
    // 必要：強結論語。長→短順序嘗試（STRONG_CONCLUDERS 已預排）。
    for (const w of STRONG_CONCLUDERS) {
      if (full.startsWith(w, p)) {
        return { end: p + w.length, strong: true }
      }
    }
    return { end: origEnd, strong: false }
  }

  // 判斷範圍是否被括號包裹（左右各有 `（`／`(` 及 `）`／`)`，僅以空白間隔
  // 亦算）。括號包裹者視為定型引文定型標記，可免要求強結論語。
  function maybeExpandToParens(full, s, e) {
    let left = s - 1
    while (left >= 0 && /[\s\u3000]/.test(full.charAt(left))) left--
    const hasLeft =
      left >= 0 && (full.charAt(left) === '（' || full.charAt(left) === '(')
    let right = e
    while (right < full.length && /[\s\u3000]/.test(full.charAt(right))) right++
    const hasRight =
      right < full.length &&
      (full.charAt(right) === '）' || full.charAt(right) === ')')
    const paren = hasLeft && hasRight
    return {
      start: paren ? left : s,
      end: paren ? right + 1 : e,
      paren,
    }
  }

  function extractCitations(container) {
    if (!container) return []

    const BLOCK_TAGS =
      /^(DIV|P|PRE|LI|UL|OL|TABLE|TR|TD|TH|H[1-6]|SECTION|ARTICLE|BLOCKQUOTE)$/i

    const segments = []
    let full = ''
    const ensureNewline = () => {
      if (full && !full.endsWith('\n')) full += '\n'
    }
    const walk = (el) => {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const v = child.nodeValue || ''
          if (!v) continue
          segments.push({
            node: child,
            start: full.length,
            end: full.length + v.length,
          })
          full += v
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName
          if (tag === 'BR') {
            ensureNewline()
            continue
          }
          if (tag === 'SCRIPT' || tag === 'STYLE') continue
          const isBlock = BLOCK_TAGS.test(tag)
          if (isBlock) ensureNewline()
          walk(child)
          if (isBlock) ensureNewline()
        }
      }
    }
    walk(container)
    if (!full.trim()) return []

    // FJUD／FINT 以 <pre>-like CSS 顯示判決正文，文字節點內常含「換行 + 4
    // 空白縮排」之軟斷行（如 `最高法\n    院67年度...`），會打斷 regex 的
    // 關鍵字比對。為此建立：
    //   searchFull      — 移除所有空白字元（含 \n、全形空白）之壓縮字串
    //   searchToFull[i] — searchFull 第 i 個字元對應到 full 之原始索引
    // Regex 於 searchFull 比對；結束後再以 searchToFull 把 search 範圍映
    // 射回 full，交給 locate/Range 以正確定位 DOM 位置。
    let searchFull = ''
    const searchToFull = []
    for (let i = 0; i < full.length; i++) {
      const ch = full.charAt(i)
      if (!/[\s\u3000]/.test(ch)) {
        searchFull += ch
        searchToFull.push(i)
      }
    }
    if (!searchFull) return []

    // 將 searchFull 之 [ss, se) 半開區間映射回 full 之 [fs, fe) 半開區間。
    const toFullRange = (ss, se) => {
      if (se <= ss) return { fullStart: searchToFull[ss] || 0, fullEnd: searchToFull[ss] || 0 }
      const fs = searchToFull[ss]
      const fe = searchToFull[se - 1] + 1
      return { fullStart: fs, fullEnd: fe }
    }

    // Stage 1: 於 searchFull 跑 7 類案號 regex
    const matches = collectCaseMatches(searchFull)
    if (!matches.length) return []

    // Stage 2: 鄰近分群
    //   - gap 長度檢查（≤ MAX_GROUP_GAP）以 searchFull 座標計算（因軟斷行
    //     的空白已被壓縮，此長度即「實質字距」）。
    //   - `。` 檢查亦於 searchFull（`。` 非空白，未被剔除）。
    //   - `\n` 檢查需於 full：對應之 fullGap 區間若含 \n 表示跨段。
    const MAX_GROUP_GAP = 50
    const groups = []
    for (const m of matches) {
      const last = groups[groups.length - 1]
      if (last) {
        const gapS = searchFull.slice(last.end, m.start)
        const lastEndFull = searchToFull[last.end - 1] + 1
        const curStartFull = searchToFull[m.start]
        const gapFull = full.slice(lastEndFull, curStartFull)
        const hasBreak =
          gapFull.indexOf('\n') !== -1 || gapS.indexOf('。') !== -1
        if (!hasBreak && gapS.length <= MAX_GROUP_GAP) {
          last.cases.push({
            kind: m.kind,
            label: m.label,
            sortKey: m.sortKey,
          })
          last.end = m.end
          continue
        }
      }
      groups.push({
        start: m.start,
        end: m.end,
        cases: [{ kind: m.kind, label: m.label, sortKey: m.sortKey }],
      })
    }

    // Stage 3: consumeConclusion 與 maybeExpandToParens 均於 searchFull 上
    // 執行（括號／結論語皆非空白，不受壓縮影響；且 searchFull 中關鍵字
    // 為連續字元，strings.startsWith 直接命中）。
    const acceptedGroups = []
    for (const g of groups) {
      const { end: newEnd, strong } = consumeConclusion(searchFull, g.end)
      const expanded = maybeExpandToParens(searchFull, g.start, newEnd)
      g.start = expanded.start
      g.end = expanded.end
      if (strong || expanded.paren) acceptedGroups.push(g)
    }
    if (!acceptedGroups.length) return []

    // Stage 4: 將 search 座標映射回 full，並計算 opinionStart。
    //   opinionStart 需於 full 上計算（需要 \n 當段落邊界）。
    //   計算順序：
    //     (1) 預設為最近 \n 之後（段落開頭）
    //     (2) 若前一筆接受之引文落於同段落內，改以其結尾為起點
    //     (3) 跳過銜接性空白與句末標點（。；;，,）
    //     (4) 剝除段首階層項目符號（壹/一/(一)/1./㈠/⒈/⑴/①…），
    //         使高亮不含編號本身，僅涵蓋實質意旨文字
    let lastFullEnd = -1
    for (const g of acceptedGroups) {
      const { fullStart, fullEnd } = toFullRange(g.start, g.end)
      g.fullStart = fullStart
      g.fullEnd = fullEnd
      const lastNl = full.lastIndexOf('\n', g.fullStart - 1)
      const paraStart = lastNl === -1 ? 0 : lastNl + 1
      let opStart = paraStart
      if (lastFullEnd > paraStart && lastFullEnd < g.fullStart) {
        opStart = lastFullEnd
      }
      while (
        opStart < g.fullStart &&
        /[\s\u3000。；;，,]/.test(full.charAt(opStart))
      ) {
        opStart++
      }
      opStart = skipEnumerationMarkers(full, opStart, g.fullStart)
      g.opinionFullStart = opStart
      lastFullEnd = g.fullEnd
    }

    // Stage 5: 以 segments 將 full 座標定位為 (node, offset)，建立 Live Range。
    const ownerDoc = container.ownerDocument || document
    const locate = (pos) => {
      for (const seg of segments) {
        if (pos >= seg.start && pos < seg.end) {
          return { node: seg.node, offset: pos - seg.start }
        }
      }
      for (const seg of segments) {
        if (seg.start >= pos) return { node: seg.node, offset: 0 }
      }
      if (segments.length) {
        const last = segments[segments.length - 1]
        return {
          node: last.node,
          offset: (last.node.nodeValue || '').length,
        }
      }
      return null
    }

    const result = []
    for (const g of acceptedGroups) {
      const osLoc = locate(g.opinionFullStart) || locate(g.fullStart)
      const psLoc = locate(g.fullStart)
      const peLoc = locate(g.fullEnd - 1)
      if (!osLoc || !psLoc || !peLoc) continue

      let jumpRange = null
      let citeRange = null
      try {
        jumpRange = ownerDoc.createRange()
        jumpRange.setStart(osLoc.node, osLoc.offset)
        const peLen = (peLoc.node.nodeValue || '').length
        jumpRange.setEnd(peLoc.node, Math.min(peLoc.offset + 1, peLen))

        citeRange = ownerDoc.createRange()
        citeRange.setStart(psLoc.node, psLoc.offset)
        citeRange.setEnd(peLoc.node, Math.min(peLoc.offset + 1, peLen))
      } catch (_) {
        jumpRange = null
        citeRange = null
      }
      if (!jumpRange || !citeRange) continue

      const excerpt = full
        .slice(g.opinionFullStart, g.fullEnd)
        .replace(/\s+/g, '')
        .trim()

      result.push({
        jumpRange,
        citeRange,
        cases: g.cases,
        excerpt,
      })
    }

    return result
  }

  // ----- Sidebar rendering -----

  // 將文件內的元素滾動至適當位置（扣掉 sticky header 高度），供「判決架構」
  // 頁籤點擊 anchor 使用；與舊版 inline 實作完全等價。
  function scrollToTargetElement(target) {
    if (!target) return
    const HEADER_OFFSET = 120
    const inIframe = window !== window.top
    try {
      if (inIframe) {
        const topWin = hostDoc.defaultView || window
        let y = target.getBoundingClientRect().top
        let w = window
        while (w !== topWin && w.frameElement) {
          y += w.frameElement.getBoundingClientRect().top
          w = w.parent
        }
        const desired = topWin.scrollY + y - HEADER_OFFSET
        topWin.scrollTo({
          top: desired,
          left: topWin.scrollX,
          behavior: 'smooth',
        })
      } else {
        let scroller = null
        let p = target.parentElement
        while (p) {
          const st = getComputedStyle(p)
          if (
            (st.overflowY === 'auto' || st.overflowY === 'scroll') &&
            p.scrollHeight > p.clientHeight + 1
          ) {
            scroller = p
            break
          }
          p = p.parentElement
        }
        if (scroller) {
          const tRect = target.getBoundingClientRect()
          const sRect = scroller.getBoundingClientRect()
          scroller.scrollTo({
            top: scroller.scrollTop + (tRect.top - sRect.top) - HEADER_OFFSET,
            left: scroller.scrollLeft,
            behavior: 'smooth',
          })
        } else {
          window.scrollTo({
            top:
              window.scrollY + target.getBoundingClientRect().top - HEADER_OFFSET,
            left: window.scrollX,
            behavior: 'smooth',
          })
        }
      }
    } catch (_) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function shortenExcerpt(text, max) {
    max = max || 90
    if (!text) return ''
    const collapsed = text.replace(/\s+/g, '').trim()
    if (collapsed.length <= max) return collapsed
    return collapsed.slice(0, max) + '…'
  }

  function renderSidebar(items, citations) {
    // 依使用者設定套用最大展開深度。User-facing 深度 1–6 對應內部 level
    // 0–5，filter 條件等價於 level < userMaxDepth。被過濾掉的 anchor 仍
    // 保留於 DOM，以便日後展開不需重新偵測。
    items = (items || []).filter((it) => (it.level || 0) < userMaxDepth)
    citations = citations || []

    // 清掉既有的 sidebar + toast：父層 default.aspx 不會隨 iframe 導航重載，
    // 殘留的 DOM 會指向已失效的 iframe anchor。
    const old = hostDoc.getElementById('fint-outline-sidebar')
    if (old) old.remove()
    const oldToast = hostDoc.getElementById('fint-copy-toast')
    if (oldToast) oldToast.remove()

    const aside = hostDoc.createElement('aside')
    aside.id = 'fint-outline-sidebar'
    // Theme based on top host:
    //   legal.judicial.gov.tw  (FINT)    → muted teal
    //   anything else          (FJUD...) → green (default)
    let theme = 'fjud'
    try {
      const host = (hostDoc.defaultView || window).location.hostname
      if (host.indexOf('legal.judicial.gov.tw') !== -1) theme = 'fint'
      else if (host.indexOf('.law.intraj') !== -1) theme = 'intraj'
    } catch (_) {}
    aside.dataset.theme = theme

    // Per-site position (left / right), user-configurable via options page.
    // 內網兩個網域共用 intraj 主題色，但耳標位置可分別設定。
    let positionKey = theme
    if (theme === 'intraj') {
      try {
        const h = (hostDoc.defaultView || window).location.hostname
        positionKey = h.indexOf('legal.law.intraj') !== -1 ? 'intraj_fint' : 'intraj_fjud'
      } catch (_) {
        positionKey = 'intraj_fjud'
      }
    }
    const position = (userPositions && userPositions[positionKey]) || 'left'
    aside.dataset.position = position === 'right' ? 'right' : 'left'

    // 根據此次 outline 實際最深 level 動態加寬 card — 淺判決（一/(一) 兩層）
    // 保持 320px 不佔畫面，複雜判決（1./ (1)/ ①）自動放寬避免 label 被截斷。
    // CSS 用 [data-depth] attribute selector 對應 width。
    const maxLevel = items.reduce((m, it) => Math.max(m, it.level || 0), 0)
    aside.dataset.depth = String(maxLevel)

    // ----- 頁籤一：判決架構 -----
    const outlineGroup = hostDoc.createElement('div')
    outlineGroup.className = 'fint-tab-group'
    outlineGroup.dataset.group = 'outline'

    const outlineTab = hostDoc.createElement('div')
    outlineTab.className = 'fint-outline-tab'
    outlineTab.textContent = '判決架構'
    outlineGroup.appendChild(outlineTab)

    const outlineCard = hostDoc.createElement('div')
    outlineCard.className = 'fint-outline-card'

    const outlineHead = hostDoc.createElement('div')
    outlineHead.className = 'fint-outline-head'
    outlineHead.textContent = '判決架構'
    outlineCard.appendChild(outlineHead)

    if (!items.length) {
      const empty = hostDoc.createElement('div')
      empty.className = 'fint-outline-empty'
      empty.textContent = '此頁未偵測到層級標記（壹、一、(一)、1. ...）'
      outlineCard.appendChild(empty)
    } else {
      const list = hostDoc.createElement('div')
      list.className = 'fint-outline-list'
      items.forEach((item) => {
        const btn = hostDoc.createElement('button')
        btn.type = 'button'
        btn.className = 'fint-outline-item fint-outline-level-' + item.level
        btn.textContent = shortenLabel(item.text)
        btn.title = item.text
        btn.addEventListener('click', () => {
          const target = document.getElementById(item.id)
          if (!target) return
          scrollToTargetElement(target)
        })
        list.appendChild(btn)
      })
      outlineCard.appendChild(list)
    }
    outlineGroup.appendChild(outlineCard)
    aside.appendChild(outlineGroup)

    // ----- 頁籤二：最高法院參照 -----
    // 若此頁未偵測到任何最高法院引用，不渲染頁籤以保持側邊欄精簡。
    if (citations.length) {
      const citesGroup = hostDoc.createElement('div')
      citesGroup.className = 'fint-tab-group'
      citesGroup.dataset.group = 'citations'

      const citesTab = hostDoc.createElement('div')
      citesTab.className = 'fint-outline-tab fint-citations-tab'
      citesTab.textContent = '參照'
      citesGroup.appendChild(citesTab)

      const citesCard = hostDoc.createElement('div')
      citesCard.className = 'fint-outline-card fint-citations-card'

      const citesHead = hostDoc.createElement('div')
      citesHead.className = 'fint-outline-head'
      citesHead.textContent = `意旨參照清單（共 ${citations.length} 則）`
      citesCard.appendChild(citesHead)

      const citesList = hostDoc.createElement('div')
      citesList.className = 'fint-citations-list'

      citations.forEach((cit, idx) => {
        // 容器：div（非 button），內含「跳轉」與「匯入卡片」兩個獨立按鈕。
        // data-active 紀錄當前是否為選中項（toggle 高亮狀態）。
        const entry = hostDoc.createElement('div')
        entry.className = 'fint-citation-item'
        entry.dataset.active = '0'

        // 主要點擊區：跳轉 + toggle 暫態高亮
        const jumpBtn = hostDoc.createElement('button')
        jumpBtn.type = 'button'
        jumpBtn.className = 'fint-citation-jump'
        jumpBtn.title = '點擊跳轉至被引段落；同項再點一次清除暫態高亮'

        const num = hostDoc.createElement('span')
        num.className = 'fint-citation-num'
        num.textContent = String(idx + 1)
        jumpBtn.appendChild(num)

        const body = hostDoc.createElement('span')
        body.className = 'fint-citation-body'

        const casesRow = hostDoc.createElement('span')
        casesRow.className = 'fint-citation-cases'
        cit.cases.forEach((c) => {
          const badge = hostDoc.createElement('span')
          badge.className = 'fint-citation-badge fint-citation-badge-' + c.kind
          badge.textContent = c.label
          casesRow.appendChild(badge)
        })
        body.appendChild(casesRow)

        const preview = hostDoc.createElement('span')
        preview.className = 'fint-citation-preview'
        preview.textContent = shortenExcerpt(cit.excerpt, 90)
        body.appendChild(preview)

        jumpBtn.appendChild(body)

        jumpBtn.addEventListener('click', () => {
          try {
            // Toggle 行為：同一項再次點擊時清除 fint-jump 高亮；點擊不同項
            // 則先清除其他項的 active 標記，再捲動並高亮該段落。以 DOM
            // data-active 紀錄狀態，避免在 closure 裡另外維護模組級變數
            // 導致跨次 renderSidebar 殘留狀態。
            const active = entry.dataset.active === '1'
            const list = entry.parentElement
            if (list) {
              list
                .querySelectorAll('.fint-citation-item[data-active="1"]')
                .forEach((el) => {
                  el.dataset.active = '0'
                })
            }
            if (active) {
              clearJumpHighlight()
            } else {
              entry.dataset.active = '1'
              scrollAndHighlightRange(cit.jumpRange)
            }
          } catch (_) {}
        })

        // 複製按鈕：將 jumpRange 文字寫入系統剪貼簿（視使用者設定決定
        // 是否追加本篇裁判字號），並同步存入判決剪貼簿卡片清單。
        const copyBtn = hostDoc.createElement('button')
        copyBtn.type = 'button'
        copyBtn.className = 'fint-citation-import'
        copyBtn.title = '複製此意旨段落純文字並存入判決剪貼簿卡片'
        copyBtn.setAttribute('aria-label', '複製')
        copyBtn.textContent = '複製'
        copyBtn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          copyCitationToClipboard(cit)
        })

        entry.appendChild(jumpBtn)
        entry.appendChild(copyBtn)
        citesList.appendChild(entry)
      })

      citesCard.appendChild(citesList)
      citesGroup.appendChild(citesCard)
      aside.appendChild(citesGroup)
    }

    hostDoc.body.appendChild(aside)

    // 註冊持續性高亮：將所有 citeRange 打包為單一 Highlight，註冊於正文所在
    // document（iframe 內的 document），以 ::highlight(fint-citation) 套用
    // 視覺樣式。每次 renderSidebar 都覆寫舊的註冊，避免跨次 init 累積。
    try {
      const targetDoc = document
      if (
        typeof Highlight !== 'undefined' &&
        targetDoc.defaultView &&
        targetDoc.defaultView.CSS &&
        targetDoc.defaultView.CSS.highlights
      ) {
        if (citations.length) {
          const ranges = citations
            .map((c) => c.citeRange)
            .filter((r) => r)
          const hl = new Highlight(...ranges)
          targetDoc.defaultView.CSS.highlights.set('fint-citation', hl)
        } else {
          targetDoc.defaultView.CSS.highlights.delete('fint-citation')
        }
      }
    } catch (_) {}
  }

  // ----- 裁判字號 extraction -----
  //
  // 頁面 metadata 欄位（.col-td）的 textContent 常夾帶隱藏元素的文字
  // （如「量刑趨勢建議」「相關法條」），需截斷到書類名稱結尾。策略：
  //   1. 先嘗試匹配「號」後面跟書類名稱（判決/裁定/決定書/判例/裁判書）
  //   2. 若無已知書類名稱，退到最後一個「號」
  //   3. 若連「號」都沒有（如「民事庭會議」），保留全文
  function trimCaseLabel(raw) {
    const v = raw.replace(/\s+/g, '').trim()
    if (!v) return ''
    const withSuffix = v.match(/^.+?號.*?(?:判決|裁定|決定書|判例|裁判書)/)
    if (withSuffix) return withSuffix[0]
    const to號= v.match(/^.+號/)
    if (to號) return to號[0]
    return v
  }

  function extractCaseLabel() {
    // FJUD data.aspx 用 <dt>裁判字號：</dt><dd>…</dd> 語意結構
    const dts = document.querySelectorAll('dt')
    for (const dt of dts) {
      if (!/裁判字號/.test(dt.textContent || '')) continue
      const dd = dt.nextElementSibling
      if (dd && dd.tagName === 'DD') {
        const v = trimCaseLabel(dd.textContent || '')
        if (v) return v
      }
    }
    // FINT / 部分 FJUD 版面：`.row > .col-th=裁判字號` + `.col-td`
    const rows = document.querySelectorAll('.row')
    for (const row of rows) {
      const th = row.querySelector('.col-th')
      if (!th) continue
      if (!/裁判字號/.test(th.textContent || '')) continue
      const td = row.querySelector('.col-td:not(.jud_content), .col-td')
      if (td) {
        const v = trimCaseLabel(td.textContent || '')
        if (v) return v
      }
    }
    // Fallback：用 innerText regex 抓
    const text = document.body.innerText || ''
    const m = text.match(/裁判字號\s*[:：]?\s*([^\n\r]+)/)
    if (!m) return ''
    return trimCaseLabel(m[1])
  }

  // ----- Copy text normalizer -----
  //
  // FINT 的正文每行前後常夾帶半形/全形 padding 空白，若只 strip `\n` 再
  // collapse whitespace，會在 CJK 字元中間殘留單個空格（"本 息部分"）。
  // 規則：
  //   1. 全形空白 U+3000、不斷行空白 U+00A0 先轉成一般 whitespace。
  //   2. 所有 whitespace run（含 \n \t）合成單一半形空格。
  //   3. 空格「兩側都是 ASCII 英數字」才保留（保住 "NT 300" 這種），
  //      否則刪掉 —— 中文法律文書 CJK 之間本來就沒有斷詞空格。
  function cleanCopyText(raw) {
    if (!raw) return ''
    let t = raw.replace(/\u00A0/g, ' ').replace(/\u3000/g, ' ')
    t = t.replace(/\s+/g, ' ')
    t = t.replace(/ /g, (match, offset, full) => {
      const prev = full.charAt(offset - 1)
      const next = full.charAt(offset + 1)
      const isAlnum = (ch) => /[A-Za-z0-9]/.test(ch)
      return isAlnum(prev) && isAlnum(next) ? ' ' : ''
    })
    return t.trim()
  }

  // ----- Clipboard history (session-only, lives in chrome.storage.session) -----
  const CLIP_HISTORY_KEY = 'clipHistory'

  // Resolve the real permalink URL + source tag for a clipboard entry.
  //
  // FJUD/FINT load the actual judgment detail inside a same-origin iframe
  // (data.aspx?ty=...&id=...). The outer shell (default.aspx / qryresult.aspx)
  // is just a host — window.top.location.href on the outer shell is useless
  // as a permalink.
  //
  // Strategy, in priority order:
  //   1. #txtUrl (分享網址 dialog input) in the *current* document — this is
  //      the canonical share URL the site itself blesses. If populated, use it.
  //   2. Current frame's own location.href — if it already points at a detail
  //      page (not default.aspx), it is the real URL. Because content.js runs
  //      with all_frames: true, the copy handler inside the judgment iframe
  //      sees the iframe's own URL here.
  //   3. Walk into same-origin child iframes looking for one whose URL is a
  //      detail page. Covers the edge case where the copy event bubbled up to
  //      the shell frame instead of the content iframe.
  //   4. Last resort: location.href even if it is default.aspx.
  function isShellUrl(u) {
    return /\/default\.aspx/i.test(u) || /\/qryresult\.aspx/i.test(u)
  }

  function findShareUrlInDoc(doc) {
    try {
      const el = doc.getElementById('txtUrl')
      if (el && typeof el.value === 'string' && /^https?:/i.test(el.value)) {
        return el.value
      }
    } catch (_) {}
    return ''
  }

  function findDetailUrlInFrames(doc) {
    try {
      const frames = doc.querySelectorAll('iframe')
      for (const f of frames) {
        let childDoc = null
        try {
          childDoc = f.contentDocument
        } catch (_) {
          continue
        }
        if (!childDoc) continue
        // Prefer the share URL on the inner document if present.
        const share = findShareUrlInDoc(childDoc)
        if (share) return share
        const loc = childDoc.location && childDoc.location.href
        if (loc && !isShellUrl(loc)) return loc
        // Recurse one level deeper.
        const nested = findDetailUrlInFrames(childDoc)
        if (nested) return nested
      }
    } catch (_) {}
    return ''
  }

  function resolveSource() {
    let url = ''

    // 1. Share URL in current document.
    const share = findShareUrlInDoc(document)
    if (share) url = share

    // 2. Current frame URL if it is not the shell.
    if (!url) {
      const here = location.href
      if (!isShellUrl(here)) url = here
    }

    // 3. Walk into child iframes for a detail URL.
    if (!url) {
      const nested = findDetailUrlInFrames(document)
      if (nested) url = nested
    }

    // 4. Last resort: whatever the current frame has.
    if (!url) url = location.href

    // Source detection: prefer the top-frame hostname (identifies the system
    // even if the copy fires from an inner iframe). Top is same-origin in both
    // FJUD and FINT, so window.top.location.hostname is readable.
    let source = 'fjud'
    let host = ''
    let pageUrl = ''
    try {
      host = window.top.location.hostname
      pageUrl = window.top.location.href
    } catch (_) {
      host = location.hostname
      pageUrl = location.href
    }
    if (host.indexOf('legal.judicial.gov.tw') !== -1) source = 'fint'
    else if (host.indexOf('legal.law.intraj') !== -1) source = 'intraj_fint'
    else if (host.indexOf('judgment.law.intraj') !== -1) source = 'intraj_fjud'
    // url       = iframe 內的 detail 永久連結（開新分頁用最穩）
    // pageUrl   = top frame 的網址列 URL（tab.url 比對用，FJUD 幾乎都是外殼
    //             default.aspx，和 url 可能不同）
    return { url, pageUrl, source }
  }

  function pushClipHistory(text, caseLabel, rawText, anchorIdStart, anchorIdEnd) {
    if (!chrome?.storage?.session) return Promise.resolve('unsupported')
    const { url, pageUrl, source } = resolveSource()
    return chrome.storage.session
      .get({ [CLIP_HISTORY_KEY]: [] })
      .then(({ [CLIP_HISTORY_KEY]: list }) => {
        const existingIdx = list.findIndex((it) => it.text === text)
        if (existingIdx !== -1) {
          // 相同文字重複複製時，僅更新既有 entry 的錨點 id 與來源 URL，
          // 使「前往」對應到最新插入 DOM 的那組錨點。保留 id / createdAt /
          // 順序不動，避免 sidepanel 卡片排序被擾動。
          const existing = list[existingIdx]
          existing.anchorIdStart = anchorIdStart || existing.anchorIdStart || ''
          existing.anchorIdEnd = anchorIdEnd || existing.anchorIdEnd || ''
          existing.pageUrl = pageUrl || existing.pageUrl || ''
          existing.sourceUrl = url || existing.sourceUrl || ''
          existing.rawText = rawText || existing.rawText || ''
          return chrome.storage.session
            .set({ [CLIP_HISTORY_KEY]: list })
            .then(() => 'duplicate')
        }
        const entry = {
          id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          text,
          // rawText 保留 sel.toString() 原貌（含換行、原始空白、無字號後綴），
          // 作為「前往」定位段落時的精確比對來源；與寫入剪貼簿的 text 分離。
          rawText: rawText || '',
          caseLabel: caseLabel || '',
          sourceUrl: url,
          // pageUrl 為 top frame（網址列）URL。FJUD 的 iframe 結構下，
          // tab.url 等同外殼 URL，與 sourceUrl 指向的 data.aspx 不同；
          // 「前往」時以 pageUrl 優先比對已開啟分頁。
          pageUrl: pageUrl || '',
          // 書籤錨點 id：僅當頁面未重載、DOM 未被 SPA 重繪時有效。
          // 「前往」優先以錨點定位，命中即代表分頁仍在原頁面且位置未動。
          anchorIdStart: anchorIdStart || '',
          anchorIdEnd: anchorIdEnd || '',
          source,
          createdAt: Date.now(),
        }
        const next = [entry, ...list]
        return chrome.storage.session.set({ [CLIP_HISTORY_KEY]: next }).then(() => 'added')
      })
      .catch((err) => {
        console.warn('[judicial-outline] pushClipHistory failed', err)
        return 'error'
      })
  }

  // ----- Copy / Cut handlers -----
  //
  // Cmd/Ctrl+C（copy 事件）：正規化後寫入剪貼簿，並存入剪貼簿卡片 history。
  // Cmd/Ctrl+X（cut 事件）：同樣寫入剪貼簿，但**不**存入卡片，供僅需一次性
  // 貼到外部工具、不希望累積卡片清單的情境使用。判決頁文字為唯讀，cut 原生
  // 無動作，以 preventDefault 攔截後改寫剪貼簿即可。
  //
  // 兩者共用選取文字正規化、字號附加、錨點插入（僅 copy 需要）與 toast 提示
  // 的邏輯；差異僅在是否呼叫 pushClipHistory 與 toast 文案。
  function isEditableTarget(target) {
    if (!target || target.nodeType !== 1) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return !!target.isContentEditable
  }

  function captureSelectionToClipboard(e, opts) {
    const saveToHistory = !!(opts && opts.saveToHistory)
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const raw = sel.toString()
    if (!raw.trim()) return
    const clean = cleanCopyText(raw)
    // 字號一律擷取（供卡片顯示），只有在使用者開啟設定時才附加到剪貼簿文字
    const caseLabel = getCaseLabel()
    const suffix = userAppendCitation && caseLabel ? '（' + caseLabel + '意旨參照）' : ''
    const finalText = clean + suffix

    // 在選取範圍的起、迄位置各插入一個空 <span> 作為書籤錨點，供卡片
    // 「前往原文」使用；cut 不存卡片，故略過錨點插入。
    // 插入順序必須先 end 後 start：若先插 start，srcRange 的 endContainer
    // 可能被 splitText 切開，導致 end offset 失效。
    let anchorIdStart = ''
    let anchorIdEnd = ''
    if (saveToHistory) {
      try {
        if (sel.rangeCount > 0) {
          const uid = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
          anchorIdStart = 'fint-clip-' + uid + '-s'
          anchorIdEnd = 'fint-clip-' + uid + '-e'
          const srcRange = sel.getRangeAt(0)
          const endRange = srcRange.cloneRange()
          endRange.collapse(false)
          const endEl = document.createElement('span')
          endEl.id = anchorIdEnd
          endEl.className = 'fint-clip-anchor'
          endRange.insertNode(endEl)
          const startRange = srcRange.cloneRange()
          startRange.collapse(true)
          const startEl = document.createElement('span')
          startEl.id = anchorIdStart
          startEl.className = 'fint-clip-anchor'
          startRange.insertNode(startEl)
        }
      } catch (_) {
        anchorIdStart = ''
        anchorIdEnd = ''
      }
    }

    try {
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', finalText)
        e.preventDefault()
        if (saveToHistory) {
          pushClipHistory(finalText, caseLabel, raw, anchorIdStart, anchorIdEnd).then((result) => {
            if (result === 'duplicate') {
              showToast('已複製過相同內容')
            } else {
              showToast(suffix ? '已複製純文字（附字號）' : '已複製純文字')
            }
          })
        } else {
          showToast(
            suffix
              ? '已複製純文字（附字號・未加入卡片）'
              : '已複製純文字（未加入卡片）',
          )
        }
      }
    } catch (_) {
      // If override fails, let the native copy/cut proceed.
    }
  }

  // 寫入系統剪貼簿：優先使用 navigator.clipboard（需於使用者手勢下才允許，
  // 如 click 事件）；若遇舊瀏覽器或權限受限則退回經典 textarea + execCommand
  // 方案。兩種路徑皆不會干擾頁面原有選取。
  function writeTextToClipboard(text) {
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        return navigator.clipboard.writeText(text).catch(() => {
          return fallbackCopy(text)
        })
      }
    } catch (_) {}
    return Promise.resolve(fallbackCopy(text))
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.top = '-9999px'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch (_) {
      return false
    }
  }

  // 將參照頁籤中某一引文（已高亮的意旨段落）複製到系統剪貼簿，同時存入
  // 判決剪貼簿卡片。
  //   - 文字來源：citation.jumpRange（意旨段落起點至引文結束），非
  //     window.getSelection()，無須使用者先做選取。
  //   - 是否附上本篇裁判字號：遵循後台設定 userAppendCitation（與 Cmd+C
  //     行為一致；側邊欄頂端亦可即時切換）。
  //   - 插入書籤錨點：讓後續於卡片點「前往」可精準跳回此段落。
  function copyCitationToClipboard(citation) {
    const range = citation && citation.jumpRange
    if (!range) return
    const rawText = range.toString()
    if (!rawText || !rawText.trim()) return
    const clean = cleanCopyText(rawText)
    const caseLabel = getCaseLabel()
    const suffix =
      userAppendCitation && caseLabel ? '（' + caseLabel + '意旨參照）' : ''
    const finalText = clean + suffix

    // 插入書籤錨點：與 Cmd+C 流程一致。插入順序須先 end 後 start，避免
    // splitText 將 endContainer 切開導致 endOffset 失效。失敗時允許 anchor
    // 為空，sidepanel.js 會退到 rawText 文字搜尋備援。
    let anchorIdStart = ''
    let anchorIdEnd = ''
    try {
      const uid =
        Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
      anchorIdStart = 'fint-clip-' + uid + '-s'
      anchorIdEnd = 'fint-clip-' + uid + '-e'
      const endRange = range.cloneRange()
      endRange.collapse(false)
      const endEl = document.createElement('span')
      endEl.id = anchorIdEnd
      endEl.className = 'fint-clip-anchor'
      endRange.insertNode(endEl)
      const startRange = range.cloneRange()
      startRange.collapse(true)
      const startEl = document.createElement('span')
      startEl.id = anchorIdStart
      startEl.className = 'fint-clip-anchor'
      startRange.insertNode(startEl)
    } catch (_) {
      anchorIdStart = ''
      anchorIdEnd = ''
    }

    // 寫入 OS 剪貼簿與卡片；Promise 並行而結果以卡片端為主顯示 toast。
    writeTextToClipboard(finalText)
    pushClipHistory(
      finalText,
      caseLabel,
      rawText,
      anchorIdStart,
      anchorIdEnd,
    ).then((result) => {
      if (result === 'duplicate') {
        showToast(
          suffix
            ? '已複製純文字（附字號・卡片已有相同內容）'
            : '已複製純文字（卡片已有相同內容）',
        )
      } else if (result === 'added') {
        showToast(
          suffix
            ? '已複製純文字（附字號）並存入卡片'
            : '已複製純文字並存入卡片',
        )
      } else {
        showToast('複製失敗')
      }
    })
  }

  function installCopyHandler() {
    document.addEventListener(
      'copy',
      (e) => captureSelectionToClipboard(e, { saveToHistory: true }),
      true,
    )
    document.addEventListener(
      'cut',
      (e) => {
        // 可編輯欄位（搜尋框、登入框等）保留原生剪下行為，不攔截
        if (isEditableTarget(e.target)) return
        captureSelectionToClipboard(e, { saveToHistory: false })
      },
      true,
    )
  }

  function showToast(msg) {
    let toast = hostDoc.getElementById('fint-copy-toast')
    if (!toast) {
      toast = hostDoc.createElement('div')
      toast.id = 'fint-copy-toast'
      hostDoc.body.appendChild(toast)
    }
    toast.textContent = msg
    toast.classList.add('visible')
    if (showToast._timer) clearTimeout(showToast._timer)
    showToast._timer = setTimeout(() => toast.classList.remove('visible'), 1600)
  }

  // ----- Jump to text paragraph (from sidepanel card click) -----
  //
  // 接收 sidepanel 的 jumpToText 訊息，定位段落並滾動 + 高亮。
  //
  // 定位策略（由精確到寬鬆）：
  //   0. anchor id — 複製當下插入 DOM 的兩個 span，最可靠
  //   A. rawText（sel.toString() 原貌）在 flattened body 做 exact indexOf
  //   B. rawText 的 \r\n 正規化版本 exact indexOf
  //   C. text 去除字號後綴後，對 body 套 cleanCopyText 同樣的 normalize，
  //      建立 clean-index → full-index 映射再 indexOf（供未帶 rawText
  //      或 anchor 的 entry 使用）

  // 清除目前顯示的 fint-jump 高亮。供參照頁籤 toggle 行為使用：使用者再次
  // 點擊同一項時呼叫，讓頁面回到無暫態高亮狀態。若瀏覽器不支援 CSS
  // Highlight API 則清除原生選取，對齊 scrollAndHighlightRange 的雙路徑。
  function clearJumpHighlight() {
    try {
      if (typeof Highlight !== 'undefined' && CSS && CSS.highlights) {
        CSS.highlights.delete('fint-jump')
      } else {
        const sel = window.getSelection()
        if (sel) sel.removeAllRanges()
      }
    } catch (_) {}
  }

  // scroll + highlight 共用路徑 — anchor 與 text-search 分支皆呼叫此函式
  function scrollAndHighlightRange(range) {
    try {
      const HEADER_OFFSET = 120
      const inIframe = window !== window.top
      const rect = range.getBoundingClientRect()
      if (inIframe) {
        const topWin = hostDoc.defaultView || window
        let y = rect.top
        let w = window
        while (w !== topWin && w.frameElement) {
          y += w.frameElement.getBoundingClientRect().top
          w = w.parent
        }
        const desired = topWin.scrollY + y - HEADER_OFFSET
        topWin.scrollTo({ top: desired, left: topWin.scrollX, behavior: 'smooth' })
      } else {
        window.scrollTo({
          top: window.scrollY + rect.top - HEADER_OFFSET,
          left: window.scrollX,
          behavior: 'smooth',
        })
      }
      // Highlight 持續顯示，下次「前往」以相同 'fint-jump' key 覆寫既有 Highlight。
      if (typeof Highlight !== 'undefined' && CSS && CSS.highlights) {
        const hl = new Highlight(range)
        CSS.highlights.set('fint-jump', hl)
      } else {
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
      return true
    } catch (_) {
      return false
    }
  }

  function findAndScrollToText(opts) {
    const rawText = (opts && typeof opts.rawText === 'string') ? opts.rawText : ''
    const text = (opts && typeof opts.text === 'string') ? opts.text : ''
    const caseLabel = (opts && typeof opts.caseLabel === 'string') ? opts.caseLabel : ''
    const anchorIdStart = (opts && typeof opts.anchorIdStart === 'string') ? opts.anchorIdStart : ''
    const anchorIdEnd = (opts && typeof opts.anchorIdEnd === 'string') ? opts.anchorIdEnd : ''

    // Strategy 0 — 書籤錨點（最可靠、與 URL 無關）
    // 分頁若仍在同一次 load 且 DOM 未被 SPA 重繪，兩個 anchor span 就還
    // 存在，可直接以 getElementById 建 Range。命中即代表分頁仍停留在原
    // 頁面，可以直接滾動、不須開新分頁。
    if (anchorIdStart && anchorIdEnd) {
      const s = document.getElementById(anchorIdStart)
      const e = document.getElementById(anchorIdEnd)
      if (s && e) {
        try {
          const range = document.createRange()
          range.setStartAfter(s)
          range.setEndBefore(e)
          if (scrollAndHighlightRange(range)) return true
        } catch (_) {}
      }
    }

    const body = findBodyContainer()
    if (!body) return false
    if (!rawText && !text) return false

    // --- Flatten body（保留原始字元，含換行／全形空白） ---
    const BLOCK_TAGS = /^(DIV|P|PRE|LI|UL|OL|TABLE|TR|TD|TH|H[1-6]|SECTION|ARTICLE|BLOCKQUOTE)$/i
    const segments = []
    let full = ''
    const ensureNewline = () => { if (full && !full.endsWith('\n')) full += '\n' }
    const walk = (el) => {
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const v = child.nodeValue || ''
          if (!v) continue
          segments.push({ node: child, start: full.length, end: full.length + v.length })
          full += v
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName
          if (tag === 'BR') { ensureNewline(); continue }
          if (tag === 'SCRIPT' || tag === 'STYLE') continue
          const isBlock = BLOCK_TAGS.test(tag)
          if (isBlock) ensureNewline()
          walk(child)
          if (isBlock) ensureNewline()
        }
      }
    }
    walk(body)
    if (!full) return false

    // Strategy A/B: rawText exact match
    let fullStart = -1
    let matchLen = 0
    if (rawText) {
      let idx = full.indexOf(rawText)
      if (idx !== -1) {
        fullStart = idx
        matchLen = rawText.length
      } else {
        const norm = rawText.replace(/\r\n/g, '\n')
        idx = full.indexOf(norm)
        if (idx !== -1) {
          fullStart = idx
          matchLen = norm.length
        }
      }
    }

    // Strategy C: cleaned-text fallback via normalize + clean-index map
    if (fullStart === -1 && text) {
      let needle = text
      if (caseLabel) {
        const suffix = '（' + caseLabel + '意旨參照）'
        if (needle.endsWith(suffix)) needle = needle.slice(0, -suffix.length)
      }
      needle = needle.trim()
      if (needle) {
        const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\u00A0' || c === '\u3000' || c === '\f' || c === '\v'
        const isAlnum = (c) => /[A-Za-z0-9]/.test(c)
        let clean = ''
        const cleanToFull = []
        let p = 0
        while (p < full.length) {
          const ch = full.charAt(p)
          if (isWs(ch)) {
            let q = p
            while (q < full.length && isWs(full.charAt(q))) q++
            const prev = clean.length > 0 ? clean.charAt(clean.length - 1) : ''
            const next = q < full.length ? full.charAt(q) : ''
            if (isAlnum(prev) && isAlnum(next)) {
              clean += ' '
              cleanToFull.push(p)
            }
            p = q
            continue
          }
          clean += ch
          cleanToFull.push(p)
          p++
        }
        const idx = clean.indexOf(needle)
        if (idx !== -1) {
          const lastCleanIdx = Math.min(idx + needle.length - 1, cleanToFull.length - 1)
          fullStart = cleanToFull[idx]
          const fullEndInclusive = cleanToFull[lastCleanIdx]
          matchLen = (fullEndInclusive !== undefined ? fullEndInclusive + 1 : fullStart + 1) - fullStart
        }
      }
    }

    if (fullStart === -1) return false

    const fullEndInclusive = fullStart + Math.max(1, matchLen) - 1
    const locate = (pos) => {
      for (const seg of segments) {
        if (pos >= seg.start && pos < seg.end) {
          return { node: seg.node, offset: pos - seg.start }
        }
      }
      return null
    }
    const startLoc = locate(fullStart)
    const endLoc = locate(fullEndInclusive)
    if (!startLoc) return false

    try {
      const range = document.createRange()
      range.setStart(startLoc.node, startLoc.offset)
      if (endLoc) {
        const nodeLen = (endLoc.node.nodeValue || '').length
        range.setEnd(endLoc.node, Math.min(endLoc.offset + 1, nodeLen))
      } else {
        const nodeLen = (startLoc.node.nodeValue || '').length
        range.setEnd(startLoc.node, Math.min(startLoc.offset + 1, nodeLen))
      }
      return scrollAndHighlightRange(range)
    } catch (_) {
      return false
    }
  }

  // 將錨點查詢與定位函式掛到當前 window，供上層 frame 跨 frame 呼叫。
  // FJUD / FINT 的正文皆在 iframe 中，top frame 需經此入口存取子 frame。
  try { window.__fintFindAndScroll = findAndScrollToText } catch (_) {}
  try {
    window.__fintHasAnchor = (id) => {
      if (!id) return false
      try { return !!document.getElementById(id) } catch (_) { return false }
    }
  } catch (_) {}

  // 遞迴走整棵 frame tree；每一層同時嘗試兩種路徑：
  //   (1) 該 frame 已掛載的 __fintHasAnchor / __fintFindAndScroll
  //   (2) same-origin 直接存取 frames[i].document（作為 content script
  //       尚未初始化完畢時的備援）
  function deepHasAnchor(win, id) {
    if (!id) return false
    try {
      if (typeof win.__fintHasAnchor === 'function' && win.__fintHasAnchor(id)) return true
    } catch (_) {}
    try {
      if (win.document && win.document.getElementById(id)) return true
    } catch (_) {}
    try {
      for (let i = 0; i < win.frames.length; i++) {
        if (deepHasAnchor(win.frames[i], id)) return true
      }
    } catch (_) {}
    return false
  }

  function deepJumpToText(win, opts) {
    try {
      if (typeof win.__fintFindAndScroll === 'function' && win.__fintFindAndScroll(opts)) return true
    } catch (_) {}
    try {
      for (let i = 0; i < win.frames.length; i++) {
        if (deepJumpToText(win.frames[i], opts)) return true
      }
    } catch (_) {}
    return false
  }

  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || typeof msg.action !== 'string') return

      if (msg.action === 'hasAnchor') {
        const id = typeof msg.anchorIdStart === 'string' ? msg.anchorIdStart : ''
        // tabs.sendMessage 僅送達 top frame，故從當前 window 起遞迴走整棵
        // frame tree（含同源子 frame）尋找錨點。
        const ok = deepHasAnchor(window, id)
        sendResponse({ ok })
        return false
      }

      if (msg.action === 'jumpToText') {
        const opts = {
          rawText: typeof msg.rawText === 'string' ? msg.rawText : '',
          text: typeof msg.text === 'string' ? msg.text : '',
          caseLabel: typeof msg.caseLabel === 'string' ? msg.caseLabel : '',
          anchorIdStart: typeof msg.anchorIdStart === 'string' ? msg.anchorIdStart : '',
          anchorIdEnd: typeof msg.anchorIdEnd === 'string' ? msg.anchorIdEnd : '',
        }
        const ok = deepJumpToText(window, opts)
        sendResponse({ ok })
        return false
      }
    })
  } catch (_) {}

  // ----- Main -----
  //
  // FJUD 的判決內容動態載入：default.aspx 經 iframe 或 AJAX 注入 data.aspx，
  // 因此 document_idle 當下不一定能取得 `#jud`。初始化流程：
  //   1. 嘗試建構側欄；若容器尚未出現，以 MutationObserver 等待（15 秒後
  //      自動中止，避免在非判決頁面持續觀察）。
  let sidebarBuilt = false
  let cachedCaseLabel = null

  function getCaseLabel() {
    if (cachedCaseLabel !== null) return cachedCaseLabel
    const v = extractCaseLabel()
    if (v) cachedCaseLabel = v
    return v || ''
  }

  let copyHandlerInstalled = false

  function tryBuildSidebar() {
    if (sidebarBuilt) return true
    const body = findBodyContainer()
    if (!body) return false
    const items = annotateAnchors(body)
    // 引文抽取於 annotateAnchors 之後執行：annotateAnchors 插入的錨點為
    // 空 <span>，不影響正文 text content 扁平化結果，兩者可共存。
    // 使用者關閉「參照耳標」設定時完全跳過抽取步驟，以免在大篇判決中
    // 產生不必要的 Range 物件。
    const citations = userShowCitations ? extractCitations(body) : []
    renderSidebar(items, citations)
    if (!copyHandlerInstalled) {
      installCopyHandler()
      copyHandlerInstalled = true
    }
    sidebarBuilt = true
    return true
  }

  function removeExistingSidebar() {
    const old = hostDoc.getElementById('fint-outline-sidebar')
    if (old) old.remove()
    const oldToast = hostDoc.getElementById('fint-copy-toast')
    if (oldToast) oldToast.remove()
  }

  let currentObserver = null

  async function init() {
    try {
      // content script 每次重跑（iframe 導航等）都先移除既有 sidebar；
      // 若本次為列表頁而不重建 sidebar，也能確保耳標消失。
      removeExistingSidebar()
      sidebarBuilt = false
      cachedCaseLabel = null

      if (currentObserver) {
        currentObserver.disconnect()
        currentObserver = null
      }

      // 等 chrome.storage.sync 把使用者的 per-site 位置設定載進 userPositions，
      // 首次 render 的 sidebar 才會放在正確的邊。後續 init() 不需再等（Promise 已 resolved）。
      await positionsReady

      if (tryBuildSidebar()) return

      const obs = new MutationObserver(() => {
        if (tryBuildSidebar()) {
          obs.disconnect()
          if (currentObserver === obs) currentObserver = null
        }
      })
      currentObserver = obs
      obs.observe(document.documentElement, { childList: true, subtree: true })
      setTimeout(() => {
        obs.disconnect()
        if (currentObserver === obs) currentObserver = null
      }, 15000)
    } catch (err) {
      console.error('[FINT Helper]', err)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
