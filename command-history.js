// One background writer serializes selections from every tab, avoiding lost increments.
(() => {
  'use strict';
  const api = globalThis.browser || chrome;
  const { USAGE_KEY, validUsageId, sanitizeUsage, recordUsage } = globalThis.VtopNavigation;
  let history, queue = Promise.resolve();
  async function record(id) {
    if (!history) {
      try { history = sanitizeUsage((await api.storage.local.get(USAGE_KEY))[USAGE_KEY]); }
      catch { return { ok: false }; } // Do not overwrite saved history after a failed read.
    }
    history = recordUsage(history, id);
    try {
      await api.storage.local.set({ [USAGE_KEY]: history });
      return { ok: true, history };
    } catch {
      // Keep this session usable and retry persistence on the next selection.
      return { ok: false, history };
    }
  }
  api.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== 'vtop-command-used') return;
    if (sender.id !== api.runtime.id || !/^https:\/\/vtop\.vit\.ac\.in\/vtop\//.test(sender.url || '') ||
        !validUsageId(message.id)) {
      reply({ ok: false }); return;
    }
    queue = queue.catch(() => {}).then(() => record(message.id));
    queue.then(reply, () => reply({ ok: false }));
    return true;
  });
})();
