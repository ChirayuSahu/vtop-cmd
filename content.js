(() => {
  'use strict';
  if (document.getElementById('vtop-command-root')) return;
  const { discover, search, USAGE_KEY, sanitizeUsage, recordUsage } = globalThis.VtopNavigation;
  const semesters = globalThis.VtopSemesters;
  const host = document.createElement('div');
  host.id = 'vtop-command-root';
  const shadow = host.attachShadow({ mode: 'open' });
  const { logo, tokens, font, shortcut } = globalThis.VtopBrand;
  const combobox = globalThis.VtopCombobox;
  globalThis.VtopBrand.setMarkup(shadow, `
    <style>
      :host{all:initial;color-scheme:light;${tokens.light};font:${font};color:var(--text)}
      :host([data-dark]){color-scheme:dark;${tokens.dark}}
      *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      .dock{position:fixed;right:18px;bottom:18px;z-index:2147483645;display:flex;gap:2px;align-items:center;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--muted);box-shadow:0 2px 10px #0000001a}
      .dock button{display:flex;align-items:center;gap:7px;border:0;border-radius:8px;background:transparent;color:inherit;padding:4px 8px;font-size:12px;font-weight:500;white-space:nowrap}.dock button:hover{background:var(--hover);color:var(--text)}
      .dock .launcher{padding:3px 8px 3px 3px}.dock .shortcut{border:0;padding:0;font-size:12px;color:inherit;letter-spacing:.3px}.dock .shortcut .symbol{font-size:16.5px;line-height:1;vertical-align:-1.5px}.dock .sep{width:1px;height:16px;background:var(--line)}
      .dock .semester-chip{display:block;max-width:140px;overflow:hidden;text-overflow:ellipsis}
      .logo{display:block;flex-shrink:0}.brand{display:flex;align-items:center;gap:9px}.brand .logo{width:24px;height:24px}
      kbd{font:11px/1.5 inherit;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:2px 5px;white-space:nowrap}
      dialog{padding:0;margin:12vh auto 0;width:min(620px,calc(100vw - 28px));max-height:78vh;border:1px solid var(--line);border-radius:20px;background:var(--surface);color:var(--text);box-shadow:0 24px 100px #0005;overflow:hidden}
      dialog::backdrop{background:#10182788;backdrop-filter:blur(5px)}
      header{display:flex;gap:12px;align-items:center;padding:20px 22px 12px}.brand{font-size:11px;font-weight:750;letter-spacing:2px;color:var(--muted)}.spacer{flex:1}
      .theme,.close,.semester-button,.shortcut-button{border:1px solid var(--line);border-radius:8px;color:var(--muted);background:transparent;padding:5px 8px;font-size:12px}
      [hidden]{display:none!important}.semester-settings{padding:8px 22px 24px}.semester-settings h2{font-size:20px;margin:8px 0}.semester-settings p{color:var(--muted);font-size:13px}.semester-settings label{display:block;margin:18px 0 8px;font-size:12px;font-weight:600}.semester-actions{display:flex;gap:10px;margin-top:20px}.semester-actions button{padding:9px 13px;border:1px solid var(--line);border-radius:8px;background:var(--hover);color:var(--text)}.semester-actions button:disabled{opacity:.5;cursor:default}.semester-button{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .shortcut-settings{padding:8px 22px 24px}.shortcut-settings h2{font-size:20px;margin:8px 0}.shortcut-settings p{color:var(--muted);font-size:13px}.shortcut-current{display:inline-block;margin:4px 0 10px;padding:4px 9px;border:1px solid var(--line);border-radius:6px;font-weight:600}.shortcut-actions{display:flex;gap:10px;margin-top:16px}.shortcut-actions button{padding:9px 13px;border:1px solid var(--line);border-radius:8px;background:var(--hover);color:var(--text)}
      .search{display:flex;align-items:center;gap:14px;margin:0 22px 16px}.search span{font-size:24px;color:var(--accent)}input{width:100%;padding:7px 0;border:0;outline:none;background:transparent;color:var(--text);font-size:21px;letter-spacing:-.5px}input::placeholder{color:var(--muted)}
      .meta{display:flex;justify-content:space-between;padding:10px 22px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);letter-spacing:.5px}
      .results{padding:0 10px 10px;max-height:46vh;overflow-y:auto;overscroll-behavior:contain}.option{display:flex;align-items:center;gap:13px;border-radius:10px;padding:12px;cursor:pointer;scroll-margin:8px}.option[aria-selected=true]{background:var(--hover)}.icon{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:9px;color:var(--muted);flex-shrink:0}.label{font-size:14px;font-weight:550}.category{font-size:11px;color:var(--muted);margin-top:2px}.arrow{margin-left:auto;color:var(--accent);opacity:0}.option[aria-selected=true] .arrow{opacity:1}.empty{padding:30px 14px;text-align:center;color:var(--muted)}
      footer{display:flex;gap:14px;padding:13px 22px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.local{margin-left:auto}
      ${combobox.css}
      @media(max-width:480px){.dock{right:12px;bottom:12px}.dock .semester-chip{max-width:96px}.local{display:none}dialog{margin-top:7vh}header{padding-top:16px}input{font-size:18px}}
      @media(prefers-reduced-motion:no-preference){dialog[open]{animation:arrive .13s ease-out}@keyframes arrive{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}}
    </style>
    <div class="dock"><button class="launcher" type="button" aria-label="Open VTOP command menu" title="Jump to a VTOP page">${logo}<kbd class="shortcut"></kbd></button><span class="sep" aria-hidden="true"></span><button class="semester-chip" type="button" aria-label="Change default semester">Set semester</button></div>
    <dialog aria-label="VTOP command menu">
      <header><span class="brand">${logo}VTOP / COMMAND</span><span class="spacer"></span><button class="shortcut-button" type="button">Shortcut</button><button class="semester-button" type="button" aria-label="Choose default semester">Semester</button><button class="theme" type="button"></button><button class="close" type="button" aria-label="Close command menu">Esc</button></header>
      <section class="semester-settings" hidden aria-labelledby="semester-title">
        <h2 id="semester-title">Choose your default semester</h2>
        <p class="semester-help">We'll select this semester whenever a VTOP page asks for one. You can still change it on any page.</p>
        <label for="default-semester-trigger">Default semester</label><select id="default-semester"></select>
        <p class="semester-status" role="status"></p>
        <div class="semester-actions"><button class="save-semester" type="button">Save default</button><button class="open-timetable" type="button" hidden>Open Time Table</button><button class="clear-semester" type="button">Turn off</button><button class="skip-semester" type="button">Back</button></div>
      </section>
      <section class="shortcut-settings" hidden aria-labelledby="shortcut-title">
        <h2 id="shortcut-title">Change your keyboard shortcut</h2>
        <p>Current shortcut</p><kbd class="shortcut-current"></kbd>
        <p class="shortcut-status" role="status">Use Ctrl or Command plus an unused letter or F1–F12 key. Shift and Alt are optional.</p>
        <div class="shortcut-actions"><button class="record-shortcut" type="button">Record shortcut</button><button class="save-shortcut" type="button" disabled>Save</button><button class="reset-shortcut" type="button">Reset</button><button class="back-shortcut" type="button">Back</button></div>
      </section>
      <div class="search"><span aria-hidden="true">⌕</span><input aria-label="Search VTOP pages" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="results" placeholder="Where do you want to go?" autocomplete="off" spellcheck="false"></div>
      <div class="meta"><span class="section">ALL PAGES</span><span class="count" role="status" aria-live="polite"></span></div>
      <div class="results" id="results" role="listbox" aria-label="VTOP pages"></div>
      <footer><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span class="local">On your device. In your flow.</span></footer>
    </dialog>`);
  document.documentElement.append(host);
  const dialog = shadow.querySelector('dialog');
  const input = shadow.querySelector('.search input');
  const list = shadow.querySelector('.results');
  let commands = [], filtered = [], selected = 0, usage = {}, usageRevision = 0, previousFocus, dark = false;
  let defaultSemester = null, preferencesReady = false, prompted = false, semesterView = false, shortcutView = false;
  let pendingShortcut = null, recordingShortcut = false;
  // The default semester is applied once per page visit. A visit starts on load or when a VTOP page is opened from
  // its menu (or this one); later re-renders of the same page, e.g. after you pick another semester, keep your choice.
  let pageVisit = 0, appliedSemesters = new Map(), staleSemesters = new WeakSet(), manualSemesterVisit = -1;
  const automaticSemesterValues = new WeakMap(), userSemesterIntent = new WeakSet();
  function noteSemesterIntent(event) {
    const select = event.target?.closest?.('select');
    if (!select || !semesters.discover(document).includes(select)) return;
    userSemesterIntent.add(select);
    setTimeout(() => userSemesterIntent.delete(select), 1500);
  }
  document.addEventListener('pointerdown', noteSemesterIntent, true);
  document.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(event.key)) noteSemesterIntent(event);
  }, true);
  document.addEventListener('change', event => {
    const select = event.target;
    if (!semesters.discover(document).includes(select)) return;
    if (automaticSemesterValues.get(select) === select.value) {
      automaticSemesterValues.delete(select);
      return;
    }
    if (event.isTrusted || userSemesterIntent.has(select)) manualSemesterVisit = pageVisit;
  }, true);
  const semesterSlot = select => select.id || select.name || 'semester';
  const pageLinks = 'a.systemB5BtnMenu[data-url],a.systemBtnMenu[data-url],a.quickB5MainMenu[data-url],a[onclick*="home()"]';
  // The CGPA calculator picks its own semester on the Time Table visit it opens; the default stays out of it.
  let claimedVisitUntil = 0;
  host.addEventListener('vtop-cgpa-claim-semester', () => { claimedVisitUntil = Date.now() + 15000; });
  function newPageVisit() {
    pageVisit++;
    if (Date.now() < claimedVisitUntil) { manualSemesterVisit = pageVisit; claimedVisitUntil = 0; }
    // Dropdowns of the page being left must not be set while the next page loads.
    for (const select of semesters.discover(document)) staleSemesters.add(select);
    document.dispatchEvent(new CustomEvent('vtop-page-visit'));
  }
  let knownSemesters = new Map(), semestersUpdated = 0, semesterFetch = null, semesterFetchFailed = false;
  const semesterPicker = shadow.querySelector('#default-semester');
  const semesterCombobox = combobox.create(semesterPicker, { label: 'Default semester', id: 'default-semester-trigger' });
  let semesterChoices = [];
  const SEMESTER_CACHE_AGE = 24 * 60 * 60 * 1000;
  // Remember every semester VTOP has offered so the picker works on pages without a dropdown.
  function rememberSemesters(choices, { fresh = false, persist = true } = {}) {
    const merged = new Map();
    // A complete list from VTOP keeps VTOP's newest-first order; older remembered terms follow.
    for (const source of fresh ? [choices, knownSemesters.values()] : [knownSemesters.values(), choices])
      for (const choice of source) if (choice?.value && choice?.label && !merged.has(semesters.key(choice.label)))
        merged.set(semesters.key(choice.label), { value: String(choice.value), label: String(choice.label) });
    const list = [...merged.values()].slice(0, 30);
    const changed = JSON.stringify(list) !== JSON.stringify([...knownSemesters.values()]);
    knownSemesters = new Map(list.map(choice => [semesters.key(choice.label), choice]));
    const stale = Date.now() - semestersUpdated > SEMESTER_CACHE_AGE / 24;
    if (fresh) semestersUpdated = Date.now();
    // Page scans run on every DOM change; only write when the list changed or the timestamp is an hour old.
    if (persist && (changed || (fresh && stale))) {
      try { chrome.storage.local.set({ knownSemesters: { list, updated: semestersUpdated } })?.catch(() => {}); } catch { /* Extension reloaded. */ }
    }
    return changed;
  }
  function semesterRoute() {
    const pages = discover(document);
    return (pages.find(page => /time ?table/i.test(page.label)) || pages.find(page => /^class attendance$/i.test(page.label)))?.id || 'academics/common/StudentTimeTable';
  }
  // Load the semester list the same way VTOP's menu loads Time Table: a read-only POST of the page fragment.
  function fetchSemesters() {
    if (semesterFetch) return semesterFetch;
    semesterFetch = (async () => {
      const csrf = document.querySelector('input[name="_csrf"]')?.value || document.querySelector('meta[name="_csrf"]')?.content;
      const id = document.querySelector('#authorizedIDX')?.value;
      if (!csrf || !id) throw new Error('Not signed in');
      for (let wait = 0; wait < 50 && document.documentElement.getAttribute('data-vtop-page-busy') === 'true'; wait++) await new Promise(resolve => setTimeout(resolve, 100));
      const url = new URL(semesterRoute(), document.baseURI);
      if (url.origin !== location.origin || !url.pathname.startsWith('/vtop/')) throw new Error('Unexpected route');
      const response = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ verifyMenu: 'true', authorizedID: id, _csrf: csrf, nocache: String(Date.now()) }) });
      const html = response.ok ? await response.text() : '';
      const choices = html.includes('___INTERNAL___RESPONSE___') ? [] : semesters.fromHTML(html);
      if (!choices.length) throw new Error('No semesters found');
      rememberSemesters(choices, { fresh: true });
    })().catch(() => { semesterFetchFailed = true; }).finally(() => { if (semesterView && dialog.open) renderSemesterPicker(); });
    return semesterFetch;
  }
  function setSemesterPreference(value) {
    defaultSemester = value?.value && value?.label ? { value: String(value.value), label: String(value.label) } : null;
    shadow.querySelector('.semester-button').textContent = defaultSemester?.label || 'Semester';
    shadow.querySelector('.semester-button').title = defaultSemester ? `Default: ${defaultSemester.label}` : 'Choose default semester';
    shadow.querySelector('.semester-chip').textContent = defaultSemester?.label.replace(/\s+Semester/i, '') || 'Set semester';
    shadow.querySelector('.semester-chip').title = defaultSemester ? `Default semester: ${defaultSemester.label}. Click to change.` : 'Choose default semester';
  }
  function saveSemesterPreference(value) {
    setSemesterPreference(value);
    // Saving here applies the new default to this page right away; other tabs pick it up on their next page.
    appliedSemesters = new Map();
    manualSemesterVisit = -1;
    document.dispatchEvent(new CustomEvent('vtop-default-semester-saved', { detail: defaultSemester }));
    try { chrome.storage.local.set({ defaultSemester })?.catch(() => {}); } catch { /* Extension reloaded. */ }
    scanSemesters();
  }
  function showSemesterSettings() {
    discardShortcutChange();
    open(); host.dispatchEvent(new CustomEvent('vtop-cgpa-hide')); semesterView = true;
    for (const selector of ['.search', '.meta', '.results', 'footer']) shadow.querySelector(selector).hidden = true;
    shadow.querySelectorAll('p.empty').forEach(p => p.remove());
    shadow.querySelector('.semester-settings').hidden = false;
    const available = semesters.discover(document).flatMap(semesters.options);
    if (available.length) rememberSemesters(available, { fresh: true });
    if (!semesterFetch && (!knownSemesters.size || Date.now() - semestersUpdated > SEMESTER_CACHE_AGE)) fetchSemesters();
    renderSemesterPicker();
    semesterCombobox.trigger.focus();
  }
  function renderSemesterPicker() {
    const picked = semesterChoices[Number(semesterPicker.value)];
    const selectedKey = semesterPicker.value !== '' && picked ? semesters.key(picked.label) : defaultSemester && semesters.key(defaultSemester.label);
    semesterChoices = [...knownSemesters.values()];
    semesterPicker.replaceChildren(new Option(semesterChoices.length ? 'Choose a semester…' : 'Loading semesters…', ''));
    semesterChoices.forEach((choice, index) => semesterPicker.add(new Option(choice.label, String(index))));
    const current = semesterChoices.findIndex(choice => semesters.key(choice.label) === selectedKey);
    semesterPicker.value = current < 0 ? '' : String(current);
    semesterPicker.disabled = !semesterChoices.length;
    const loading = !semesterChoices.length && semesterFetch && !semesterFetchFailed;
    if (!semesterChoices.length && !loading) semesterPicker.options[0].textContent = 'No semesters found';
    shadow.querySelector('.save-semester').disabled = semesterPicker.value === '';
    shadow.querySelector('.clear-semester').hidden = !defaultSemester;
    shadow.querySelector('.open-timetable').hidden = !!semesterChoices.length || loading;
    shadow.querySelector('.semester-status').textContent = semesterChoices.length ?
      'Applied on matching pages. If unavailable, the page stays unchanged.' : loading ? 'Loading semesters from VTOP…' :
      "Couldn't load semesters automatically. Open Time Table, Attendance, or another page with a semester dropdown, then choose your default here.";
    semesterCombobox.sync();
  }
  function showPages() {
    discardShortcutChange();
    host.dispatchEvent(new CustomEvent('vtop-cgpa-hide'));
    semesterView = false; shortcutView = false;
    shadow.querySelector('.semester-settings').hidden = true;
    shadow.querySelector('.shortcut-settings').hidden = true;
    for (const selector of ['.search', '.meta', '.results', 'footer']) shadow.querySelector(selector).hidden = false;
  }
  function scanSemesters() {
    if (!preferencesReady) return;
    const selectors = semesters.discover(document);
    let pageHasSemesters = false;
    for (const select of selectors) {
      const choices = semesters.options(select);
      if (choices.length) rememberSemesters(choices, { fresh: true });
      if (!choices.length || semesters.transactional(select)) continue;
      pageHasSemesters = true;
      if (!defaultSemester || staleSemesters.has(select) || manualSemesterVisit === pageVisit || globalThis.VtopFormPresets?.owns(select)) continue;
      if (appliedSemesters.get(semesterSlot(select)) === pageVisit) continue;
      const choice = semesters.match(select, defaultSemester);
      if (!choice) continue;
      // Record before dispatch: VTOP's handler may synchronously replace the dropdown.
      appliedSemesters.set(semesterSlot(select), pageVisit);
      if (select.value === choice.value) continue;
      automaticSemesterValues.set(select, choice.value);
      if (globalThis.VtopPageActions) globalThis.VtopPageActions.change(select, choice.value);
      else { select.value = choice.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    if (!defaultSemester && !prompted && pageHasSemesters && !dialog.open) {
      prompted = true; showSemesterSettings();
    }
  }
  function updateShortcutDisplay() {
    const display = shadow.querySelector('.shortcut');
    const modifier = shortcut.mac ? '⌘' : 'Ctrl';
    const modifierNode = document.createElement('span');
    modifierNode.textContent = modifier;
    if (shortcut.mac) modifierNode.className = 'symbol';
    display.replaceChildren(modifierNode, document.createTextNode(shortcut.label.slice(modifier.length)));
    shadow.querySelector('.shortcut-current').textContent = shortcut.label;
  }
  updateShortcutDisplay();
  function stopRecording() {
    recordingShortcut = false;
    document.removeEventListener('keydown', recordShortcutKey, true);
  }
  function discardShortcutChange() {
    stopRecording();
    pendingShortcut = null;
    shadow.querySelector('.save-shortcut').disabled = true;
    shadow.querySelector('.record-shortcut').textContent = 'Record shortcut';
    updateShortcutDisplay();
  }
  function showShortcutSettings() {
    discardShortcutChange();
    open(); host.dispatchEvent(new CustomEvent('vtop-cgpa-hide'));
    semesterView = false; shortcutView = true;
    for (const selector of ['.search', '.meta', '.results', 'footer', '.semester-settings']) shadow.querySelector(selector).hidden = true;
    shadow.querySelector('.shortcut-settings').hidden = false;
    shadow.querySelector('.shortcut-status').textContent = 'Use Ctrl or Command plus an unused letter or F1–F12 key. Shift and Alt are optional.';
    shadow.querySelector('.record-shortcut').focus();
  }
  function recordShortcutKey(event) {
    if (!recordingShortcut || event.isComposing || ['Shift', 'Alt', 'Control', 'Meta'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape') {
      discardShortcutChange();
      shadow.querySelector('.shortcut-status').textContent = 'Shortcut recording cancelled.';
      return;
    }
    const primaryHeld = shortcut.mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    const key = event.key.toLowerCase();
    const reservedKey = /^(?:[0-9]|[acflprsvxz])$/.test(key);
    if (!primaryHeld || reservedKey || !/^(?:[a-z0-9]|f(?:[1-9]|1[0-2]))$/i.test(key) ||
        !/^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/.test(event.code)) {
      shadow.querySelector('.shortcut-status').textContent = `That key combination is reserved. Choose ${shortcut.mac ? 'Command' : 'Ctrl'} plus another letter or an F1–F12 key.`;
      return;
    }
    pendingShortcut = { key, code: event.code, shiftKey: event.shiftKey, altKey: event.altKey };
    stopRecording();
    shadow.querySelector('.shortcut-current').textContent = [shortcut.mac ? '⌘' : 'Ctrl', ...(event.shiftKey ? ['Shift'] : []), ...(event.altKey ? ['Alt'] : []), key.toUpperCase()].join(' ');
    shadow.querySelector('.save-shortcut').disabled = false;
    shadow.querySelector('.record-shortcut').textContent = 'Record again';
    shadow.querySelector('.shortcut-status').textContent = 'Save to use this shortcut. Some combinations are reserved by your browser or operating system.';
  }
  shadow.querySelector('.record-shortcut').addEventListener('click', () => {
    discardShortcutChange(); recordingShortcut = true;
    shadow.querySelector('.record-shortcut').textContent = 'Press shortcut…';
    shadow.querySelector('.shortcut-status').textContent = `Now press ${shortcut.mac ? 'Command' : 'Ctrl'} plus an unused letter or F1–F12 key. Escape cancels.`;
    document.addEventListener('keydown', recordShortcutKey, true);
  });
  shadow.querySelector('.save-shortcut').addEventListener('click', async () => {
    if (!pendingShortcut) return;
    const status = shadow.querySelector('.shortcut-status');
    try {
      await chrome.storage.local.set({ commandShortcut: pendingShortcut });
      if (!shortcut.set(pendingShortcut)) throw new Error('Invalid shortcut preference.');
      pendingShortcut = null; updateShortcutDisplay(); showPages(); render(); input.focus();
    } catch (error) {
      status.textContent = `Could not save the shortcut: ${error.message}`;
    }
  });
  shadow.querySelector('.reset-shortcut').addEventListener('click', async () => {
    try {
      discardShortcutChange();
      await chrome.storage.local.remove('commandShortcut');
      shortcut.reset();
      updateShortcutDisplay(); showPages(); render(); input.focus();
    } catch (error) {
      shadow.querySelector('.shortcut-status').textContent = `Could not reset the shortcut: ${error.message}`;
    }
  });
  shadow.querySelector('.back-shortcut').addEventListener('click', () => { discardShortcutChange(); showPages(); render(); input.focus(); });

  function setTheme(value) {
    dark = value;
    document.documentElement.toggleAttribute('data-vtop-command-dark', dark);
    host.toggleAttribute('data-dark', dark);
    shadow.querySelector('.theme').textContent = dark ? '☀ Light mode' : '☾ Dark mode';
    shadow.querySelector('.theme').setAttribute('aria-pressed', String(dark));
  }
  function toggleTheme() {
    setTheme(!dark);
    try { chrome.storage.local.set({ darkMode: dark })?.catch(() => {}); } catch { /* Extension reloaded. */ }
  }
  function rememberCommand(id) {
    usage = recordUsage(usage, id);
    const revision = ++usageRevision;
    try {
      chrome.runtime.sendMessage({ type: 'vtop-command-used', id }).then(result => {
        if (result?.history && revision === usageRevision) usage = sanitizeUsage(result.history);
      }).catch(() => {}); // A reloaded/unavailable extension still has in-tab ranking.
    } catch { /* Preview without the extension runtime. */ }
  }
  // A late startup read must not replace a newer selection or another tab's update.
  try {
    const revision = usageRevision;
    chrome.storage.local.get(USAGE_KEY).then(settings => {
      if (revision !== usageRevision) return;
      usage = sanitizeUsage(settings[USAGE_KEY]);
      if (dialog.open && !semesterView && selected === 0) render();
    }).catch(() => {});
  } catch { /* Ranking works in memory if storage is unavailable. */ }
  setTheme(false);
  try {
    // Filter memory was removed; drop what it had saved.
    chrome.storage.local.remove?.(['pageFilters', 'rememberFilters'])?.catch?.(() => {});
    chrome.storage.local.get(['darkMode', 'defaultSemester', 'knownSemesters', 'commandShortcut']).then(settings => {
      setTheme(settings.darkMode === true); setSemesterPreference(settings.defaultSemester);
      if (settings.commandShortcut && shortcut.set(settings.commandShortcut)) updateShortcutDisplay();
      if (Array.isArray(settings.knownSemesters?.list)) {
        rememberSemesters(settings.knownSemesters.list, { persist: false });
        semestersUpdated = Number(settings.knownSemesters.updated) || 0;
      }
      if (settings.defaultSemester === null) prompted = true;
      preferencesReady = true; scanSemesters();
    }).catch(() => { preferencesReady = true; scanSemesters(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[USAGE_KEY]) {
        usage = sanitizeUsage(changes[USAGE_KEY].newValue); usageRevision++;
        // Apply on the next render, without moving a row underneath the pointer.
      }
      if (area === 'local' && changes.darkMode) setTheme(changes.darkMode.newValue === true);
      if (area === 'local' && Array.isArray(changes.knownSemesters?.newValue?.list)) {
        rememberSemesters(changes.knownSemesters.newValue.list, { persist: false });
        semestersUpdated = Math.max(semestersUpdated, Number(changes.knownSemesters.newValue.updated) || 0);
        if (semesterView && dialog.open) renderSemesterPicker();
      }
      if (area === 'local' && changes.defaultSemester) setSemesterPreference(changes.defaultSemester.newValue);
      if (area === 'local' && changes.commandShortcut) {
        if (shortcut.set(changes.commandShortcut.newValue)) updateShortcutDisplay();
        else { shortcut.reset(); updateShortcutDisplay(); }
      }
    });
  } catch { preferencesReady = true; setTimeout(scanSemesters, 0); }

  // VTOP's header house icon: <a onclick="javascript:home();">.
  const homeLink = () => document.querySelector('a[onclick*="home()"]');
  function goHome() {
    close();
    if (globalThis.VtopPageActions) globalThis.VtopPageActions.navigate(homeLink); else homeLink()?.click();
  }
  function allCommands() {
    const home = homeLink() ? [{ id: 'vtop:home', label: 'Home', category: 'VTOP', keywords: 'dashboard main start landing', navigate: true, action: goHome }] : [];
    return [...home, ...commands,
      { id: 'vtop:cgpa', label: 'CGPA calculator', category: 'Study tools', keywords: 'grades gpa credits predict semester', action: () => {
        semesterView = true;
        for (const selector of ['.search', '.meta', '.results', 'footer', '.semester-settings', '.shortcut-settings']) shadow.querySelector(selector).hidden = true;
        shadow.querySelectorAll('p.empty').forEach(p => p.remove());
        host.dispatchEvent(new CustomEvent('vtop-cgpa-open'));
      } },
      { id: 'vtop:semester', label: 'Choose default semester', category: defaultSemester?.label || 'Preferences', keywords: 'semester term default automatic', action: showSemesterSettings },
      { id: 'vtop:shortcut', label: 'Change keyboard shortcut', category: 'Preferences', keywords: 'hotkey keybinding command', action: showShortcutSettings },
      { id: 'vtop:theme', label: 'Toggle dark mode', category: 'Appearance', keywords: 'light theme night', action: toggleTheme }];
  }
  function updateSelection(scroll = true) {
    [...list.children].forEach((row, index) => row.setAttribute('aria-selected', String(index === selected)));
    const row = list.children[selected];
    if (row?.getAttribute('role') === 'option') {
      input.setAttribute('aria-activedescendant', row.id);
      if (scroll) row.scrollIntoView?.({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function render() {
    filtered = search(allCommands(), input.value, usage);
    selected = 0;
    list.replaceChildren();
    shadow.querySelector('.section').textContent = input.value.trim() ? 'SEARCH RESULTS' : Object.keys(usage).length ? 'FREQUENT & RECENT' : 'ALL PAGES';
    shadow.querySelector('.count').textContent = `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`;
    if (!commands.length && !input.value) {
      const message = document.createElement('p'); message.className = 'empty';
      message.textContent = 'Sign in to VTOP to search its pages. Appearance is available below.';
      list.before(message); shadow.querySelectorAll('.meta ~ p.empty').forEach((p, i) => { if (i) p.remove(); });
    } else shadow.querySelectorAll('p.empty').forEach(p => p.remove());
    if (!filtered.length) {
      const empty = document.createElement('div'); empty.className = 'empty';
      empty.textContent = 'No pages found. Try a page name or category.'; list.append(empty);
    }
    filtered.forEach((command, index) => {
      const row = document.createElement('div'); row.className = 'option'; row.id = `vtop-option-${index}`;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(index === selected));
      const icon = document.createElement('span'); icon.className = 'icon'; icon.textContent = command.action && !command.navigate ? '◐' : '↗'; icon.setAttribute('aria-hidden', 'true');
      const text = document.createElement('div');
      const label = document.createElement('div'); label.className = 'label'; label.textContent = command.label;
      const category = document.createElement('div'); category.className = 'category'; category.textContent = command.category;
      const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '↵'; arrow.setAttribute('aria-hidden', 'true');
      text.append(label, category); row.append(icon, text, arrow);
      row.addEventListener('pointermove', () => { selected = index; updateSelection(false); });
      row.addEventListener('mousedown', event => event.preventDefault());
      row.addEventListener('click', () => activate(index)); list.append(row);
    });
    list.scrollTop = 0; updateSelection();
  }
  function open() {
    if (dialog.open) return;
    previousFocus = shadow.activeElement || document.activeElement;
    showPages(); commands = discover(document); input.value = ''; render();
    dialog.showModal(); input.setAttribute('aria-expanded', 'true'); input.focus();
  }
  function close() { if (dialog.open) dialog.close(); }
  host.addEventListener('vtop-cgpa-back', () => { showPages(); render(); input.focus(); });
  function activate(index) {
    const command = filtered[index]; if (!command) return;
    if (command.action) { rememberCommand(command.id); command.action(); return; }
    // Re-resolve after AJAX replacements. Never replay a stale route or submit a page form.
    const current = discover(document).find(item => item.id === command.id);
    if (!current) { commands = discover(document); render(); return; }
    rememberCommand(command.id);
    close();
    if (globalThis.VtopPageActions) globalThis.VtopPageActions.navigate(() => discover(document).find(item => item.id === command.id)?.element);
    else current.element.click();
  }
  try {
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (message?.type !== 'vtop-toggle-command-menu') return;
      const pdf = document.getElementById('vtop-pdf-preview')?.shadowRoot?.querySelector('dialog'); if (pdf?.open) pdf.close();
      dialog.open ? close() : open(); respond({ opened: dialog.open });
    });
  } catch { /* Preview without the extension runtime. */ }
  shadow.querySelector('.launcher').addEventListener('click', open);
  host.addEventListener('vtop-command-done', close);
  shadow.querySelector('.semester-chip').addEventListener('click', showSemesterSettings);
  shadow.querySelector('.shortcut-button').addEventListener('click', showShortcutSettings);
  host.addEventListener('vtop-choose-semester', showSemesterSettings);
  shadow.querySelector('.close').addEventListener('click', close);
  shadow.querySelector('.theme').addEventListener('click', toggleTheme);
  shadow.querySelector('.semester-button').addEventListener('click', showSemesterSettings);
  semesterPicker.addEventListener('change', () => { shadow.querySelector('.save-semester').disabled = semesterPicker.value === ''; });
  shadow.querySelector('.save-semester').addEventListener('click', () => {
    const choice = semesterChoices[Number(semesterPicker.value)];
    if (semesterPicker.value === '' || !choice) return;
    prompted = true; saveSemesterPreference(choice); close();
  });
  shadow.querySelector('.open-timetable').addEventListener('click', () => {
    const route = semesterRoute(); close();
    const element = () => discover(document).find(item => item.id === route)?.element;
    if (globalThis.VtopPageActions) globalThis.VtopPageActions.navigate(element); else element()?.click();
  });
  shadow.querySelector('.clear-semester').addEventListener('click', () => { prompted = true; saveSemesterPreference(null); close(); });
  shadow.querySelector('.skip-semester').addEventListener('click', () => { prompted = true; showPages(); render(); input.focus(); });
  dialog.addEventListener('close', () => { discardShortcutChange(); host.dispatchEvent(new CustomEvent('vtop-cgpa-hide')); input.setAttribute('aria-expanded', 'false'); if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } });
  input.addEventListener('input', render);
  dialog.addEventListener('keydown', event => {
    if (event.isComposing || semesterView || shortcutView || event.target !== input) return;
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Enter') activate(selected);
      else if (filtered.length) { selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length; updateSelection(); }
    }
  });
  document.addEventListener('keydown', event => {
    if (recordingShortcut) return;
    if (shortcut.matches(event) && !event.isComposing && !event.repeat) {
      event.preventDefault(); event.stopImmediatePropagation(); dialog.open ? close() : open();
    }
  }, true);
  // VTOP's mega-menus are Bootstrap collapses that stay open until their toggle is clicked again.
  // Close them on Escape or a click elsewhere, through the page's own toggle so Bootstrap keeps its state.
  function closeVtopMenus() {
    for (const box of document.querySelectorAll('.hmenubox.collapse.show')) {
      const toggles = [...document.querySelectorAll('[data-bs-toggle="collapse"][aria-controls]')].filter(toggle => toggle.getAttribute('aria-controls') === box.id);
      (toggles.find(toggle => toggle.matches('.hmenuItem')) || toggles[0])?.click();
    }
  }
  document.addEventListener('click', event => { if (event.target?.closest?.(pageLinks)) newPageVisit(); }, true);
  document.addEventListener('click', event => {
    const target = event.target;
    if (!target?.closest || target.closest('.hmenubox, [data-bs-toggle="collapse"]')) return;
    if (document.querySelector('.hmenubox.collapse.show')) closeVtopMenus();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.isComposing && !dialog.open && document.querySelector('.hmenubox.collapse.show')) closeVtopMenus();
  });
  // VTOP swaps page fragments in place. Keep discovery current while the menu is open.
  let pending;
  new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      scanSemesters();
      if (dialog.open && !semesterView && !shortcutView) { commands = discover(document); render(); }
    }, 100);
    if (!host.isConnected) document.documentElement.append(host);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-url', 'data-status', 'aria-disabled', 'disabled', 'value', 'id', 'name'] });
})();
