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

  const SOURCE_LABELS = {
    fjud: '裁判書',
    fint: '判解函釋',
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

  function renderCard(entry) {
    const card = document.createElement('article')
    card.className = 'sp-card'
    card.dataset.id = entry.id
    card.dataset.source = entry.source || 'fjud'

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

    const actions = document.createElement('div')
    actions.className = 'sp-card-actions'

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'sp-btn sp-btn-primary'
    copyBtn.textContent = '複製'
    copyBtn.addEventListener('click', () => copyEntry(entry.id, copyBtn))

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'sp-btn sp-btn-danger'
    delBtn.textContent = '刪除'
    delBtn.addEventListener('click', () => deleteEntry(entry.id))

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
    actions.appendChild(delBtn)
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

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  async function render() {
    const list = await getHistory()
    clearChildren(listEl)
    if (list.length === 0) {
      emptyEl.hidden = false
      listEl.hidden = true
      return
    }
    emptyEl.hidden = true
    listEl.hidden = false
    for (const entry of list) {
      listEl.appendChild(renderCard(entry))
    }
  }

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
