chrome.action.onClicked.addListener(async tab => {
  if (!Number.isInteger(tab?.id)) return;
  try {
    await chrome.tabs.sendMessage(tab.id!, { type: 'vtop-toggle-command-menu' });
  } catch {
    await chrome.tabs.create({ url: 'https://vtop.vit.ac.in/vtop/content' });
  }
});
