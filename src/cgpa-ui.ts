(() => {
  'use strict';
  const host = document.getElementById('vtop-command-root');
  if (!host || !globalThis.VtopCgpa) return;
  const shadow = host.shadowRoot!, dialog = shadow.querySelector('dialog')!;
  const { points, courses, totals, official, previous, validatePredictions } = globalThis.VtopCgpa;
  const style = document.createElement('style');
  style.textContent = `
    dialog.cgpa-expanded{width:min(820px,calc(100vw - 28px))}
    .cgpa{padding:8px 22px 22px;max-height:62vh;overflow:auto;overscroll-behavior:contain}
    .cgpa h2{margin:10px 0 2px;font-size:23px;letter-spacing:-.6px}.cgpa p{color:var(--muted);font-size:12px;margin:6px 0 14px}
    .cgpa button{font:inherit;color:var(--text);background:var(--hover);border:1px solid var(--line);border-radius:8px;padding:7px 11px}
    .cgpa-toolbar{display:flex;gap:8px;align-items:center}.cgpa-toolbar strong{margin-left:auto;color:var(--muted);font-size:11px;font-weight:500}
    .cgpa-history{display:flex;gap:10px;overflow-x:auto;padding:8px 0 14px;scroll-snap-type:x proximity}
    .cgpa-bubble{flex:0 0 108px;min-height:108px;border:1px solid var(--line);border-radius:15px;background:var(--hover);padding:12px;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:space-between}
    .cgpa-bubble span{font-size:10px;color:var(--muted)}.cgpa-bubble b{font-size:25px;letter-spacing:-1px;color:var(--accent)}
    .cgpa-summary{display:flex;gap:22px;flex-wrap:wrap;padding:16px 0;border-block:1px solid var(--line);margin-bottom:8px}.cgpa-summary span{font-size:11px;color:var(--muted);display:block}.cgpa-summary b{font-size:24px;font-variant-numeric:tabular-nums}
    .cgpa-row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)}.cgpa-course{flex:1;min-width:0}.cgpa-course b{display:block;font-size:13px;font-weight:550}.cgpa-course small{color:var(--muted);font-size:11px}.cgpa-grade{display:flex;align-items:center;flex-shrink:0;border:1px solid var(--line);border-radius:10px;background:var(--hover);overflow:hidden}.cgpa-grade output{min-width:34px;text-align:center;font-size:16px;font-weight:650;color:var(--accent)}.cgpa-grade button{display:grid;place-items:center;width:32px;min-height:38px;padding:0;border:0;border-radius:0;background:transparent}.cgpa-grade button:hover:not(:disabled){background:var(--line)}.cgpa-grade button:disabled{opacity:.25;cursor:default}.cgpa-grade button:focus-visible{outline-offset:-3px}.cgpa-status{min-height:18px}
    @media(prefers-reduced-motion:no-preference){dialog{transition:width .24s ease}.cgpa{animation:arrive .2s ease-out}}
  `;
  shadow.append(style);
  const panel = document.createElement('section'); panel.className = 'cgpa'; panel.hidden = true;
  panel.setAttribute('aria-label', 'CGPA calculator');
  globalThis.VtopBrand.setMarkup(panel, `<div class="cgpa-toolbar"><button type="button" class="cgpa-back">← Back</button><button type="button" class="cgpa-reload">Reload data</button><strong>WHAT IF / CGPA</strong></div>
    <h2>Plan your next semester.</h2><p>Credit-weighted estimates. S = 10 · A = 9 · B = 8 · C = 7 · D = 6 · E = 5 · F = 0.</p>
    <div class="cgpa-history" aria-label="Previous semester GPAs" tabindex="0"></div>
    <div class="cgpa-summary" aria-live="polite"></div><p class="cgpa-status" role="status"></p><div class="cgpa-courses"></div>
    <p>Provisional: repeat courses and special grading rules are not adjusted yet. NGCR, unrecognized grades, and zero-credit courses are excluded. Grades you choose here never change VTOP.</p>`);
  dialog.append(panel);
  // A new load or a closed panel invalidates earlier asynchronous scrape results.
  let generation = 0, history: VtopCourse[] = [], current: VtopCourse[] = [], reference: VtopOfficialCgpa | null = null;
  let scenarios: Record<string, VtopPrediction[]> = Object.create(null), loadedTerm = 'current';
  // Keep predictions separate for different students sharing this browser profile.
  const registration = [...document.querySelectorAll('button')].map(node => node.textContent.trim().match(/^([A-Z0-9]{6,20})\s*\(STUDENT\)/i)).find(Boolean)?.[1];
  const storageKey = `cgpaScenarios:${registration || 'local'}`;
  const savedReady = (async () => {
    try { const saved = await chrome.storage.local.get(storageKey); if (saved?.[storageKey]) scenarios = validatePredictions(saved[storageKey]); }
    catch { /* A new profile starts with an empty scenario. */ }
  })();
  let saveQueue = Promise.resolve();
  // Serialize snapshots so rapid grade changes cannot overwrite a newer choice.
  function persist() {
    const snapshot = JSON.parse(JSON.stringify(scenarios));
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      try { await chrome.storage.local.set({ [storageKey]: snapshot }); }
      catch { /* Keep the active calculation usable if local storage is unavailable. */ }
    });
  }
  const courseKey = (course: Pick<VtopCourse, 'code' | 'type'>) => `${course.code}|${course.type || ''}`;
  // Restore grades only: VTOP remains the source for credits and NGCR categories.
  function restoreCurrent(data: VtopCourse[]) {
    const saved = scenarios[loadedTerm] || [];
    return data.map(course => {
      const prediction = saved.find(item => courseKey(item) === courseKey(course));
      return { ...course, grade: prediction?.grade || 'S' };
    });
  }
  function saveCurrent() {
    scenarios[loadedTerm] = current.map(c => ({ code: c.code, type: c.type || '', grade: c.grade }));
    persist();
  }
  const status = (text: string) => { panel.querySelector('.cgpa-status')!.textContent = text; };
  function summary() {
    const past = previous(history, reference), next = totals(current);
    const gpa = (total: VtopGradeTotals) => total.credits ? (total.points / total.credits).toFixed(2) : '—';
    const combined = { credits: past.credits + next.credits, points: past.points + next.points };
    const container = panel.querySelector('.cgpa-summary')!; container.replaceChildren();
    for (const [label, value] of [['Previous CGPA', gpa(past)], ['Selected-course GPA', gpa(next)], ['Projected CGPA', past.credits ? gpa(combined) : '—'], ['Selected credits', String(next.credits)]]) {
      const item = document.createElement('div'), caption = document.createElement('span'), number = document.createElement('b');
      caption.textContent = label; number.textContent = value; item.append(caption, number); container.append(item);
    }
  }
  function renderHistory() {
    const container = panel.querySelector('.cgpa-history')!; container.replaceChildren();
    const groups = new Map<string, VtopCourse[]>();
    for (const course of history) { if (!groups.has(course.semester)) groups.set(course.semester, []); groups.get(course.semester)!.push(course); }
    for (const [term, list] of groups) {
      const total = totals(list);
      // Terms with only P/NGCR results do not affect CGPA; a "—" tile would look like missing data.
      if (!total.credits) continue;
      const bubble = document.createElement('div'), caption = document.createElement('span'), value = document.createElement('b'), credits = document.createElement('span');
      bubble.className = 'cgpa-bubble'; caption.textContent = term; value.textContent = total.credits ? (total.points / total.credits).toFixed(2) : '—'; credits.textContent = `${total.credits} graded credits`; bubble.append(caption, value, credits); container.append(bubble);
    }
    if (!container.children.length) container.textContent = groups.size ? 'No graded semesters yet.' : 'No previous semester data loaded.';
    summary();
  }
  function renderCourses() {
    const container = panel.querySelector('.cgpa-courses')!; container.replaceChildren();
    for (const course of current) {
      const row = document.createElement('div'), description = document.createElement('div'), title = document.createElement('b'), meta = document.createElement('small');
      row.className = 'cgpa-row'; description.className = 'cgpa-course'; title.textContent = course.name;
      meta.textContent = `${course.code}${course.type ? ` · ${course.type}` : ''} · ${course.credits} credits`;
      description.append(title, meta); row.append(description);
      if (course.nonGraded) {
        const label = document.createElement('small'); label.textContent = 'Non-graded'; row.append(label);
      } else {
        const control = document.createElement('div'), value = document.createElement('output');
        control.className = 'cgpa-grade'; control.setAttribute('role', 'group'); control.setAttribute('aria-label', `Predicted grade for ${course.code} ${course.type || ''}`); value.setAttribute('aria-live', 'polite');
        const grades = Object.keys(points), buttons: HTMLButtonElement[] = [];
        function update() { value.textContent = course.grade; buttons[0].disabled = course.grade === grades.at(-1); buttons[1].disabled = course.grade === grades[0]; }
        // Grades are ordered best to worst: minus advances; plus goes back.
        for (const [direction, label, symbol] of [[1, 'Lower', '−'], [-1, 'Higher', '+']] as [number, string, string][]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol;
          button.setAttribute('aria-label', `${label} grade for ${course.code} ${course.type || ''}`);
          button.addEventListener('click', () => {
            const index = grades.indexOf(course.grade) + direction;
            if (index < 0 || index >= grades.length) return;
            course.grade = grades[index]; update(); summary(); saveCurrent();
          }); buttons.push(button);
        }
        update(); control.append(buttons[0], value, buttons[1]); row.append(control);
      }
      container.append(row);
    }
    summary();
  }
  // Use VTOP's own handlers: session tokens and routes stay owned by the page.
  async function loadPage(pattern: RegExp, token: number) {
    const command = globalThis.VtopNavigation.discover(document).find(item => pattern.test(item.label));
    if (!command) throw new Error('This VTOP menu entry is unavailable. Sign in and try again.');
    let settled = false, succeeded = false;
    Promise.resolve(globalThis.VtopPageActions.navigate(() => globalThis.VtopNavigation.discover(document).find(item => item.id === command.id)?.element))
      .then(result => { succeeded = result !== false; settled = true; }, () => { settled = true; });
    const started = Date.now();
    while (Date.now() - started < 35000) {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (token !== generation) throw new Error('cancelled');
      if (!settled || document.documentElement.getAttribute('data-vtop-page-busy') === 'true') continue;
      if (!succeeded) throw new Error('VTOP could not open this page. Reload data to try again.');
      // Time Table initially returns only a semester picker. Courses arrive after
      // its change handler runs, so waiting for a new table here deadlocks loading.
      if (pattern.test('Time Table') && globalThis.VtopSemesters.discover(document).length) return;
      if (courses(document, !pattern.test('Time Table')).length) return;
    }
    throw new Error('VTOP did not return a readable page. Reload data to try again.');
  }
  async function load() {
    const token = ++generation; await savedReady; if (token !== generation) return; history = []; current = []; reference = null; renderHistory(); renderCourses();
    panel.querySelector<HTMLButtonElement>('.cgpa-reload')!.disabled = true;
    let historyWarning = '';
    try {
      status('Loading Grade History…');
      try {
        await loadPage(/grade history/i, token);
        history = courses(document, true); reference = official(document); renderHistory();
        if (!history.length) historyWarning = 'Grade History could not be read; previous CGPA is unavailable. ';
      } catch (error) { if (token !== generation) return; historyWarning = `${(error as Error).message} Previous CGPA is unavailable. `; }
      status(`${historyWarning}Loading Time Table…`);
      // The calculator picks the semester itself; keep the default semester off this Time Table visit.
      // load() is a hoisted declaration, so the early return's narrowing of host does not reach it.
      host!.dispatchEvent(new CustomEvent('vtop-cgpa-claim-semester'));
      await loadPage(/time\s*table/i, token);
      const select = globalThis.VtopSemesters.discover(document)[0];
      if (select) {
        const choice = globalThis.VtopCgpa.currentTerm(globalThis.VtopSemesters.options(select));
        if (choice && select.value !== choice.value) {
          await globalThis.VtopPageActions.change(select, choice.value);
          if (token !== generation) return;
        }
        const selected = globalThis.VtopSemesters.discover(document)[0]?.selectedOptions[0];
        if (selected) historyWarning += `${selected.textContent.trim()}. `;
      }
      await readCurrent(token);
      status(`${historyWarning}${current.length ? `${current.length} courses · choose expected grades below.` : 'No courses could be read from this timetable. Check the semester on VTOP and reload data.'}`);
    } catch (error) { if (token === generation) status(`${historyWarning}${(error as Error).message}`); }
    finally { if (token === generation) panel.querySelector<HTMLButtonElement>('.cgpa-reload')!.disabled = false; }
  }
  async function readCurrent(token: number) {
    const started = Date.now();
    while (Date.now() - started < 15000) {
      if (token !== generation) throw new Error('cancelled');
      if (document.documentElement.getAttribute('data-vtop-page-busy') !== 'true') {
        const data = courses(document).filter(course => !course.grade);
        if (data.length) { loadedTerm = `term:${globalThis.VtopSemesters.key(globalThis.VtopSemesters.discover(document)[0]?.selectedOptions[0]?.textContent || 'current')}`; current = restoreCurrent(data); renderCourses(); return; }
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    current = []; renderCourses();
  }
  panel.querySelector('.cgpa-back')!.addEventListener('click', () => host.dispatchEvent(new CustomEvent('vtop-cgpa-back')));
  panel.querySelector('.cgpa-reload')!.addEventListener('click', load);
  host.addEventListener('vtop-cgpa-open', event => {
    panel.hidden = false; dialog.classList.add('cgpa-expanded');
    panel.querySelector<HTMLButtonElement>('.cgpa-back')!.focus(); load();

  });
  host.addEventListener('vtop-cgpa-hide', () => { ++generation; panel.hidden = true; dialog.classList.remove('cgpa-expanded'); });
})();
