// 司法院裁判書助手 — content script for legal.judicial.gov.tw/FINT/data.aspx
//
// 三件事：
//   1. 在左側固定一個「判決架構」卡片（hover tab），掃描正文內容的層級標記
//      （壹、一、(一)、1.、(1)、㈠、⒈、⑴ ...），點擊 scroll 到對應段落。
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

  const HIERARCHY_PATTERNS = [
    { level: 0, pattern: new RegExp('^' + CHINESE_UPPER_NUM + '+\\s*[、.,．]') },
    { level: 2, pattern: /^[\u3220-\u3229]/ },
    { level: 3, pattern: /^[\u2488-\u249B]/ },
    { level: 4, pattern: /^[\u2474-\u2487]/ },
    { level: 2, pattern: new RegExp('^[（(]\\s*' + CHINESE_NUM + '+\\s*[）)]') },
    { level: 4, pattern: /^[（(]\s*\d+\s*[）)]/ },
    { level: 1, pattern: new RegExp('^' + CHINESE_NUM + '+\\s*[、.,．]') },
    { level: 3, pattern: /^\d+\s*[、.．]/ },
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
  //
  // FINT / FJUD 的正文容器慣例：外層 `#jud`，內層取以下任一個取到非空的為主：
  //   `.htmlcontent` / `.text-pre` / `.jud_content`
  // 抓不到時退回 `#jud` 本體；再抓不到時掃整個 document 中字數最多的 leaf 容器。
  function findBodyContainer() {
    // 兩套系統結構不同：
    //
    //   FJUD (judgment.judicial.gov.tw/FJUD/data.aspx)：
    //     #jud → .htmlcontent / .text-pre / .jud_content
    //     注意：搜尋結果列表也用 #jud 但 tag 是 <table>，要濾掉。
    //
    //   FINT (legal.judicial.gov.tw/FINT/data.aspx)：
    //     #plCJData .col-all.text-pre  (憲法法庭裁判等)
    //     #plFull   .col-all.text-pre  (精選裁判全文等)
    //     都是 div 結構，內含真 \n 排版。

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

    // --- Collect hit positions on the flat string ---
    //
    // 判決三大段的 section heading — 可能寫成「主文」、「主 文」、「主　文」
    const SECTION_HEADER_RE = /^[主事理][\s\u3000]*[文實由][\s\u3000]*$/
    // 句尾/段首上下文：這些字元之後的下一個非空白字元是潛在的 line start。
    const START_CONTEXT_RE = /[。！？；：!?;:\n]/

    const lineTextAt = (pos) => {
      let end = full.indexOf('\n', pos)
      if (end === -1) end = full.length
      return full.slice(pos, end).trim()
    }

    const rawSeen = new Set()
    const rawHits = [] // { pos, level }
    const pushRaw = (pos, level) => {
      if (rawSeen.has(pos)) return
      rawSeen.add(pos)
      rawHits.push({ pos, level })
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

      // Section heading (主文/事實/理由)
      if (SECTION_HEADER_RE.test(lineText)) {
        pushRaw(realPos, 0)
        continue
      }

      // 只看前 24 字做 level detection，避免第一行過長時正則掃太久
      const head = full.slice(realPos, realPos + 24)
      const level = detectLevel(head)
      if (level === null || level > 2) continue
      pushRaw(realPos, level)
    }

    // Pass B: inline CJK enclosed numerals ㈠-㈩ (任意位置都安全)
    for (let i = 0; i < full.length; i++) {
      const cp = full.charCodeAt(i)
      if (cp >= 0x3220 && cp <= 0x3229) pushRaw(i, 2)
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
      const next = rawHits[i + 1]
      const labelEnd = Math.min(next ? next.pos : full.length, cur.pos + 80)
      const label = full.slice(cur.pos, labelEnd).replace(/\s+/g, '').trim()
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
        if (pos === seg.end) {
          // Prefer attaching to the next segment's start if it exists
          // (so the anchor lands before the next visible char).
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
    // 清掉舊的 sidebar + toast —— 父層 default.aspx 不會隨 iframe 導航重載，
    // 所以上一次注入的 DOM 會殘留，指向已經消失的 iframe anchor。
    const old = hostDoc.getElementById('fint-outline-sidebar')
    if (old) old.remove()
    const oldToast = hostDoc.getElementById('fint-copy-toast')
    if (oldToast) oldToast.remove()

    const aside = hostDoc.createElement('aside')
    aside.id = 'fint-outline-sidebar'
    // Theme based on top host: FINT → red, FJUD → green
    try {
      const host = (hostDoc.defaultView || window).location.hostname
      aside.dataset.theme = host.indexOf('legal.judicial.gov.tw') !== -1 ? 'fint' : 'fjud'
    } catch (_) {
      aside.dataset.theme = 'fjud'
    }

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
          // Target lives in iframe's document. Compute its absolute Y in the
          // top window by walking up the frame chain, then scroll the top
          // window directly — one smooth scroll with the header offset baked
          // in, so there's no animation race with scrollIntoView.
          const target = document.getElementById(item.id)
          if (!target) return
          const HEADER_OFFSET = 120
          const topWin = hostDoc.defaultView || window
          try {
            let y = target.getBoundingClientRect().top
            let w = window
            while (w !== topWin && w.frameElement) {
              y += w.frameElement.getBoundingClientRect().top
              w = w.parent
            }
            const desired = topWin.scrollY + y - HEADER_OFFSET
            topWin.scrollTo({ top: desired, left: topWin.scrollX, behavior: 'smooth' })
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
    // 先找 `.row > .col-th=裁判字號`（FJUD/FINT 共通 metadata 結構）
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
        const caseLabel = getCaseLabel()
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
  // data.aspx 內容），所以 document_idle 當下不一定能拿到 `#jud`。策略：
  //   1. 立刻安裝 copy handler，caseLabel 延遲擷取；
  //   2. 試著建構側欄，若 `#jud` 還沒出現，用 MutationObserver 等它出現；
  //   3. 15 秒後停止觀察，避免長跑。
  let sidebarBuilt = false
  let cachedCaseLabel = null

  function getCaseLabel() {
    if (cachedCaseLabel !== null) return cachedCaseLabel
    const v = extractCaseLabel()
    if (v) cachedCaseLabel = v
    return v || ''
  }

  function tryBuildSidebar() {
    if (sidebarBuilt) return true
    const body = findBodyContainer()
    if (!body) return false
    const items = annotateAnchors(body)
    console.log('[FINT Helper] body container:', body, 'items:', items.length)
    renderSidebar(items)
    sidebarBuilt = true
    return true
  }

  function onBodyReady() {
    if (!window.__fintCopyInstalled) {
      window.__fintCopyInstalled = true
      installCopyHandler()
    }
  }

  function removeExistingSidebar() {
    const old = hostDoc.getElementById('fint-outline-sidebar')
    if (old) old.remove()
    const oldToast = hostDoc.getElementById('fint-copy-toast')
    if (oldToast) oldToast.remove()
  }

  function init() {
    try {
      // 每次 content script 重跑（iframe 導航到新頁）都先清掉上一次注入的
      // sidebar —— 即使本次是列表頁、最後不會重建 sidebar，也能讓耳標消失。
      removeExistingSidebar()

      if (tryBuildSidebar()) {
        onBodyReady()
        return
      }

      const obs = new MutationObserver(() => {
        if (tryBuildSidebar()) {
          onBodyReady()
          obs.disconnect()
        }
      })
      obs.observe(document.documentElement, { childList: true, subtree: true })
      setTimeout(() => {
        obs.disconnect()
        if (!sidebarBuilt) {
          console.log('[FINT Helper] no #jud detail container — extension stays idle on this page')
        }
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
