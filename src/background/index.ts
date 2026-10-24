// Keep the toolbar icon opening the popup; the side panel is opened from the popup.
function configureSidePanel(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(configureSidePanel);
chrome.runtime.onStartup.addListener(configureSidePanel);
