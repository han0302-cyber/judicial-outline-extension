// Options page script — reads / writes per-site sidebar placement to
// chrome.storage.sync. Content script listens for changes and re-renders.

const SITES = ['fint', 'fjud', 'intraj_fint', 'intraj_fjud']
const DEFAULTS = { fint: 'left', fjud: 'left', intraj_fint: 'left', intraj_fjud: 'left' }

function clampDepth(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 3
  if (n < 1) return 1
  if (n > 6) return 6
  return Math.floor(n)
}

function loadSettings() {
  chrome.storage.sync.get(
    { positions: DEFAULTS, appendCitation: true, maxDepth: 3 },
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
  const dChecked = document.querySelector('input[name="maxDepth"]:checked')
  const maxDepth = dChecked ? clampDepth(dChecked.value) : 3
  chrome.storage.sync.set({ positions, appendCitation, maxDepth }, () => {
    const status = document.getElementById('status')
    if (!status) return
    status.classList.add('visible')
    clearTimeout(saveSettings._timer)
    saveSettings._timer = setTimeout(
      () => status.classList.remove('visible'),
      1600,
    )
  })
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings()
  document.querySelectorAll('input[type=radio]').forEach((el) => {
    el.addEventListener('change', saveSettings)
  })
})
