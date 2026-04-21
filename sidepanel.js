;(() => {
  const CLIP_HISTORY_KEY = 'clipHistory'
  const HL_ALL_KEY = 'allHighlights'
  const FONT_SIZE_KEY = 'spFontSize'
  const VIEW_MODE_KEY = 'spViewMode'
  const FONT_STEPS = ['fs-s', '', 'fs-l', 'fs-xl']
  const FONT_DEFAULT_IDX = 1
  const listEl = document.getElementById('sp-list')
  const emptyEl = document.getElementById('sp-empty')
  const clearBtn = document.getElementById('sp-clear')
  const exportTxtBtn = document.getElementById('sp-export-txt')
  const exportMdBtn = document.getElementById('sp-export-md')
  const toastEl = document.getElementById('sp-toast')
  const fsMinusBtn = document.getElementById('sp-fs-minus')
  const fsPlusBtn = document.getElementById('sp-fs-plus')
  const citeRadios = document.querySelectorAll('input[name="sp-citation"]')
  const viewRadios = document.querySelectorAll('input[name="sp-view"]')
  const searchInput = document.getElementById('sp-search')
  const searchStatus = document.getElementById('sp-search-status')
  const tagCloudEl = document.getElementById('sp-tag-cloud')
  const colorCloudEl = document.getElementById('sp-color-cloud')

  const SOURCE_LABELS = {
    fjud: '裁判書',
    fint: '判解函釋',
    intraj_fint: '內網判解函釋',
    intraj_fjud: '內網裁判書',
    intraj: '內網', // 相容舊版資料欄位
  }

  // 文字正規化：與 content.js 之 cleanCopyText 完全一致。
  //
  // 螢光段落於 fint-hl:<key> 與全域聚合鍵 allHighlights 中皆以 range.toString()
  // 原貌儲存（含軟斷行／全形空白），此為文字指紋還原與「前往原文」文字搜尋
  // 之對照依據，務必保持原貌不改。
  //
  // 呈現於卡片、寫入剪貼簿、匯出 .txt / .md 時才套用本函式清理：移除段落
  // 間換行、合併多重空白，並剝除中日韓字元間之襯邊空白，效果比照使用者
  // 直接以 Cmd+C 複製之純文字（不附字號）。
  function cleanHighlightText(raw) {
    if (!raw) return ''
    let t = raw.replace(/ /g, ' ').replace(/　/g, ' ')
    t = t.replace(/\s+/g, ' ')
    t = t.replace(/ /g, (match, offset, full) => {
      const prev = full.charAt(offset - 1)
      const next = full.charAt(offset + 1)
      const isAlnum = (ch) => /[A-Za-z0-9]/.test(ch)
      return isAlnum(prev) && isAlnum(next) ? ' ' : ''
    })
    return t.trim()
  }

  // 螢光筆色彩中文標示：與 content.js 之 HIGHLIGHT_COLORS 對齊，匯出檔
  // color 欄位之顯示字串
  const HL_COLOR_LABELS = {
    yellow: '黃',
    red: '亮紅',
    orange: '亮橘',
    green: '亮綠',
    blue: '亮藍',
    purple: '亮紫',
  }

  // Platform-aware modifier key hint: ⌘ on macOS, Ctrl elsewhere.
  const kbdModEl = document.getElementById('sp-kbd-mod')
  if (kbdModEl) {
    const plat =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      ''
    const isMac = /mac/i.test(plat)
    kbdModEl.textContent = isMac ? '⌘' : 'Ctrl'
  }

  let toastTimer = null
  function showToast(msg) {
    toastEl.textContent = msg
    toastEl.classList.add('is-visible')
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1600)
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  async function getHistory() {
    const { [CLIP_HISTORY_KEY]: list = [] } =
      await chrome.storage.session.get({ [CLIP_HISTORY_KEY]: [] })
    return list
  }

  async function setHistory(list) {
    await chrome.storage.session.set({ [CLIP_HISTORY_KEY]: list })
  }

  async function getAllHighlights() {
    const { [HL_ALL_KEY]: list = [] } =
      await chrome.storage.session.get({ [HL_ALL_KEY]: [] })
    return Array.isArray(list) ? list : []
  }

  async function deleteEntry(id) {
    const list = await getHistory()
    const entry = list.find((it) => it.id === id)
    if (!entry) return
    const preview = entry.text.slice(0, 40) + (entry.text.length > 40 ? '…' : '')
    if (!window.confirm(`確定要刪除這張卡片嗎？\n\n「${preview}」`)) return
    await setHistory(list.filter((it) => it.id !== id))
  }

  // 將卡片對應的分頁切到前景，並請 content script 捲動 + 高亮至原文段落。
  // 若對應分頁已關閉或已導航至他處，則開新分頁並在 onUpdated complete 後
  // 送出定位訊息。
  async function jumpToEntry(id, btn) {
    const list = await getHistory()
    const entry = list.find((it) => it.id === id)
    if (!entry) return
    if (!entry.sourceUrl) {
      showToast('此卡片沒有原始網址，無法前往')
      return
    }

    const msg = {
      action: 'jumpToText',
      rawText: entry.rawText || '',
      text: entry.text || '',
      caseLabel: entry.caseLabel || '',
      anchorIdStart: entry.anchorIdStart || '',
      anchorIdEnd: entry.anchorIdEnd || '',
    }

    // 目標分頁的解析策略（由精確到寬鬆）：
    //   1. 錨點廣播：對每個司法院分頁送 hasAnchor，命中即代表該分頁仍停留
    //      在複製當下的頁面（錨點尚在 DOM），直接切過去以錨點定位。
    //   2. URL 比對：pageUrl（top frame） / sourceUrl（iframe detail） /
    //      同 host + id query 參數。改用 URL 物件做本地比對，避免
    //      chrome.tabs.query({ url }) match pattern 的解析限制。
    //   3. 皆不命中才開新分頁。
    const judicialHostRe = /(legal\.judicial\.gov\.tw|judgment\.judicial\.gov\.tw|legal\.law\.intraj|judgment\.law\.intraj)/
    const normalizeUrl = (u) => {
      if (!u) return ''
      try {
        const x = new URL(u)
        return x.origin + x.pathname + x.search
      } catch (_) {
        return u
      }
    }
    const pickBest = (tabs) => tabs.find((t) => t.active) || tabs[0]

    let allTabs = []
    try { allTabs = await chrome.tabs.query({}) } catch (_) {}

    let candidateTabs = []

    // 1. 錨點廣播 — 優先查目前 active 分頁（最常見情境的快路徑），再掃其他
    if (entry.anchorIdStart) {
      const ordered = [...allTabs].sort(
        (a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0),
      )
      for (const t of ordered) {
        if (!t.url || !judicialHostRe.test(t.url)) continue
        try {
          const res = await chrome.tabs.sendMessage(t.id, {
            action: 'hasAnchor',
            anchorIdStart: entry.anchorIdStart,
          })
          if (res && res.ok) {
            candidateTabs = [t]
            break
          }
        } catch (_) {
          // 分頁沒有 content script（可能被關閉、或非判決頁面）
        }
      }
    }

    // 2. URL fallback — 錨點全部不在才走這裡（頁面可能被重載／SPA 整塊重繪）
    if (!candidateTabs.length) {
      const wantPage = normalizeUrl(entry.pageUrl)
      const wantSource = normalizeUrl(entry.sourceUrl)
      if (wantPage) {
        const matches = allTabs.filter((t) => normalizeUrl(t.url) === wantPage)
        if (matches.length) candidateTabs = [pickBest(matches)]
      }
      if (!candidateTabs.length && wantSource) {
        const matches = allTabs.filter((t) => normalizeUrl(t.url) === wantSource)
        if (matches.length) candidateTabs = [pickBest(matches)]
      }
      if (!candidateTabs.length && entry.sourceUrl) {
        try {
          const src = new URL(entry.sourceUrl)
          const id2 = src.searchParams.get('id')
          if (id2) {
            const matches = allTabs.filter((t) => {
              if (!t.url) return false
              try {
                const tu = new URL(t.url)
                return tu.hostname === src.hostname && tu.searchParams.get('id') === id2
              } catch (_) {
                return false
              }
            })
            if (matches.length) candidateTabs = [pickBest(matches)]
          }
        } catch (_) {}
      }
    }

    const orig = btn.textContent
    const restore = () => {
      btn.textContent = orig
      btn.disabled = false
    }

    // 開新分頁並於載入完成後送出 jumpToText。適用於：(a) 找不到已開分頁；
    // (b) 找到分頁但 jumpToText 回傳 ok: false（例如 FJUD 外殼未變但 iframe
    // 已導航至其他判決）。
    const openNewTabAndJump = async () => {
      if (!entry.sourceUrl) {
        showToast('此卡片沒有原始網址，無法前往')
        restore()
        return
      }
      btn.textContent = '開啟中…'
      btn.disabled = true
      let newTab
      try {
        newTab = await chrome.tabs.create({ url: entry.sourceUrl, active: true })
      } catch (err) {
        console.warn('[judicial-outline] open tab failed', err)
        showToast('無法開啟原始網址')
        restore()
        return
      }
      showToast('已開啟原文分頁，載入後自動前往')

      const onUpdated = (tabId, info) => {
        if (tabId !== newTab.id || info.status !== 'complete') return
        chrome.tabs.onUpdated.removeListener(onUpdated)
        setTimeout(async () => {
          try {
            const res = await chrome.tabs.sendMessage(newTab.id, msg)
            if (!(res && res.ok)) {
              showToast('新分頁已載入，但找不到對應段落')
            }
          } catch (_) {
            // iframe 可能尚未完成初始化 — 不再提示
          } finally {
            restore()
          }
        }, 1200)
      }
      chrome.tabs.onUpdated.addListener(onUpdated)
      // 安全保險：10 秒後仍未 complete 就還原按鈕狀態
      setTimeout(() => {
        try { chrome.tabs.onUpdated.removeListener(onUpdated) } catch (_) {}
        if (btn.disabled) restore()
      }, 10000)
    }

    if (candidateTabs.length) {
      const target = candidateTabs[0]
      btn.textContent = '前往中…'
      btn.disabled = true
      let jumpOk = false
      try {
        await chrome.tabs.update(target.id, { active: true })
        if (typeof target.windowId === 'number') {
          try { await chrome.windows.update(target.windowId, { focused: true }) } catch (_) {}
        }
        const res = await chrome.tabs.sendMessage(target.id, msg)
        if (res && res.ok) jumpOk = true
      } catch (err) {
        console.warn('[judicial-outline] jumpToText on existing tab failed', err)
      }
      if (jumpOk) {
        showToast('已前往原文段落')
        setTimeout(restore, 900)
        return
      }
      // 分頁存在但段落已無從定位（iframe 已導航 / SPA 重繪 / 頁面更換）。
      // 改開新分頁重新載入原文。
      await openNewTabAndJump()
      return
    }

    // 連已開分頁都沒有 — 直接開新分頁
    await openNewTabAndJump()
  }

  async function copyEntry(id, btn) {
    const list = await getHistory()
    const entry = list.find((it) => it.id === id)
    if (!entry) return
    try {
      await navigator.clipboard.writeText(entry.text)
      const orig = btn.textContent
      btn.textContent = '已複製 ✓'
      btn.disabled = true
      showToast('已寫入剪貼簿，可至目標頁面貼上')
      setTimeout(() => {
        btn.textContent = orig
        btn.disabled = false
      }, 1400)
    } catch (err) {
      console.error('[judicial-outline] clipboard write failed', err)
      showToast('複製失敗，請重試')
    }
  }

  // ----- Memo & tags persistence -----
  // Guard: saves trigger storage.onChanged → render(), which would
  // destroy focused inputs. Skip render when change came from our own save.
  let saveInFlight = false

  async function saveMemo(id, memo) {
    const list = await getHistory()
    const entry = list.find((it) => it.id === id)
    if (!entry) return
    entry.memo = memo
    saveInFlight = true
    await setHistory(list)
    saveInFlight = false
  }

  async function saveTags(id, tags) {
    const list = await getHistory()
    const entry = list.find((it) => it.id === id)
    if (!entry) return
    entry.tags = tags
    saveInFlight = true
    await setHistory(list)
    saveInFlight = false
    // Re-render tag cloud since the global set of tags changed.
    renderTagCloud(list)
  }

  // ----- Tag cloud -----
  let activeTagFilter = '' // when set, only show cards that have this tag

  function collectAllTags(list) {
    const map = new Map() // tag → count
    for (const entry of list) {
      if (!entry.tags) continue
      for (const t of entry.tags) {
        map.set(t, (map.get(t) || 0) + 1)
      }
    }
    // Sort by count descending, then alphabetically
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }

  function renderTagCloud(list) {
    while (tagCloudEl.firstChild) tagCloudEl.removeChild(tagCloudEl.firstChild)
    const tags = collectAllTags(list)
    if (tags.length === 0) {
      tagCloudEl.classList.remove('is-visible')
      return
    }
    tagCloudEl.classList.add('is-visible')

    const label = document.createElement('span')
    label.className = 'sp-tag-cloud-label'
    label.textContent = '#標籤'
    tagCloudEl.appendChild(label)

    for (const [tagName, count] of tags) {
      const pill = document.createElement('button')
      pill.type = 'button'
      pill.className = 'sp-tag-cloud-pill'
      if (activeTagFilter === tagName) pill.classList.add('is-active')
      pill.textContent = `#${tagName}`
      pill.title = `${count} 張卡片`
      pill.addEventListener('click', () => {
        if (activeTagFilter === tagName) {
          // Toggle off
          activeTagFilter = ''
          searchInput.value = ''
          currentQuery = ''
        } else {
          activeTagFilter = tagName
          searchInput.value = ''
          currentQuery = ''
        }
        render()
      })
      tagCloudEl.appendChild(pill)
    }
  }

  // ----- Card rendering -----
  // ----- Drag & drop state -----
  let draggedId = null

  async function reorderEntry(fromId, beforeId) {
    const list = await getHistory()
    const fromIdx = list.findIndex((it) => it.id === fromId)
    if (fromIdx === -1) return
    const [moved] = list.splice(fromIdx, 1)
    if (!beforeId) {
      list.push(moved)
    } else {
      const toIdx = list.findIndex((it) => it.id === beforeId)
      if (toIdx === -1) {
        list.push(moved)
      } else {
        list.splice(toIdx, 0, moved)
      }
    }
    saveInFlight = true
    await setHistory(list)
    saveInFlight = false
    render()
  }

  function renderCard(entry) {
    const card = document.createElement('article')
    card.className = 'sp-card'
    card.dataset.id = entry.id
    card.dataset.source = entry.source || 'fjud'

    // Drag & drop — disable when filtering to avoid confusing index mismatches
    const isDragEnabled = !currentQuery && !activeTagFilter
    card.draggable = isDragEnabled

    card.addEventListener('dragstart', (e) => {
      // Don't hijack drag from inputs/textareas/buttons
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') {
        e.preventDefault()
        return
      }
      draggedId = entry.id
      card.classList.add('is-dragging')
      e.dataTransfer.effectAllowed = 'move'
    })
    card.addEventListener('dragend', () => {
      draggedId = null
      card.classList.remove('is-dragging')
      listEl.querySelectorAll('.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'))
    })
    card.addEventListener('dragover', (e) => {
      if (!draggedId || draggedId === entry.id) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      // Clear all other drag-over highlights
      listEl.querySelectorAll('.is-drag-over').forEach((el) => {
        if (el !== card) el.classList.remove('is-drag-over')
      })
      card.classList.add('is-drag-over')
    })
    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drag-over')
    })
    card.addEventListener('drop', (e) => {
      e.preventDefault()
      card.classList.remove('is-drag-over')
      if (!draggedId || draggedId === entry.id) return
      reorderEntry(draggedId, entry.id)
      draggedId = null
    })

    const head = document.createElement('div')
    head.className = 'sp-card-head'

    const tag = document.createElement('span')
    tag.className = 'sp-card-tag'
    tag.textContent = SOURCE_LABELS[entry.source] || SOURCE_LABELS.fjud
    head.appendChild(tag)

    let label
    if (entry.caseLabel && entry.sourceUrl) {
      label = document.createElement('a')
      label.href = entry.sourceUrl
      label.target = '_blank'
      label.rel = 'noopener noreferrer'
      label.title = '在新分頁開啟原始判決頁面'
      label.textContent = entry.caseLabel
    } else {
      label = document.createElement('div')
      if (entry.caseLabel) {
        label.textContent = entry.caseLabel
      } else {
        label.textContent = '（無字號）'
        label.classList.add('is-empty')
      }
    }
    label.classList.add('sp-card-label')

    const time = document.createElement('div')
    time.className = 'sp-card-time'
    time.textContent = formatTime(entry.createdAt)

    head.appendChild(label)
    head.appendChild(time)

    const body = document.createElement('div')
    body.className = 'sp-card-text'
    body.textContent = entry.text

    // ----- Hashtag pills (always visible when tags exist) -----
    const tagsWrap = document.createElement('div')
    tagsWrap.className = 'sp-card-tags'

    const entryTags = (entry.tags || []).slice()

    function rebuildTagPills() {
      while (tagsWrap.firstChild) tagsWrap.removeChild(tagsWrap.firstChild)
      entryTags.forEach((t, idx) => {
        const pill = document.createElement('span')
        pill.className = 'sp-hashtag'
        pill.textContent = `#${t}`

        const x = document.createElement('span')
        x.className = 'sp-hashtag-x'
        x.textContent = '×'
        x.addEventListener('click', () => {
          entryTags.splice(idx, 1)
          rebuildTagPills()
          saveTags(entry.id, entryTags.slice())
        })
        pill.appendChild(x)
        tagsWrap.appendChild(pill)
      })
      tagsWrap.hidden = entryTags.length === 0
    }
    rebuildTagPills()

    // ----- Memo preview (always visible when memo exists) -----
    const memoPreview = document.createElement('div')
    memoPreview.className = 'sp-card-memo-preview'
    memoPreview.textContent = entry.memo || ''
    memoPreview.hidden = !entry.memo
    memoPreview.title = '點擊可編輯備註'

    // ----- Memo + Tag edit area (hidden, opened by button or preview click) -----
    const memoEdit = document.createElement('div')
    memoEdit.className = 'sp-card-memo-edit'

    // Tag input row (inside edit area)
    const tagAddRow = document.createElement('div')
    tagAddRow.className = 'sp-tag-add-row'

    const tagInput = document.createElement('input')
    tagInput.type = 'text'
    tagInput.className = 'sp-tag-input'
    tagInput.placeholder = '輸入標籤名稱…'

    function commitTag() {
      const raw = tagInput.value.replace(/^#/, '').trim()
      if (!raw) return
      if (entryTags.includes(raw)) {
        tagInput.value = ''
        return
      }
      entryTags.push(raw)
      tagInput.value = ''
      rebuildTagPills()
      saveTags(entry.id, entryTags.slice())
    }

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault()
        commitTag()
      }
    })

    const tagAddBtn = document.createElement('button')
    tagAddBtn.type = 'button'
    tagAddBtn.className = 'sp-tag-add-btn'
    tagAddBtn.textContent = '＋新增標籤'
    tagAddBtn.addEventListener('click', commitTag)

    tagAddRow.appendChild(tagInput)
    tagAddRow.appendChild(tagAddBtn)

    // Memo textarea
    const memoInput = document.createElement('textarea')
    memoInput.className = 'sp-card-memo-input'
    memoInput.placeholder = '輸入備註…'
    memoInput.value = entry.memo || ''

    const memoEditActions = document.createElement('div')
    memoEditActions.className = 'sp-memo-edit-actions'

    const memoSaveBtn = document.createElement('button')
    memoSaveBtn.type = 'button'
    memoSaveBtn.className = 'sp-btn sp-btn-primary'
    memoSaveBtn.textContent = '儲存'
    memoSaveBtn.style.fontSize = '11px'
    memoSaveBtn.style.padding = '4px 12px'

    const memoCancelBtn = document.createElement('button')
    memoCancelBtn.type = 'button'
    memoCancelBtn.className = 'sp-btn'
    memoCancelBtn.textContent = '取消'
    memoCancelBtn.style.fontSize = '11px'
    memoCancelBtn.style.padding = '4px 12px'

    function closeMemoEdit() {
      memoEdit.classList.remove('is-open')
    }

    function doSaveMemo() {
      const val = memoInput.value.trim()
      saveMemo(entry.id, val)
      memoPreview.textContent = val
      memoPreview.hidden = !val
      memoBtn.classList.toggle('has-memo', !!val)
      memoBtn.textContent = (val || entryTags.length) ? '備註 ✎' : '備註'
      closeMemoEdit()
      showToast('備註已儲存')
    }

    memoSaveBtn.addEventListener('click', doSaveMemo)
    memoCancelBtn.addEventListener('click', () => {
      memoInput.value = entry.memo || ''
      closeMemoEdit()
    })
    memoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        doSaveMemo()
      }
    })

    memoEditActions.appendChild(memoCancelBtn)
    memoEditActions.appendChild(memoSaveBtn)

    memoEdit.appendChild(tagAddRow)
    memoEdit.appendChild(memoInput)
    memoEdit.appendChild(memoEditActions)

    function openMemoEdit() {
      memoInput.value = memoPreview.textContent || ''
      memoEdit.classList.add('is-open')
      memoInput.focus()
    }

    memoPreview.addEventListener('click', openMemoEdit)

    // ----- Actions -----
    const actions = document.createElement('div')
    actions.className = 'sp-card-actions'

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'sp-btn sp-btn-primary'
    copyBtn.textContent = '複製'
    copyBtn.addEventListener('click', () => copyEntry(entry.id, copyBtn))

    const jumpBtn = document.createElement('button')
    jumpBtn.type = 'button'
    jumpBtn.className = 'sp-btn sp-btn-jump'
    jumpBtn.textContent = '前往'
    jumpBtn.title = entry.sourceUrl
      ? '切換至原文分頁並滾動到該段落'
      : '此卡片無原始網址'
    if (!entry.sourceUrl) jumpBtn.disabled = true
    jumpBtn.addEventListener('click', () => jumpToEntry(entry.id, jumpBtn))

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'sp-btn sp-btn-danger'
    delBtn.textContent = '刪除'
    delBtn.addEventListener('click', () => deleteEntry(entry.id))

    const memoBtn = document.createElement('button')
    memoBtn.type = 'button'
    memoBtn.className = 'sp-btn sp-btn-memo'
    const hasMemoOrTags = entry.memo || entryTags.length
    memoBtn.textContent = hasMemoOrTags ? '備註 ✎' : '備註'
    if (hasMemoOrTags) memoBtn.classList.add('has-memo')
    memoBtn.addEventListener('click', openMemoEdit)

    const expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.className = 'sp-btn sp-btn-expand'
    expandBtn.textContent = '展開 ▾'
    expandBtn.hidden = true
    expandBtn.addEventListener('click', () => {
      const expanded = body.classList.toggle('is-expanded')
      expandBtn.textContent = expanded ? '收合 ▴' : '展開 ▾'
    })

    actions.appendChild(copyBtn)
    actions.appendChild(jumpBtn)
    actions.appendChild(delBtn)
    actions.appendChild(memoBtn)
    actions.appendChild(expandBtn)

    card.appendChild(head)
    card.appendChild(body)
    card.appendChild(tagsWrap)
    card.appendChild(memoPreview)
    card.appendChild(memoEdit)
    card.appendChild(actions)

    requestAnimationFrame(() => {
      if (body.scrollHeight > body.clientHeight + 2) {
        body.classList.add('is-truncated')
        expandBtn.hidden = false
      }
    })

    return card
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  // ----- Search / filter -----
  let currentQuery = ''
  // 檢視模式：'clipboard' = 一般剪貼簿卡片；'highlights' = 跨判決彙整螢光筆卡片
  let currentViewMode = 'clipboard'
  // 螢光筆色彩快速篩選：值為 HL_COLOR_LABELS 之 key（yellow／red／orange…），
  // 空字串代表未篩選；與搜尋列獨立可同時生效
  let activeColorFilter = ''

  function matchesQuery(entry, query) {
    if (!query) return true
    const q = query.toLowerCase()
    const fields = [
      entry.text,
      entry.caseLabel || '',
      entry.memo || '',
      (entry.tags || []).map((t) => '#' + t).join(' '),
      SOURCE_LABELS[entry.source] || '',
    ]
    return fields.some((f) => f.toLowerCase().includes(q))
  }

  function matchesTagFilter(entry) {
    if (!activeTagFilter) return true
    return (entry.tags || []).includes(activeTagFilter)
  }

  function matchesHighlightQuery(entry, query) {
    if (!query) return true
    const q = query.toLowerCase()
    const fields = [
      cleanHighlightText(entry.text || ''),
      entry.caseLabel || '',
      SOURCE_LABELS[entry.source] || '',
    ]
    return fields.some((f) => (f || '').toLowerCase().includes(q))
  }

  function matchesColorFilter(entry) {
    if (!activeColorFilter) return true
    return entry && entry.color === activeColorFilter
  }

  // 依 content.js HIGHLIGHT_COLORS 之順序收斂；只呈現實際存在之色
  const HL_COLOR_ORDER = ['yellow', 'red', 'orange', 'green', 'blue', 'purple']

  function collectHighlightColors(list) {
    const counts = new Map()
    for (const e of list || []) {
      if (!e || !e.color) continue
      counts.set(e.color, (counts.get(e.color) || 0) + 1)
    }
    return HL_COLOR_ORDER
      .filter((k) => counts.has(k))
      .map((k) => [k, counts.get(k)])
  }

  function renderColorCloud(list) {
    if (!colorCloudEl) return
    while (colorCloudEl.firstChild) colorCloudEl.removeChild(colorCloudEl.firstChild)
    const pairs = collectHighlightColors(list)
    if (pairs.length === 0) {
      colorCloudEl.classList.remove('is-visible')
      return
    }
    colorCloudEl.classList.add('is-visible')

    for (const [colorKey, count] of pairs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sp-color-swatch sp-hl-' + colorKey
      if (activeColorFilter === colorKey) btn.classList.add('is-active')
      btn.setAttribute(
        'aria-label',
        `${HL_COLOR_LABELS[colorKey] || colorKey}（${count} 張）`,
      )
      btn.title = `${HL_COLOR_LABELS[colorKey] || colorKey}（${count} 張）`
      btn.addEventListener('click', () => {
        activeColorFilter = activeColorFilter === colorKey ? '' : colorKey
        render()
      })
      colorCloudEl.appendChild(btn)
    }
  }

  function applyHeaderActionsVisibility() {
    // 匯出與清空兩組按鈕於兩模式皆可用，各自作用於對應資料集；點擊時再依
    // currentViewMode 分派處理函式
    const isHl = currentViewMode === 'highlights'
    if (exportTxtBtn) exportTxtBtn.hidden = false
    if (exportMdBtn) exportMdBtn.hidden = false
    if (clearBtn) clearBtn.hidden = false
    if (searchInput) {
      searchInput.placeholder = isHl
        ? '搜尋螢光筆內文、字號…'
        : '搜尋內文、字號、備註或 #標籤…'
    }
  }

  async function render() {
    applyHeaderActionsVisibility()
    if (currentViewMode === 'highlights') {
      await renderHighlightsView()
      return
    }
    await renderClipboardView()
  }

  async function renderClipboardView() {
    const list = await getHistory()
    clearChildren(listEl)
    renderTagCloud(list)
    // 剪貼簿檢視不顯示色彩篩選器
    if (colorCloudEl) {
      colorCloudEl.classList.remove('is-visible')
      while (colorCloudEl.firstChild) colorCloudEl.removeChild(colorCloudEl.firstChild)
    }

    if (list.length === 0) {
      emptyEl.hidden = false
      listEl.hidden = true
      searchStatus.classList.remove('is-visible')
      setEmptyMessage('clipboard')
      return
    }

    emptyEl.hidden = true
    listEl.hidden = false

    const filtered = list.filter(
      (e) => matchesTagFilter(e) && matchesQuery(e, currentQuery),
    )

    const isFiltering = currentQuery || activeTagFilter
    if (isFiltering) {
      const parts = []
      if (activeTagFilter) parts.push(`#${activeTagFilter}`)
      if (currentQuery) parts.push(`「${currentQuery}」`)
      searchStatus.textContent = `${parts.join(' + ')}：${filtered.length} / ${list.length} 張卡片`
      searchStatus.classList.add('is-visible')
    } else {
      searchStatus.classList.remove('is-visible')
    }

    for (const entry of filtered) {
      listEl.appendChild(renderCard(entry))
    }
  }

  async function renderHighlightsView() {
    const list = await getAllHighlights()
    clearChildren(listEl)
    // 螢光筆檢視不顯示剪貼簿的標籤雲（#標籤僅屬於剪貼簿卡片）
    tagCloudEl.classList.remove('is-visible')
    while (tagCloudEl.firstChild) tagCloudEl.removeChild(tagCloudEl.firstChild)
    renderColorCloud(list)

    if (list.length === 0) {
      emptyEl.hidden = false
      listEl.hidden = true
      searchStatus.classList.remove('is-visible')
      setEmptyMessage('highlights')
      return
    }

    emptyEl.hidden = true
    listEl.hidden = false

    const filtered = list.filter(
      (e) => matchesColorFilter(e) && matchesHighlightQuery(e, currentQuery),
    )

    const isFiltering = currentQuery || activeColorFilter
    if (isFiltering) {
      const parts = []
      if (activeColorFilter) parts.push(HL_COLOR_LABELS[activeColorFilter] || activeColorFilter)
      if (currentQuery) parts.push(`「${currentQuery}」`)
      searchStatus.textContent = `${parts.join(' + ')}：${filtered.length} / ${list.length} 則螢光筆`
      searchStatus.classList.add('is-visible')
    } else {
      searchStatus.classList.remove('is-visible')
    }

    for (const entry of filtered) {
      listEl.appendChild(renderHighlightCard(entry))
    }
  }

  function setEmptyMessage(mode) {
    if (!emptyEl) return
    clearChildren(emptyEl)
    if (mode === 'highlights') {
      const p1 = document.createElement('p')
      p1.textContent = '尚未標記任何螢光筆段落。'
      const p2 = document.createElement('p')
      p2.className = 'sp-empty-hint'
      p2.textContent = '於判決頁面選取文字後，使用浮動工具列的色點即可標記。'
      emptyEl.appendChild(p1)
      emptyEl.appendChild(p2)
    } else {
      const p1 = document.createElement('p')
      p1.textContent = '目前沒有紀錄。'
      const p2 = document.createElement('p')
      p2.className = 'sp-empty-hint'
      p2.appendChild(document.createTextNode('前往司法院法學資料檢索系統，選取文字後 '))
      const kbd1 = document.createElement('kbd')
      kbd1.id = 'sp-kbd-mod'
      const plat =
        (navigator.userAgentData && navigator.userAgentData.platform) ||
        navigator.platform ||
        ''
      kbd1.textContent = /mac/i.test(plat) ? '⌘' : 'Ctrl'
      const kbd2 = document.createElement('kbd')
      kbd2.textContent = 'C'
      p2.appendChild(kbd1)
      p2.appendChild(document.createTextNode('+'))
      p2.appendChild(kbd2)
      p2.appendChild(document.createTextNode(' 即可加入。'))
      emptyEl.appendChild(p1)
      emptyEl.appendChild(p2)
    }
  }

  // 螢光筆卡片拖曳狀態：與剪貼簿 draggedId 獨立以免互相干擾；同時記 hlKey
  // 以便 dragover 時快速判斷是否跨判決
  let draggedHlId = null
  let draggedHlKey = null

  // 重排螢光筆卡片。為維持全域清單「同一判決 slice 連續」之不變式（避免下
  // 次編輯時 syncAllHighlightsForCurrentJudgment 將散落項目回收至首次出現
  // 位置造成順序跳動），僅允許於同判決 slice 內調整；並同步將新順序回寫
  // 至該判決之 fint-hl:<hlKey> 鍵，使回到判決頁面或下次重載後，側欄耳標
  // 順序亦保持一致。
  async function reorderHighlightEntry(fromId, beforeId) {
    if (!fromId || fromId === beforeId) return
    const list = await getAllHighlights()
    const fromIdx = list.findIndex((e) => e.id === fromId)
    if (fromIdx === -1) return
    const moved = list[fromIdx]
    if (!moved) return

    let toIdx
    if (beforeId) {
      toIdx = list.findIndex((e) => e.id === beforeId)
      if (toIdx === -1) return
      const target = list[toIdx]
      if (!target || target.hlKey !== moved.hlKey) {
        showToast('僅能於同一判決內調整順序')
        return
      }
    } else {
      // 無 before 目標表示拖至清單末尾；限制為該判決 slice 之末端
      const sliceIdxs = list
        .map((e, i) => (e && e.hlKey === moved.hlKey ? i : -1))
        .filter((i) => i !== -1)
      toIdx = sliceIdxs[sliceIdxs.length - 1] + 1
    }

    const arr = list.slice()
    arr.splice(fromIdx, 1)
    const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx
    arr.splice(adjusted, 0, moved)

    // 同步重寫 id，使索引與新位置對齊（全域清單 id 規則為 hl-<hlKey>-<idx>；
    // 僅需重編該判決 slice 內項目，其他判決不動）
    let localIdx = 0
    for (const e of arr) {
      if (e && e.hlKey === moved.hlKey) {
        e.id = `hl-${e.hlKey}-${localIdx}`
        e.order = localIdx
        localIdx++
      }
    }

    // 寫回全域鍵（storage.onChanged 會再觸發一次渲染，與此處顯式呼叫為冪
    // 等；螢光筆檢視無聚焦輸入框，不需 saveInFlight 防抖）
    try {
      await chrome.storage.session.set({ [HL_ALL_KEY]: arr })
    } catch (_) {}

    // 同步將該判決 slice 回寫至 fint-hl:<hlKey> 儲存鍵，確保回到判決頁面
    // 後，側欄耳標與頁面塗色順序均與側邊欄卡片一致。欄位依 content.js 之
    // snapshot 格式（color, text, prefix, suffix）截取。
    const perJudgment = arr
      .filter((e) => e && e.hlKey === moved.hlKey)
      .map((e) => ({
        color: e.color,
        text: e.text,
        prefix: e.prefix || '',
        suffix: e.suffix || '',
      }))
    try {
      await chrome.storage.session.set({ [moved.hlKey]: perJudgment })
    } catch (_) {}

    render()
  }

  // 刪除單筆螢光筆卡片：先於全域清單移除該筆並重編同 hlKey 之 slice id，
  // 再依剩餘 slice 內容重寫該判決之 fint-hl:<hlKey>（若已歸零則移除鍵）。
  // content.js 監聽 session 區會自動刷新開啟中之判決頁面，清除對應塗色與
  // 側欄耳標。
  async function deleteHighlightEntry(entryId) {
    const list = await getAllHighlights()
    const idx = list.findIndex((e) => e && e.id === entryId)
    if (idx === -1) return
    const target = list[idx]
    const previewSrc = cleanHighlightText(target.text || '')
    const preview = previewSrc.slice(0, 40) + (previewSrc.length > 40 ? '…' : '')
    if (!window.confirm(`確定要刪除這段螢光筆嗎？\n\n「${preview}」`)) return

    const arr = list.slice()
    arr.splice(idx, 1)

    let localIdx = 0
    for (const e of arr) {
      if (e && e.hlKey === target.hlKey) {
        e.id = `hl-${e.hlKey}-${localIdx}`
        e.order = localIdx
        localIdx++
      }
    }

    try {
      await chrome.storage.session.set({ [HL_ALL_KEY]: arr })
    } catch (err) {
      console.warn('[judicial-outline] delete highlight failed', err)
      showToast('刪除失敗，請重試')
      return
    }

    const perJudgment = arr
      .filter((e) => e && e.hlKey === target.hlKey)
      .map((e) => ({
        color: e.color,
        text: e.text,
        prefix: e.prefix || '',
        suffix: e.suffix || '',
      }))
    try {
      if (perJudgment.length === 0) {
        await chrome.storage.session.remove(target.hlKey)
      } else {
        await chrome.storage.session.set({ [target.hlKey]: perJudgment })
      }
    } catch (_) {}

    render()
  }

  function renderHighlightCard(entry) {
    const card = document.createElement('article')
    card.className = 'sp-card is-hl-card'
    card.dataset.source = entry.source || 'fjud'
    card.dataset.hlId = entry.id || ''
    card.dataset.hlKey = entry.hlKey || ''

    // 任一篩選條件啟用時停用拖曳，避免過濾結果與全域清單順序錯位
    const isDragEnabled = !currentQuery && !activeColorFilter
    card.draggable = isDragEnabled

    card.addEventListener('dragstart', (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') {
        e.preventDefault()
        return
      }
      draggedHlId = entry.id
      draggedHlKey = entry.hlKey || ''
      card.classList.add('is-dragging')
      try { e.dataTransfer.effectAllowed = 'move' } catch (_) {}
    })
    card.addEventListener('dragend', () => {
      draggedHlId = null
      draggedHlKey = null
      card.classList.remove('is-dragging')
      listEl.querySelectorAll('.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'))
    })
    card.addEventListener('dragover', (e) => {
      if (!draggedHlId || draggedHlId === entry.id) return
      // 僅允許於同一判決 slice 內拖放；跨判決不 preventDefault，瀏覽器會顯示
      // 「禁止」游標、drop 亦不觸發
      if (draggedHlKey && entry.hlKey && draggedHlKey !== entry.hlKey) return
      e.preventDefault()
      try { e.dataTransfer.dropEffect = 'move' } catch (_) {}
      listEl.querySelectorAll('.is-drag-over').forEach((el) => {
        if (el !== card) el.classList.remove('is-drag-over')
      })
      card.classList.add('is-drag-over')
    })
    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drag-over')
    })
    card.addEventListener('drop', (e) => {
      e.preventDefault()
      card.classList.remove('is-drag-over')
      if (!draggedHlId || draggedHlId === entry.id) return
      if (draggedHlKey && entry.hlKey && draggedHlKey !== entry.hlKey) return
      const fromId = draggedHlId
      draggedHlId = null
      draggedHlKey = null
      reorderHighlightEntry(fromId, entry.id)
    })

    const head = document.createElement('div')
    head.className = 'sp-card-head'

    const swatch = document.createElement('span')
    swatch.className = 'sp-card-hl-swatch sp-hl-' + (entry.color || 'yellow')
    swatch.title = '螢光筆顏色'
    head.appendChild(swatch)

    const tag = document.createElement('span')
    tag.className = 'sp-card-tag'
    tag.textContent = SOURCE_LABELS[entry.source] || SOURCE_LABELS.fjud
    head.appendChild(tag)

    let label
    if (entry.caseLabel && entry.sourceUrl) {
      label = document.createElement('a')
      label.href = entry.sourceUrl
      label.target = '_blank'
      label.rel = 'noopener noreferrer'
      label.title = '在新分頁開啟原始判決頁面'
      label.textContent = entry.caseLabel
    } else {
      label = document.createElement('div')
      if (entry.caseLabel) {
        label.textContent = entry.caseLabel
      } else {
        label.textContent = '（無字號）'
        label.classList.add('is-empty')
      }
    }
    label.classList.add('sp-card-label')
    head.appendChild(label)

    const body = document.createElement('div')
    body.className = 'sp-card-text'
    // 顯示用文字：清理換行與多餘空白；儲存層仍保留原貌供跳轉比對
    body.textContent = cleanHighlightText(entry.text || '')

    const actions = document.createElement('div')
    actions.className = 'sp-card-actions'

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'sp-btn sp-btn-primary'
    copyBtn.textContent = '複製'
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(cleanHighlightText(entry.text || ''))
        const orig = copyBtn.textContent
        copyBtn.textContent = '已複製 ✓'
        copyBtn.disabled = true
        showToast('已寫入剪貼簿')
        setTimeout(() => {
          copyBtn.textContent = orig
          copyBtn.disabled = false
        }, 1400)
      } catch (_) {
        showToast('複製失敗，請重試')
      }
    })

    const jumpBtn = document.createElement('button')
    jumpBtn.type = 'button'
    jumpBtn.className = 'sp-btn sp-btn-jump'
    jumpBtn.textContent = '前往'
    jumpBtn.title = entry.sourceUrl
      ? '切換至原文分頁並滾動到該段落'
      : '此卡片無原始網址'
    if (!entry.sourceUrl) jumpBtn.disabled = true
    jumpBtn.addEventListener('click', () => jumpToHighlight(entry, jumpBtn))

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'sp-btn sp-btn-danger'
    delBtn.textContent = '刪除'
    delBtn.title = '清除此段螢光筆標記'
    delBtn.addEventListener('click', () => deleteHighlightEntry(entry.id))

    actions.appendChild(copyBtn)
    actions.appendChild(jumpBtn)
    actions.appendChild(delBtn)

    const expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.className = 'sp-btn sp-btn-expand'
    expandBtn.textContent = '展開 ▾'
    expandBtn.hidden = true
    expandBtn.addEventListener('click', () => {
      const expanded = body.classList.toggle('is-expanded')
      expandBtn.textContent = expanded ? '收合 ▴' : '展開 ▾'
    })
    actions.appendChild(expandBtn)

    card.appendChild(head)
    card.appendChild(body)
    card.appendChild(actions)

    requestAnimationFrame(() => {
      if (body.scrollHeight > body.clientHeight + 2) {
        body.classList.add('is-truncated')
        expandBtn.hidden = false
      }
    })

    return card
  }

  // 螢光筆卡片「前往」定位：與剪貼簿 jumpToEntry 同流程，但無錨點可用，
  // 改依 content.js jumpToText 之文字搜尋策略定位。找不到已開分頁時開新
  // 分頁重新載入。
  async function jumpToHighlight(entry, btn) {
    if (!entry.sourceUrl) {
      showToast('此卡片沒有原始網址，無法前往')
      return
    }

    const msg = {
      action: 'jumpToText',
      rawText: entry.text || '',
      text: entry.text || '',
      caseLabel: entry.caseLabel || '',
      anchorIdStart: '',
      anchorIdEnd: '',
    }

    const judicialHostRe = /(legal\.judicial\.gov\.tw|judgment\.judicial\.gov\.tw|legal\.law\.intraj|judgment\.law\.intraj)/
    const normalizeUrl = (u) => {
      if (!u) return ''
      try {
        const x = new URL(u)
        return x.origin + x.pathname + x.search
      } catch (_) {
        return u
      }
    }
    const pickBest = (tabs) => tabs.find((t) => t.active) || tabs[0]

    let allTabs = []
    try { allTabs = await chrome.tabs.query({}) } catch (_) {}

    let candidateTabs = []
    const wantPage = normalizeUrl(entry.pageUrl)
    const wantSource = normalizeUrl(entry.sourceUrl)
    if (wantPage) {
      const matches = allTabs.filter((t) => normalizeUrl(t.url) === wantPage)
      if (matches.length) candidateTabs = [pickBest(matches)]
    }
    if (!candidateTabs.length && wantSource) {
      const matches = allTabs.filter((t) => normalizeUrl(t.url) === wantSource)
      if (matches.length) candidateTabs = [pickBest(matches)]
    }
    if (!candidateTabs.length && entry.sourceUrl) {
      try {
        const src = new URL(entry.sourceUrl)
        const id2 = src.searchParams.get('id')
        if (id2) {
          const matches = allTabs.filter((t) => {
            if (!t.url) return false
            if (!judicialHostRe.test(t.url)) return false
            try {
              const tu = new URL(t.url)
              return tu.hostname === src.hostname && tu.searchParams.get('id') === id2
            } catch (_) {
              return false
            }
          })
          if (matches.length) candidateTabs = [pickBest(matches)]
        }
      } catch (_) {}
    }

    const orig = btn.textContent
    const restore = () => {
      btn.textContent = orig
      btn.disabled = false
    }

    const openNewTabAndJump = async () => {
      btn.textContent = '開啟中…'
      btn.disabled = true
      let newTab
      try {
        newTab = await chrome.tabs.create({ url: entry.sourceUrl, active: true })
      } catch (err) {
        console.warn('[judicial-outline] open tab failed', err)
        showToast('無法開啟原始網址')
        restore()
        return
      }
      showToast('已開啟原文分頁，載入後自動前往')

      const onUpdated = (tabId, info) => {
        if (tabId !== newTab.id || info.status !== 'complete') return
        chrome.tabs.onUpdated.removeListener(onUpdated)
        setTimeout(async () => {
          try {
            const res = await chrome.tabs.sendMessage(newTab.id, msg)
            if (!(res && res.ok)) {
              showToast('新分頁已載入，但找不到對應段落')
            }
          } catch (_) {
            // iframe 尚未初始化 — 不再提示
          } finally {
            restore()
          }
        }, 1200)
      }
      chrome.tabs.onUpdated.addListener(onUpdated)
      setTimeout(() => {
        try { chrome.tabs.onUpdated.removeListener(onUpdated) } catch (_) {}
        if (btn.disabled) restore()
      }, 10000)
    }

    if (candidateTabs.length) {
      const target = candidateTabs[0]
      btn.textContent = '前往中…'
      btn.disabled = true
      let jumpOk = false
      try {
        await chrome.tabs.update(target.id, { active: true })
        if (typeof target.windowId === 'number') {
          try { await chrome.windows.update(target.windowId, { focused: true }) } catch (_) {}
        }
        const res = await chrome.tabs.sendMessage(target.id, msg)
        if (res && res.ok) jumpOk = true
      } catch (err) {
        console.warn('[judicial-outline] jumpToText on existing tab failed', err)
      }
      if (jumpOk) {
        showToast('已前往原文段落')
        setTimeout(restore, 900)
        return
      }
      await openNewTabAndJump()
      return
    }

    await openNewTabAndJump()
  }

  let searchTimer = null
  searchInput.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      currentQuery = searchInput.value.trim()
      // If user is typing in search, clear the tag cloud active state
      // so the two filters don't confuse each other.
      if (currentQuery && activeTagFilter) {
        activeTagFilter = ''
      }
      render()
    }, 200)
  })

  function formatFullTime(ts) {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  function buildExportText(list) {
    const lines = []
    lines.push(`判決剪貼簿匯出（共 ${list.length} 筆）`)
    lines.push(`匯出時間：${formatFullTime(Date.now())}`)
    lines.push('')
    lines.push('============================================================')
    lines.push('')
    list.forEach((entry, idx) => {
      const sourceLabel = SOURCE_LABELS[entry.source] || SOURCE_LABELS.fjud
      const heading = entry.caseLabel || '（無字號）'
      lines.push(`${idx + 1}. 【${sourceLabel}】${heading}`)
      lines.push(`複製時間：${formatFullTime(entry.createdAt)}`)
      if (entry.sourceUrl) lines.push(`原始網址：${entry.sourceUrl}`)
      if (entry.tags && entry.tags.length) {
        lines.push(`標籤：${entry.tags.map((t) => '#' + t).join(' ')}`)
      }
      if (entry.memo) lines.push(`備註：${entry.memo}`)
      lines.push('')
      lines.push(entry.text)
      lines.push('')
      lines.push('------------------------------------------------------------')
      lines.push('')
    })
    return lines.join('\n')
  }

  function buildExportMarkdown(list) {
    const lines = []
    lines.push('# 判決剪貼簿匯出')
    lines.push('')
    lines.push(`- 共 ${list.length} 筆`)
    lines.push(`- 匯出時間：${formatFullTime(Date.now())}`)
    lines.push('')
    lines.push('---')
    lines.push('')
    list.forEach((entry, idx) => {
      const sourceLabel = SOURCE_LABELS[entry.source] || SOURCE_LABELS.fjud
      const heading = entry.caseLabel || '（無字號）'
      lines.push(`## ${idx + 1}. ${heading}`)
      lines.push('')
      lines.push(`- **來源**：${sourceLabel}`)
      lines.push(`- **複製時間**：${formatFullTime(entry.createdAt)}`)
      if (entry.sourceUrl) {
        lines.push(`- **原始網址**：<${entry.sourceUrl}>`)
      }
      if (entry.tags && entry.tags.length) {
        lines.push(`- **標籤**：${entry.tags.map((t) => '#' + t).join(' ')}`)
      }
      if (entry.memo) {
        lines.push(`- **備註**：${entry.memo}`)
      }
      lines.push('')
      // Quote the judgment text so it renders as a blockquote in Obsidian.
      entry.text.split('\n').forEach((line) => {
        lines.push(`> ${line}`)
      })
      lines.push('')
      lines.push('---')
      lines.push('')
    })
    return lines.join('\n')
  }

  // 螢光筆匯出：依 hlKey 分區，同一判決之段落群聚呈現；保留全域清單原有
  // 順序（slice 內為使用者拖曳順序，slice 之間為最近編輯者優先）
  function groupHighlightsByJudgment(list) {
    const groups = []
    let current = null
    for (const e of list) {
      if (!e) continue
      if (!current || current.hlKey !== e.hlKey) {
        current = {
          hlKey: e.hlKey,
          caseLabel: e.caseLabel || '',
          sourceUrl: e.sourceUrl || '',
          source: e.source || 'fjud',
          entries: [],
        }
        groups.push(current)
      }
      current.entries.push(e)
    }
    return groups
  }

  function buildHighlightsExportText(list) {
    const groups = groupHighlightsByJudgment(list)
    const lines = []
    lines.push(`螢光筆匯出（共 ${list.length} 則 / ${groups.length} 份判決）`)
    lines.push(`匯出時間：${formatFullTime(Date.now())}`)
    lines.push('')
    lines.push('============================================================')
    lines.push('')
    groups.forEach((g, gi) => {
      const sourceLabel = SOURCE_LABELS[g.source] || SOURCE_LABELS.fjud
      const heading = g.caseLabel || '（無字號）'
      lines.push(`${gi + 1}. 【${sourceLabel}】${heading}`)
      if (g.sourceUrl) lines.push(`原始網址：${g.sourceUrl}`)
      lines.push(`螢光段落：${g.entries.length} 則`)
      lines.push('')
      g.entries.forEach((entry, idx) => {
        const color = HL_COLOR_LABELS[entry.color] || entry.color || ''
        lines.push(`(${idx + 1}) [${color}]`)
        lines.push(cleanHighlightText(entry.text || ''))
        lines.push('')
      })
      lines.push('------------------------------------------------------------')
      lines.push('')
    })
    return lines.join('\n')
  }

  function buildHighlightsExportMarkdown(list) {
    const groups = groupHighlightsByJudgment(list)
    const lines = []
    lines.push('# 螢光筆匯出')
    lines.push('')
    lines.push(`- 共 ${list.length} 則，橫跨 ${groups.length} 份判決`)
    lines.push(`- 匯出時間：${formatFullTime(Date.now())}`)
    lines.push('')
    lines.push('---')
    lines.push('')
    groups.forEach((g, gi) => {
      const sourceLabel = SOURCE_LABELS[g.source] || SOURCE_LABELS.fjud
      const heading = g.caseLabel || '（無字號）'
      lines.push(`## ${gi + 1}. ${heading}`)
      lines.push('')
      lines.push(`- **來源**：${sourceLabel}`)
      if (g.sourceUrl) {
        lines.push(`- **原始網址**：<${g.sourceUrl}>`)
      }
      lines.push(`- **螢光段落**：${g.entries.length} 則`)
      lines.push('')
      g.entries.forEach((entry, idx) => {
        const color = HL_COLOR_LABELS[entry.color] || entry.color || ''
        lines.push(`### (${idx + 1}) ${color}`)
        lines.push('')
        // 清理後為單行字串；blockquote 即單行 > 前綴即可
        lines.push(`> ${cleanHighlightText(entry.text || '')}`)
        lines.push('')
      })
      lines.push('---')
      lines.push('')
    })
    return lines.join('\n')
  }

  function downloadBlob(filename, mime, content) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function timestampStamp() {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  }

  async function exportAs(format) {
    const stamp = timestampStamp()
    if (currentViewMode === 'highlights') {
      const list = await getAllHighlights()
      if (list.length === 0) {
        showToast('目前沒有可匯出的螢光筆段落')
        return
      }
      if (format === 'md') {
        downloadBlob(
          `judicial-highlights-${stamp}.md`,
          'text/markdown;charset=utf-8',
          buildHighlightsExportMarkdown(list),
        )
        showToast(`已匯出 ${list.length} 則螢光筆（.md）`)
      } else {
        downloadBlob(
          `judicial-highlights-${stamp}.txt`,
          'text/plain;charset=utf-8',
          buildHighlightsExportText(list),
        )
        showToast(`已匯出 ${list.length} 則螢光筆（.txt）`)
      }
      return
    }
    const list = await getHistory()
    if (list.length === 0) {
      showToast('目前沒有可匯出的卡片')
      return
    }
    if (format === 'md') {
      downloadBlob(
        `judicial-clips-${stamp}.md`,
        'text/markdown;charset=utf-8',
        buildExportMarkdown(list),
      )
      showToast(`已匯出 ${list.length} 張卡片（.md）`)
    } else {
      downloadBlob(
        `judicial-clips-${stamp}.txt`,
        'text/plain;charset=utf-8',
        buildExportText(list),
      )
      showToast(`已匯出 ${list.length} 張卡片（.txt）`)
    }
  }

  exportTxtBtn.addEventListener('click', () => exportAs('txt'))
  exportMdBtn.addEventListener('click', () => exportAs('md'))

  // 清除所有螢光筆：先移除全域聚合鍵，再批次移除每份判決之 fint-hl:* 鍵；
  // 已開啟之判決頁面由 content.js 的 storage.onChanged 監聽自動還原為無標
  // 記狀態（highlightEntries 清空、CSS Highlights 移除、側欄耳標隱藏）。
  async function clearAllHighlights() {
    const list = await getAllHighlights()
    if (list.length === 0) return
    const groups = groupHighlightsByJudgment(list)
    const confirmMsg =
      `確定要清空全部 ${list.length} 則螢光筆嗎？` +
      `\n\n橫跨 ${groups.length} 份判決的標記都將一併移除，此動作無法復原。`
    if (!window.confirm(confirmMsg)) return
    let all = {}
    try {
      all = await chrome.storage.session.get(null)
    } catch (_) {}
    const perJudgmentKeys = Object.keys(all || {}).filter((k) =>
      k.startsWith('fint-hl:'),
    )
    try {
      await chrome.storage.session.remove([HL_ALL_KEY, ...perJudgmentKeys])
    } catch (err) {
      console.warn('[judicial-outline] clear highlights failed', err)
      showToast('清空失敗，請重試')
      return
    }
    activeColorFilter = ''
    showToast('已清空所有螢光筆')
  }

  clearBtn.addEventListener('click', async () => {
    if (currentViewMode === 'highlights') {
      await clearAllHighlights()
      return
    }
    const list = await getHistory()
    if (list.length === 0) return
    if (!window.confirm(`確定要清空全部 ${list.length} 張卡片嗎？此動作無法復原。`)) return
    await setHistory([])
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[CLIP_HISTORY_KEY]) {
      // Skip re-render when the change came from our own memo/tag save,
      // otherwise the focused input would be destroyed mid-typing.
      if (saveInFlight) return
      if (currentViewMode === 'clipboard') render()
    }
    if (area === 'session' && changes[HL_ALL_KEY]) {
      if (currentViewMode === 'highlights') render()
    }
    if (area === 'sync' && changes.appendCitation) {
      applyCiteChecked(changes.appendCitation.newValue)
    }
  })

  // ----- Append-citation toggle -----
  //
  // 與 options 頁共用 chrome.storage.sync 的 appendCitation 鍵；任一端切換後，
  // storage.onChanged 會即時同步到另一端與 content script。
  function applyCiteChecked(value) {
    const on = value !== false
    citeRadios.forEach((el) => {
      el.checked = el.value === (on ? 'on' : 'off')
    })
  }

  async function loadAppendCitation() {
    try {
      const { appendCitation } = await chrome.storage.sync.get({
        appendCitation: true,
      })
      applyCiteChecked(appendCitation)
    } catch (_) {
      applyCiteChecked(true)
    }
  }

  citeRadios.forEach((el) => {
    el.addEventListener('change', () => {
      if (!el.checked) return
      chrome.storage.sync
        .set({ appendCitation: el.value === 'on' })
        .catch(() => {})
    })
  })

  loadAppendCitation()

  // ----- 一般／螢光筆 檢視切換 -----
  function applyViewChecked(mode) {
    viewRadios.forEach((el) => {
      el.checked = el.value === mode
    })
  }

  async function loadViewMode() {
    try {
      const { [VIEW_MODE_KEY]: saved } = await chrome.storage.local.get(VIEW_MODE_KEY)
      if (saved === 'highlights' || saved === 'clipboard') {
        currentViewMode = saved
      }
    } catch (_) {}
    applyViewChecked(currentViewMode)
  }

  viewRadios.forEach((el) => {
    el.addEventListener('change', () => {
      if (!el.checked) return
      const newMode = el.value === 'highlights' ? 'highlights' : 'clipboard'
      if (newMode === currentViewMode) return
      currentViewMode = newMode
      // 切模式時清空搜尋字串、#標籤與色彩篩選，避免前一模式之條件殘留造成
      // 誤解
      currentQuery = ''
      activeTagFilter = ''
      activeColorFilter = ''
      if (searchInput) searchInput.value = ''
      chrome.storage.local.set({ [VIEW_MODE_KEY]: currentViewMode }).catch(() => {})
      render()
    })
  })

  // ----- Font-size control (persists in chrome.storage.local) -----
  let fontIdx = FONT_DEFAULT_IDX

  function applyFontSize() {
    FONT_STEPS.forEach((cls) => {
      if (cls) document.body.classList.remove(cls)
    })
    const cls = FONT_STEPS[fontIdx]
    if (cls) document.body.classList.add(cls)
    fsMinusBtn.disabled = fontIdx <= 0
    fsPlusBtn.disabled = fontIdx >= FONT_STEPS.length - 1
  }

  async function loadFontSize() {
    try {
      const { [FONT_SIZE_KEY]: saved } = await chrome.storage.local.get(FONT_SIZE_KEY)
      if (typeof saved === 'number' && saved >= 0 && saved < FONT_STEPS.length) {
        fontIdx = saved
      }
    } catch (_) {}
    applyFontSize()
  }

  function saveFontSize() {
    chrome.storage.local.set({ [FONT_SIZE_KEY]: fontIdx }).catch(() => {})
  }

  fsMinusBtn.addEventListener('click', () => {
    if (fontIdx > 0) {
      fontIdx--
      applyFontSize()
      saveFontSize()
    }
  })

  fsPlusBtn.addEventListener('click', () => {
    if (fontIdx < FONT_STEPS.length - 1) {
      fontIdx++
      applyFontSize()
      saveFontSize()
    }
  })

  loadFontSize()
  // 先載回使用者上次的檢視模式再渲染，避免初始化時顯示錯誤分頁
  loadViewMode().then(render)
})()
