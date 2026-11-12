// Repair legacy inline/inherited text colors after VTOP replaces a page or opens a detail view.
(function (root: typeof globalThis) {
  'use strict';
  const palette = {
    text: [237,242,252], ink: [16,21,31], white: [255,255,255], black: [0,0,0], red: [255,180,193],
    green: [152,230,181], blue: [174,203,255], amber: [255,224,162], purple: [223,186,255]
  };
  const parse = (value: string | null | undefined): number[] | null => {
    const match = /^rgba?\(([^)]+)\)$/.exec(value || '');
    if (!match) return null;
    const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return parts.length >= 3 && parts.every(Number.isFinite) ? [...parts.slice(0,3), parts[3] ?? 1] : null;
  };
  const blend = (front: number[], back: number[]) => front.slice(0,3).map((v,i) => v * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
  const luminance = (color: number[]) => color.slice(0,3).map(v => {
    v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  }).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i], 0);
  const contrast = (a: number[], b: number[]) => (Math.max(luminance(a),luminance(b)) + .05) / (Math.min(luminance(a),luminance(b)) + .05);
  function replacement(foreground: number[], background: number[]) {
    if (contrast(blend(foreground,background),background) >= 4.5) return null;
    const [r,g,b] = foreground, spread = Math.max(r,g,b) - Math.min(r,g,b);
    let hue: keyof typeof palette = 'text';
    if (spread > 35) {
      hue = r > g * 1.2 && r > b * 1.1 ? 'red' : g > r * 1.15 && g > b * 1.05 ? 'green' :
        b > r * 1.15 && b > g * 1.05 ? 'blue' : r > b * 1.2 && g > b * 1.2 ? 'amber' : 'purple';
    }
    if (contrast(palette[hue],background) >= 4.5) return hue;
    if (contrast(palette.text,background) >= 4.5) return 'text';
    if (contrast(palette.ink,background) >= 4.5) return 'ink';
    return contrast(palette.white,background) >= contrast(palette.black,background) ? 'white' : 'black';
  }
  const lightSurface = (color: number[] | null) => color && color[3] >= .99 && luminance(color) > .5 && Math.max(...color.slice(0,3)) - Math.min(...color.slice(0,3)) < 30;
  const api = { parse, blend, luminance, contrast, replacement, palette, lightSurface };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  const doc = root.document;
  if (!doc || doc.documentElement.hasAttribute('data-vtop-readability-ready')) return;
  doc.documentElement.setAttribute('data-vtop-readability-ready','');
  // A full scan runs on load and when dark mode turns on; after that, only the parts of the page that changed
  // are re-checked (with a full scan again if very many parts changed at once).
  let timer: ReturnType<typeof setTimeout> | undefined, full = true;
  const dirty = new Set<Element>();
  const scope = '#b5-pagewrapper,#page-holder,.modal.show,.dropdown-menu.show,.datepicker-dropdown';
  const marks = '[data-vtop-readable],[data-vtop-dark-surface]';
  const excluded = 'script,style,svg,canvas,iframe,video,picture,[hidden],[disabled],[aria-disabled="true"],.blockUI';
  const clear = (element: Element) => { element.removeAttribute('data-vtop-readable'); element.removeAttribute('data-vtop-dark-surface'); };
  function scan() {
    const html = doc.documentElement;
    // Light mode: drop any fixes and stop, without measuring or restyling the page.
    if (!html.hasAttribute('data-vtop-command-dark')) { doc.querySelectorAll(marks).forEach(clear); dirty.clear(); full = true; return; }
    let roots = full || dirty.size > 200 ? [...doc.querySelectorAll(scope)] : [...dirty].filter(element => element.isConnected && element.closest(scope));
    if (!(full || dirty.size > 200)) roots = roots.filter(element => !roots.some(other => other !== element && other.contains(element)));
    full = false; dirty.clear();
    const fixed = roots.flatMap(element => [...(element.matches(marks) ? [element] : []), ...element.querySelectorAll(marks)]);
    // Only the elements we change are held still while measuring. Removing a fix mid-transition would read a
    // half-faded colour as readable, drop the fix, fade back and flicker. Other animations keep running.
    for (const element of fixed) element.setAttribute('data-vtop-readability-hold','');
    try { measure(fixed, roots); }
    finally {
      // Apply the new colours while still held, so releasing the hold starts no transition.
      void html.offsetWidth;
      for (const element of fixed) element.removeAttribute('data-vtop-readability-hold');
    }
  }
  function measure(fixed: Element[], roots: Element[]) {
    // Attributes are our only changes: no native styles, form values or handlers are rewritten.
    fixed.forEach(clear);
    const backgrounds = new WeakMap<Element, number[] | null>();
    function background(element: Element | null): number[] | null | undefined {
      if (!element) return [16,21,31];
      if (backgrounds.has(element)) return backgrounds.get(element);
      const css = root.getComputedStyle(element), parent = background(element.parentElement);
      // Do not guess contrast over images, gradients or faded/disabled content.
      const color = parse(css.backgroundColor);
      const value = !parent || css.backgroundImage !== 'none' && css.backgroundImage !== '' || Number(css.opacity || 1) < .9 ? null :
        color ? blend(color,parent) : parent;
      backgrounds.set(element,value); return value;
    }
    const candidates = new Set<Element>();
    for (const container of roots) { candidates.add(container); container.querySelectorAll('*').forEach(e => candidates.add(e)); }
    // Some nested views have unnamed white/gray containers, outside the shared component classes.
    for (const element of candidates) {
      if (!element.matches('div,section,article,aside,header,footer,form,fieldset,legend,ul,ol') || element.closest(excluded) || !element.getClientRects().length) continue;
      const css = root.getComputedStyle(element);
      if (css.visibility === 'visible' && (!css.backgroundImage || css.backgroundImage === 'none') && lightSurface(parse(css.backgroundColor))) {
        element.setAttribute('data-vtop-dark-surface','');
      }
    }
    for (const element of candidates) {
      if (element.closest(excluded) || !element.getClientRects().length) continue;
      const text = [...element.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
      if (!text && !element.matches('input,textarea,select,button')) continue;
      const css = root.getComputedStyle(element);
      if (css.visibility !== 'visible') continue;
      const foreground = parse(css.color), back = background(element);
      if (!foreground || !back) continue;
      const name = replacement(foreground,back);
      if (name) element.setAttribute('data-vtop-readable',name);
    }
  }
  // Scans are costly on large pages, so they wait for a quiet moment and only follow changes that can matter.
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => root.requestIdleCallback ? root.requestIdleCallback(scan,{timeout:600}) : scan(), 150);
  }
  const watched = '#b5-pagewrapper,#page-holder,.modal,.dropdown-menu,.datepicker-dropdown';
  const within = (node: Node | null | undefined) => !!(node?.nodeType === 1 ? node as Element : node?.parentElement)?.closest(watched);
  const opensArea = (record: MutationRecord) => record.type === 'childList' && [...record.addedNodes].some(node => node.nodeType === 1 && ((node as Element).matches(watched) || (node as Element).querySelector(watched)));
  new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      if (record.attributeName === 'data-vtop-command-dark' || record.attributeName === 'data-vtop-command-theme' || opensArea(record)) { full = changed = true; continue; }
      if (!within(record.target)) continue;
      dirty.add((record.target.nodeType === 1 ? record.target : record.target.parentElement) as Element); changed = true;
    }
    if (changed) schedule();
  }).observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','color','hidden','disabled','aria-disabled','data-vtop-command-dark','data-vtop-command-theme']});
  schedule();
})(globalThis);
