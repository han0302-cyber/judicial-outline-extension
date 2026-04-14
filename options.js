// Options page script — reads / writes per-site sidebar placement to
// chrome.storage.sync. Content script listens for changes and re-renders.

const SITES = ['fint', 'fjud']
const DEFAULTS = { fint: 'left', fjud: 'left' }

function loadSettings() {
  chrome.storage.sync.get(
    { positions: DEFAULTS, appendCitation: true },
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
  chrome.storage.sync.set({ positions, appendCitation }, () => {
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
