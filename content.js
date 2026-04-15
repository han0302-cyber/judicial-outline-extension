// 司法院裁判書閱讀助手 — content script
//
// 支援網域：
//   legal.judicial.gov.tw/FINT/*    (法令判解系統)
//   judgment.judicial.gov.tw/FJUD/* (裁判書系統)
//
// 三件事：
//   1. 在左側固定一個「判決架構」卡片（hover tab），掃描正文內容的層級標記
//      （壹、一、(一)、㈠...）與主文/事實/理由三大段，點擊 scroll 到對應段落。
//   2. 攔截 copy 事件：將選取文字的分行壓縮成單行，於尾端附上
//      「（<裁判字號>意旨參照）」後寫入剪貼簿（Win/Mac 通用）。
//   3. 裁判字號從頁面「裁判字號：」欄位擷取後移除所有空白。
//
// 不修改頁面排版 — 只在文字節點中插入隱形 <span id> 當錨點，不會影響任何
// 既有的縮排 / 斷行。

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
  }
  let userAppendCitation = true
  // 耳標展開到第幾層（user-facing 深度，1-6）。內部 level 是 0-5，使用者
  // 看到的深度 = 內部 level + 1：
  //   1 = 主文/壹                2 = +一/二              3 = +(一)/㈠ (預設)
  //   4 = +1./⒈/１．             5 = +(1)/⑴/（１）       6 = +①/②/③
  // 預設停在 3 = 三層大綱，多數判決閱讀已足夠。
  let userMaxDepth = 3
  const positionsReady = new Promise((resolve) => {
    try {
      chrome.storage.sync.get(
        { positions: userPositions, appendCitation: true, maxDepth: 3 },
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
  // FJUD 將判決內容放在 iframe；iframe 的高度會撐到內容高度，因此在 iframe
  // 內用 position:fixed 等同 position:absolute（黏在 iframe 左上角，不會跟
  // 捲動）。解法：把側欄 DOM 掛到同源的 top document，讓 fixed 以最外層
  // viewport 為基準。點擊跳轉仍靠 iframe 內的 anchor element，scrollIntoView
  // 會自動往上冒泡到 parent 的捲軸。
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
  //   text node（例：「㈠關於 / <a>本件法律問題</a> / 即…」）。若逐 text node
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
    // 判決常引用法條內容，形如：「按 X 法第 N 條規定：『有下列情形之一者：
    // 一、... 二、... 三、...』」。這些被引用的 一/二/三 不是本篇判決的大綱，
    // 不該被抓進耳標。
    //
    // 之前的版本用 global running depth（累積 +1/-1）實作，但只要判決中間
    // 出現任一個沒有匹配 」 的孤立 「（例如截斷段落、原文不對稱、Lawsnote
    // 自動加標點失誤），depth 就會永遠 > 0，導致**之後整份判決的編號都被誤殺**，
    // 使用者會看到「長判決後半段大綱全部消失」。
    //
    // 改成局部封閉配對：每遇到一個 「（或 『），向後找最近的 」（或 』），
    // 配對上限 MAX_QUOTE_SPAN 字。配對成功就把中間區間標為「引號內」；找
    // 不到配對就**忽略這個 「**，當它沒出現過。這樣一個壞引號最多只汙染
    // 後面 MAX_QUOTE_SPAN 字內的判定，不會擴散到整份判決。
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
    // 字元之後的下一個非空白位置。這讓我們可以抓到 "。八、李文娟" 這類
    // 同段內用句號分界的下一個標記，而不是只在物理 \n 後才觸發。
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
      // Section heading 故意繞過這個檢查 —— 因為 "主文" "事實" "理由" 絕對
      // 不會出現在引號內，這個 check 對它們是 no-op；但 enum 編號就會被濾。
      if (insideQuote[realPos] && !SECTION_HEADER_RE.test(lineText)) continue

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

  // ----- Sidebar rendering -----
  function renderSidebar(items) {
    // 套用使用者選的最大展開深度。User-facing 深度 1-6，對應內部 level 0-5
    // （差 1）。filter 條件：內部 level + 1 <= userMaxDepth，等價於
    // level < userMaxDepth。anchors 仍保留在 DOM 中（不浪費已經做過的
    // splitText 工），只是不顯示在耳標清單裡 —— 未來若要做「展開更多」之類
    // 的互動，可以直接重新 render 不必重新偵測。
    items = (items || []).filter((it) => (it.level || 0) < userMaxDepth)

    // 清掉舊的 sidebar + toast —— 父層 default.aspx 不會隨 iframe 導航重載，
    // 所以上一次注入的 DOM 會殘留，指向已經消失的 iframe anchor。
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
    } catch (_) {}
    aside.dataset.theme = theme

    // Per-site position (left / right), user-configurable via options page.
    const position = (userPositions && userPositions[theme]) || 'left'
    aside.dataset.position = position === 'right' ? 'right' : 'left'

    // 根據此次 outline 實際最深 level 動態加寬 card — 淺判決（一/(一) 兩層）
    // 保持 320px 不佔畫面，複雜判決（1./ (1)/ ①）自動放寬避免 label 被截斷。
    // CSS 用 [data-depth] attribute selector 對應 width。
    const maxLevel = items.reduce((m, it) => Math.max(m, it.level || 0), 0)
    aside.dataset.depth = String(maxLevel)

    const tab = hostDoc.createElement('div')
    tab.className = 'fint-outline-tab'
    tab.textContent = '判決架構'
    aside.appendChild(tab)

    const card = hostDoc.createElement('div')
    card.className = 'fint-outline-card'

    const head = hostDoc.createElement('div')
    head.className = 'fint-outline-head'
    head.textContent = '判決架構'
    card.appendChild(head)

    if (!items.length) {
      const empty = hostDoc.createElement('div')
      empty.className = 'fint-outline-empty'
      empty.textContent = '此頁未偵測到層級標記（壹、一、(一)、1. ...）'
      card.appendChild(empty)
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
          const HEADER_OFFSET = 120
          const inIframe = window !== window.top

          try {
            if (inIframe) {
              // FJUD / FINT: target is inside an iframe. Walk the frame chain
              // up to the top window, compute absolute Y, scroll topWin once.
              const topWin = hostDoc.defaultView || window
              let y = target.getBoundingClientRect().top
              let w = window
              while (w !== topWin && w.frameElement) {
                y += w.frameElement.getBoundingClientRect().top
                w = w.parent
              }
              const desired = topWin.scrollY + y - HEADER_OFFSET
              topWin.scrollTo({ top: desired, left: topWin.scrollX, behavior: 'smooth' })
            } else {
              // Top-level page (direct data.aspx access): find the nearest
              // ancestor that is actually scrollable; fall back to window.
              let scroller = null
              let p = target.parentElement
              while (p) {
                const st = getComputedStyle(p)
                if ((st.overflowY === 'auto' || st.overflowY === 'scroll') &&
                    p.scrollHeight > p.clientHeight + 1) {
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
                  top: window.scrollY + target.getBoundingClientRect().top - HEADER_OFFSET,
                  left: window.scrollX,
                  behavior: 'smooth',
                })
              }
            }
          } catch (_) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        })
        list.appendChild(btn)
      })
      card.appendChild(list)
    }

    aside.appendChild(card)
    hostDoc.body.appendChild(aside)
  }

  // ----- 裁判字號 extraction -----
  function extractCaseLabel() {
    // FJUD / FINT：先找 `.row > .col-th=裁判字號`（兩套共通 metadata 結構）
    const rows = document.querySelectorAll('.row')
    for (const row of rows) {
      const th = row.querySelector('.col-th')
      if (!th) continue
      if (!/裁判字號/.test(th.textContent || '')) continue
      const td = row.querySelector('.col-td:not(.jud_content), .col-td')
      if (td) {
        const v = (td.textContent || '').replace(/\s+/g, '').trim()
        if (v) return v
      }
    }
    // Fallback：用 innerText regex 抓
    const text = document.body.innerText || ''
    const m = text.match(/裁判字號\s*[:：]?\s*([^\n\r]+)/)
    if (!m) return ''
    let value = m[1]
    const matchEnd = value.match(/.+?(判決|裁定)/)
    if (matchEnd) value = matchEnd[0]
    return value.replace(/\s+/g, '').trim()
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

  // ----- Copy handler -----
  function installCopyHandler() {
    document.addEventListener(
      'copy',
      (e) => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) return
        const raw = sel.toString()
        if (!raw.trim()) return
        const clean = cleanCopyText(raw)
        const caseLabel = userAppendCitation ? getCaseLabel() : ''
        const suffix = caseLabel ? '（' + caseLabel + '意旨參照）' : ''
        const finalText = clean + suffix
        try {
          if (e.clipboardData) {
            e.clipboardData.setData('text/plain', finalText)
            e.preventDefault()
            showToast(suffix ? '已複製純文字（附字號）' : '已複製純文字')
          }
        } catch (_) {
          // If override fails, let the native copy proceed.
        }
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

  // ----- Main -----
  //
  // 判決內容在 FJUD 站是動態載入（default.aspx 下透過 iframe 或 AJAX 注入
  // data.aspx 內容），所以 document_idle 當下不一定能拿到 `#jud`。Lawsnote
  // 更是完整 React SPA —— 初次 render 要等 React mount、且點另一筆判決時
  // URL 改變但不 reload，script 不會自動重跑。策略：
  //   1. 試著建構側欄；若容器還沒出現，用 MutationObserver 等它出現（15 秒
  //      後停止觀察，避免在非裁判書頁面長跑）
  //   2. Hook history.pushState / replaceState / popstate，URL 變動時重跑
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
    renderSidebar(items)
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
      // 每次 content script 重跑（iframe 導航 / SPA 路由切換）都先清掉上一
      // 次注入的 sidebar —— 即使本次是列表頁、最後不會重建 sidebar，也能讓
      // 耳標消失。
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
