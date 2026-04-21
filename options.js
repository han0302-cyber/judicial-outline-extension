// Options page script — reads / writes per-site sidebar placement to
// chrome.storage.sync. Content script listens for changes and re-renders.

const SITES = ['fint', 'fjud', 'intraj_fint', 'intraj_fjud']
const DEFAULTS = { fint: 'left', fjud: 'left', intraj_fint: 'left', intraj_fjud: 'left' }
const HL_COLOR_KEYS = ['yellow', 'red', 'orange', 'green', 'blue', 'purple']

function clampDepth(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 3
  if (n < 1) return 1
  if (n > 6) return 6
  return Math.floor(n)
}

function loadSettings() {
  chrome.storage.sync.get(
    {
      positions: DEFAULTS,
      appendCitation: true,
      maxDepth: 3,
      showCitations: true,
      enableHighlighter: true,
      highlighterColors: HL_COLOR_KEYS,
    },
    (result) => {
      const positions = Object.assign({}, DEFAULTS, result.positions || {})
      SITES.forEach((site) => {
        const value = positions[site] || 'left'
        const input = document.querySelector(
          'input[name="' + site + '"][value="' + value + '"]',
        )
        if (input) input.checked = true
      })
      const citation = result.appendCitation === false ? 'off' : 'on'
      const cInput = document.querySelector(
        'input[name="citation"][value="' + citation + '"]',
      )
      if (cInput) cInput.checked = true
      const showCit = result.showCitations === false ? 'off' : 'on'
      const scInput = document.querySelector(
        'input[name="showCitations"][value="' + showCit + '"]',
      )
      if (scInput) scInput.checked = true
      const enableHl = result.enableHighlighter === false ? 'off' : 'on'
      const ehInput = document.querySelector(
        'input[name="enableHighlighter"][value="' + enableHl + '"]',
      )
      if (ehInput) ehInput.checked = true
      const hlColors = Array.isArray(result.highlighterColors)
        ? result.highlighterColors
        : HL_COLOR_KEYS
      HL_COLOR_KEYS.forEach((key) => {
        const box = document.querySelector(
          'input[name="highlighterColor"][value="' + key + '"]',
        )
        if (box) box.checked = hlColors.indexOf(key) !== -1
      })
      const depth = clampDepth(result.maxDepth)
      const dInput = document.querySelector(
        'input[name="maxDepth"][value="' + depth + '"]',
      )
      if (dInput) dInput.checked = true
    },
  )
}

function saveSettings() {
  const positions = {}
  SITES.forEach((site) => {
    const checked = document.querySelector('input[name="' + site + '"]:checked')
    positions[site] = checked ? checked.value : 'left'
  })
  const cChecked = document.querySelector('input[name="citation"]:checked')
  const appendCitation = cChecked ? cChecked.value === 'on' : true
  const scChecked = document.querySelector(
    'input[name="showCitations"]:checked',
  )
  const showCitations = scChecked ? scChecked.value === 'on' : true
  const ehChecked = document.querySelector(
    'input[name="enableHighlighter"]:checked',
  )
  const enableHighlighter = ehChecked ? ehChecked.value === 'on' : true
  const highlighterColors = []
  HL_COLOR_KEYS.forEach((key) => {
    const box = document.querySelector(
      'input[name="highlighterColor"][value="' + key + '"]',
    )
    if (box && box.checked) highlighterColors.push(key)
  })
  const dChecked = document.querySelector('input[name="maxDepth"]:checked')
  const maxDepth = dChecked ? clampDepth(dChecked.value) : 3
  chrome.storage.sync.set(
    {
      positions,
      appendCitation,
      maxDepth,
      showCitations,
      enableHighlighter,
      highlighterColors,
    },
    () => {
      const status = document.getElementById('status')
      if (!status) return
      status.classList.add('visible')
      clearTimeout(saveSettings._timer)
      saveSettings._timer = setTimeout(
        () => status.classList.remove('visible'),
        1600,
      )
    },
  )
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings()
  document.querySelectorAll('input[type=radio]').forEach((el) => {
    el.addEventListener('change', saveSettings)
  })
  // 顏色選擇為 checkbox 群組，分別監聽以即時儲存。
  document
    .querySelectorAll('input[type=checkbox][name="highlighterColor"]')
    .forEach((el) => {
      el.addEventListener('change', saveSettings)
    })
})
