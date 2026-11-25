chrome.action.onClicked.addListener(async tab => {
  if (!Number.isInteger(tab?.id)) return;
  try {
    await chrome.tabs.sendMessage(tab.id!, { type: 'vtop-toggle-command-menu' });
  } catch {
    await chrome.tabs.create({ url: 'https://vtop.vit.ac.in/vtop/content' });
  }
});
// After an update (not a first install or a reload of the same version), open the website's
// What's new page once for the version just installed. Only the version number is in the URL.
chrome.runtime.onInstalled.addListener(details => {
  const version = chrome.runtime.getManifest().version;
  if (details.reason !== 'update' || !details.previousVersion || details.previousVersion === version) return;
  chrome.tabs.create({ url: `https://vtop-cmd.chirayusahu.com/whats-new?v=${encodeURIComponent(version)}` }).catch(() => {});
});
