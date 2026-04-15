// Open the side panel when the user clicks the toolbar icon, from any page.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[judicial-outline] setPanelBehavior failed', err))

// Allow content scripts (untrusted contexts) to read/write chrome.storage.session.
// Without this, content.js's pushClipHistory silently fails with an access error.
if (chrome.storage.session.setAccessLevel) {
  chrome.storage.session
    .setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
    .catch((err) => console.error('[judicial-outline] setAccessLevel failed', err))
}
