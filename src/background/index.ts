import { createEncodingMenus, setupEncodingMenu } from './encodingMenu';
import { createUpdateMenus, setupUpdateCheck } from './updateCheck';

// Keep the toolbar icon opening the popup; the side panel is opened from the popup.
function configureSidePanel(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
}

// Menus are rebuilt together because removeAll() would wipe each other's items.
function createMenus(): void {
  chrome.contextMenus.removeAll(() => {
    createEncodingMenus();
    createUpdateMenus().catch(console.error);
  });
}

chrome.runtime.onInstalled.addListener(configureSidePanel);
chrome.runtime.onStartup.addListener(configureSidePanel);
chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(createMenus);

setupEncodingMenu();
setupUpdateCheck();
