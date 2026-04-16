;(() => {
  const CLIP_HISTORY_KEY = 'clipHistory'
  const FONT_SIZE_KEY = 'spFontSize'
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
  const searchInput = document.getElementById('sp-search')
  const searchStatus = document.getElementById('sp-search-status')
  const tagCloudEl = document.getElementById('sp-tag-cloud')

  const SOURCE_LABELS = {
    fjud: '裁判書',
    fint: '判解函釋',
    intraj_fint: '內網判解函釋',
    intraj_fjud: '內網裁判書',
    intraj: '內網', // 相容舊版資料欄位
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

  async function render() {
    const list = await getHistory()
    clearChildren(listEl)
    renderTagCloud(list)

    if (list.length === 0) {
      emptyEl.hidden = false
      listEl.hidden = true
      searchStatus.classList.remove('is-visible')
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
    const list = await getHistory()
    if (list.length === 0) {
      showToast('目前沒有可匯出的卡片')
      return
    }
    const stamp = timestampStamp()
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

  clearBtn.addEventListener('click', async () => {
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
      render()
    }
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
  render()
})()
