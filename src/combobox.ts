// The searchable select for the extension's own panels, read as `VtopCombobox`.
interface VtopComboboxOptions {
  /** Accessible name; also used for the search field's label and placeholder. */
  label: string;
  /** Replaces the default "set the native select and fire input/change"; the value is an array for a multiple select. */
  onChoose?: (value: string | string[]) => unknown;
  /** Shown when nothing is chosen and the select has no first option. */
  placeholder?: string;
  /** id for the trigger button, so a <label for> can point at it. */
  id?: string;
}
interface VtopComboboxControl {
  /** The combobox root, inserted right after the (now hidden) native select. */
  element: HTMLDivElement;
  trigger: HTMLButtonElement;
  input: HTMLInputElement;
  /** Re-reads the native select; runs on its own after option, disabled or change updates. */
  sync(): void;
  open(seed?: string): void;
  close(refocus?: boolean): void;
}
interface VtopComboboxApi {
  create(select: HTMLSelectElement, options: VtopComboboxOptions): VtopComboboxControl;
  /** Styles for the combobox; include them in the shadow root or page that hosts it. */
  css: string;
}
declare var VtopCombobox: VtopComboboxApi;

// Searchable combobox for the extension's own panels. The hidden native select keeps the value and change events.
(() => {
  'use strict';
  let sequence = 0;
  const chevrons = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>';
  const magnifier = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  function create(select: HTMLSelectElement, { label, onChoose, placeholder = 'Choose…', id }: VtopComboboxOptions = {} as VtopComboboxOptions): VtopComboboxControl {
    const doc = select.ownerDocument, view = doc.defaultView as Window & typeof globalThis, list = `vtop-combobox-${++sequence}`;
    const root = doc.createElement('div'); root.className = 'cb';
    globalThis.VtopBrand.setMarkup(root, `<button type="button" class="cb-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${list}"><span class="cb-value"></span>${chevrons}</button>
      <div class="cb-popover" hidden><div class="cb-search-row">${magnifier}<input class="cb-search" type="search" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="${list}"></div>
      <div class="cb-list" role="listbox" id="${list}"></div><div class="cb-empty" role="status" aria-live="polite"></div></div>`);
    const trigger = root.querySelector<HTMLButtonElement>('.cb-trigger')!, value = root.querySelector<HTMLSpanElement>('.cb-value')!, popover = root.querySelector<HTMLDivElement>('.cb-popover')!;
    const input = root.querySelector<HTMLInputElement>('.cb-search')!, listbox = root.querySelector<HTMLDivElement>('.cb-list')!, empty = root.querySelector<HTMLDivElement>('.cb-empty')!;
    if (id) trigger.id = id;
    trigger.setAttribute('aria-label', label); input.setAttribute('aria-label', `Search ${label}`); input.placeholder = `Search ${label.toLowerCase()}…`;
    listbox.setAttribute('aria-label', `${label} choices`); if (select.multiple) listbox.setAttribute('aria-multiselectable', 'true');
    select.classList.add('cb-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true'); select.after(root);
    let options: HTMLOptionElement[] = [], active = -1, busy = false;
    const usable = (option: HTMLOptionElement) => !option.disabled && !(option.parentElement as HTMLOptGroupElement | null)?.disabled && !option.hidden;
    // A leading empty-value option ("Choose…", "Loading…") reads as the placeholder, not a choice.
    const prompt = (option: HTMLOptionElement) => option.value === '' && option === select.options[0];
    function sync() {
      const chosen = [...select.selectedOptions].filter(option => !prompt(option));
      value.textContent = chosen.map(option => option.textContent.trim()).join(', ') || select.options[0]?.textContent.trim() || placeholder;
      value.classList.toggle('cb-placeholder', !chosen.length);
      trigger.disabled = select.disabled; if (select.disabled) close();
      if (!popover.hidden) render();
    }
    function render() {
      const terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      options = [...select.options].filter(option => usable(option) && !prompt(option) && terms.every(term => option.textContent.toLocaleLowerCase().includes(term)));
      active = Math.min(Math.max(active, options.length ? 0 : -1), options.length - 1);
      listbox.replaceChildren(...options.map((option, index) => {
        const item = doc.createElement('div'); item.id = `${list}-${index}`; item.className = 'cb-item'; item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected)); globalThis.VtopBrand.setMarkup(item, check);
        const text = doc.createElement('span'); text.textContent = option.textContent.trim(); item.append(text);
        item.addEventListener('pointerdown', event => event.preventDefault());
        item.addEventListener('pointermove', () => { if (active !== index) { active = index; highlight(false); } });
        item.addEventListener('click', () => choose(index));
        return item;
      }));
      empty.textContent = options.length ? '' : 'No results found.';
      highlight(true);
    }
    function highlight(scroll: boolean) {
      [...listbox.children].forEach((item, index) => item.classList.toggle('active', index === active));
      const item = listbox.children[active];
      if (item) { input.setAttribute('aria-activedescendant', item.id); if (scroll) item.scrollIntoView?.({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    // Fixed positioning keeps the list clear of the dialog's scroll and overflow clipping.
    function place() {
      const box = trigger.getBoundingClientRect(), height = view.innerHeight, width = Math.max(box.width, 220);
      const below = height - box.bottom, above = box.top;
      popover.style.width = `${Math.min(width, view.innerWidth - 16)}px`;
      popover.style.left = `${Math.max(8, Math.min(box.left, view.innerWidth - width - 8))}px`;
      if (below < 240 && above > below) { popover.style.top = ''; popover.style.bottom = `${height - box.top + 6}px`; popover.style.maxHeight = `${Math.min(320, above - 14)}px`; }
      else { popover.style.bottom = ''; popover.style.top = `${box.bottom + 6}px`; popover.style.maxHeight = `${Math.min(320, Math.max(below - 14, 160))}px`; }
    }
    function open(seed = '') {
      if (trigger.disabled || !popover.hidden) return;
      popover.hidden = false; trigger.setAttribute('aria-expanded', 'true'); root.classList.add('open');
      input.value = seed; active = Math.max(0, [...select.options].filter(option => usable(option) && !prompt(option)).findIndex(option => option.selected));
      render(); place(); input.focus();
      view.addEventListener('resize', place); doc.addEventListener('scroll', place, true); doc.addEventListener('pointerdown', outside, true);
    }
    function close(refocus = false) {
      if (popover.hidden) return;
      popover.hidden = true; trigger.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); input.value = ''; input.removeAttribute('aria-activedescendant');
      view.removeEventListener('resize', place); doc.removeEventListener('scroll', place, true); doc.removeEventListener('pointerdown', outside, true);
      if (refocus) trigger.focus();
    }
    function outside(event: Event) { if (!event.composedPath().includes(root)) close(); }
    async function choose(index: number) {
      const option = options[index]; if (!option || busy) return;
      const next = select.multiple ? [...select.selectedOptions].map(o => o.value).filter(v => v !== option.value).concat(option.selected ? [] : [option.value]) : option.value;
      if (!select.multiple) close(true);
      busy = true; trigger.setAttribute('aria-busy', 'true');
      try {
        if (onChoose) await onChoose(next);
        else {
          if (select.multiple) [...select.options].forEach(o => { o.selected = (next as string[]).includes(o.value); }); else select.value = next as string;
          select.dispatchEvent(new view.Event('input', { bubbles: true })); select.dispatchEvent(new view.Event('change', { bubbles: true }));
        }
      } finally { busy = false; trigger.removeAttribute('aria-busy'); sync(); }
    }
    trigger.addEventListener('click', () => popover.hidden ? open() : close(true));
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); open(); }
      else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); open(event.key); }
    });
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (options.length) { active = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; highlight(true); } }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); active = event.key === 'Home' ? 0 : options.length - 1; highlight(true); }
      else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (options.length) choose(active < 0 ? 0 : active); }
      // Escape closes only the list, never the dialog around it.
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close();
    });
    root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget as Node | null)) close(); });
    // Callers replace options and toggle disabled freely; follow them without explicit calls.
    new view.MutationObserver(sync).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label'] });
    select.addEventListener('change', sync);
    sync();
    return { element: root, trigger, input, sync, open, close };
  }
  const css = `.cb-native{display:none!important}.cb{position:relative;min-width:0;width:100%}
    .cb .cb-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:40px;margin:0;padding:8px 10px 8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);font:inherit;font-size:13px;line-height:1.4;text-align:left;cursor:pointer;box-shadow:0 1px 2px #0000000a;transition:border-color .12s,background .12s}
    .cb .cb-trigger:hover:not(:disabled){background:var(--hover);border-color:var(--line)}.cb.open .cb-trigger{border-color:var(--accent)}
    .cb .cb-trigger:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.cb .cb-trigger:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
    .cb .cb-trigger svg{width:15px;height:15px;flex-shrink:0;color:var(--muted)}.cb-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cb-value.cb-placeholder{color:var(--muted)}
    .cb-popover{position:fixed;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);box-shadow:0 12px 36px #0000002e,0 2px 6px #00000014}
    .cb-popover[hidden]{display:none!important}
    .cb .cb-search-row{display:flex;align-items:center;gap:8px;padding:0 12px;border-bottom:1px solid var(--line);flex-shrink:0}.cb .cb-search-row svg{width:15px;height:15px;flex-shrink:0;color:var(--muted)}
    .cb .cb-search-row input.cb-search{flex:1;width:100%;min-width:0;min-height:0;height:40px;margin:0;padding:0;border:0;border-radius:0;outline:none;background:transparent;color:var(--text);font:inherit;font-size:13px;letter-spacing:0;box-shadow:none;-webkit-appearance:none;appearance:none}
    .cb .cb-search-row input.cb-search:focus-visible{outline:none}.cb .cb-search-row input.cb-search::placeholder{color:var(--muted)}.cb .cb-search-row input.cb-search::-webkit-search-cancel-button{display:none}
    .cb-list{overflow-y:auto;overscroll-behavior:contain;padding:4px}.cb-list:empty{display:none}
    .cb-item{display:flex;align-items:center;gap:8px;padding:8px 10px 8px 8px;border-radius:7px;font-size:13px;line-height:1.4;cursor:pointer;user-select:none;overflow-wrap:anywhere}
    .cb-item svg{width:14px;height:14px;flex-shrink:0;color:var(--accent);visibility:hidden}.cb-item[aria-selected=true] svg{visibility:visible}.cb-item[aria-selected=true]{font-weight:600}
    .cb-item.active{background:var(--hover)}.cb-empty{padding:22px 12px;text-align:center;font-size:13px;color:var(--muted)}.cb-empty:empty{display:none}
    @media(prefers-reduced-motion:no-preference){.cb.open .cb-popover{animation:cb-in .12s ease-out}@keyframes cb-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}}`;
  globalThis.VtopCombobox = { create, css };
})();
