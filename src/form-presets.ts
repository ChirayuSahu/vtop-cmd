// Lets content.ts leave alone the fields a saved preset fills.
interface VtopFormPresetsApi {
  /** True when an enabled preset for this field's form has a saved value for it. */
  owns(field: Element): boolean;
}
declare var VtopFormPresets: VtopFormPresetsApi | undefined;

(() => {
  'use strict';
  // A form control as this file handles it. The code checks tagName/type at runtime before reading members only some
  // kinds have (a select's options, a checkbox's state, …), so those read as optional on every kind.
  type Field = VtopValueControl & Partial<Pick<HTMLSelectElement, 'multiple' | 'options' | 'selectedOptions' | 'add'>> & Partial<Pick<HTMLInputElement, 'checked' | 'readOnly' | 'placeholder'>>;
  // A field's saved value: checked state, a value, or the chosen values of a multiple select.
  type PresetValue = boolean | string | string[];
  // One saved preset, stored in chrome.storage.local under formPresets keyed by formKey().
  interface Preset { enabled: boolean; values: Record<string, PresetValue> }
  type Presets = Record<string, Preset>;
  // The editor's copy of one form field.
  interface Control { id: string; copy: Field; sourceId: string; desired: PresetValue; pendingDesired: boolean; cleared: boolean; picker: VtopComboboxControl | null; head: HTMLDivElement | null; refreshed?: string | null }
  interface LookupTask { control: Control; value: PresetValue; reset: boolean }
  interface EditSession { key: string; form: HTMLFormElement; controls: Control[]; queue: LookupTask[]; loading: boolean; cancelled: boolean }
  interface Placement { anchor?: HTMLElement; container?: HTMLFormElement; inline: boolean }
  const clean = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();
  const selector = 'input,select,textarea';
  let saved: Presets = {}, ready = false, running = false, pending: ReturnType<typeof setTimeout> | undefined;
  const bars = new Map<HTMLFormElement, HTMLSpanElement>(), nativePickers = new Map<HTMLSelectElement, {host: HTMLSpanElement; picker: VtopSearchSelectControl}>();
  // Each saved field is filled once per page visit (see content.js). Within a visit, a field VTOP redraws is
  // filled again only if it comes back empty; a value you chose, or a field you changed, is left alone.
  let visit = 0, applied = new Map<string, {visit: number; manual?: boolean}>(), filled = new WeakSet<Field>();
  document.addEventListener('vtop-page-visit', () => { visit++; });
  const slot = (key: string, field: Field, list: Field[]) => JSON.stringify([key, fieldKey(field, list)]);
  const blank = (field: Field) => !['checkbox','radio'].includes(field.type) && !field.multiple && field.value === '';
  function markManual(field: Element | null) {
    const form = field?.closest?.('form'), key = form && formKey(form);
    if (key && owns(field!)) applied.set(slot(key, field as Field, fields(form)), {visit, manual:true});
  }
  const root = () => document.getElementById('b5-pagewrapper') || document.getElementById('page-wrapper') || document.getElementById('page-content');
  function fields(form: HTMLFormElement): Field[] {
    return [...form.querySelectorAll<Field>(selector)].filter(field => {
      if (field.closest('form') !== form || field.closest('[hidden]') || field.readOnly) return false;
      if (field.tagName === 'INPUT' && !['text','search','email','tel','url','number','date','datetime-local','month','week','time','checkbox','radio','range','color'].includes(field.type)) return false;
      return !/password|passwd|captcha|csrf|token|otp|credit.?card|card.?number|cvv|cvc/i.test(`${field.id} ${field.name} ${field.autocomplete}`);
    });
  }
  function fieldKey(field: Field, list: Field[]) {
    const base: (string | number)[] = [field.tagName, field.type, field.name || field.id || `field-${list.indexOf(field)}`];
    if (field.type === 'radio' || field.type === 'checkbox') base.push(field.value);
    else if (list.filter(item => item.tagName === field.tagName && item.type === field.type && (item.name || item.id) === (field.name || field.id)).length > 1) base.push(list.indexOf(field));
    return JSON.stringify(base);
  }
  function formKey(form: HTMLFormElement): string | null {
    const container = root();
    if (form.id !== 'LateHourRequestForm' || !container?.contains(form) || form.querySelector('input[type=password]')) return null;
    const heading = clean(container.querySelector('h1,h2,h3,h4,h5,h6,.card-header,.panel-title')?.textContent);
    const identity = form.id || form.getAttribute('name') || String([...container.querySelectorAll('form')].indexOf(form));
    return JSON.stringify([location.pathname, heading, identity, (form.getAttribute('action') || '').split('?')[0]]);
  }
  function owns(field: Element): boolean {
    const form = field.closest?.('form'), key = form && formKey(form), preset = (key && saved[key]) as Preset | null | undefined; // formKey() never returns ''
    // content.ts may ask about any element; fieldKey only reads its tag, type, name, id and value.
    return !!(ready && preset?.enabled && Object.hasOwn(preset.values || {}, fieldKey(field as Field, fields(form!))));
  }
  globalThis.VtopFormPresets = { owns };
  const read = (field: Field): PresetValue => field.type === 'checkbox' || field.type === 'radio' ? field.checked! : field.multiple ? [...field.selectedOptions!].map(option => option.value) : field.value;
  function available(field: Field, value: PresetValue | undefined) {
    if (field.tagName !== 'SELECT') return typeof value === (['checkbox','radio'].includes(field.type) ? 'boolean' : 'string');
    const values = field.multiple ? value : [value];
    return Array.isArray(values) && values.every(v => typeof v === 'string' && [...field.options!].some(o => o.value === v && !o.disabled && !(o.parentElement as HTMLSelectElement | HTMLOptGroupElement).disabled));
  }
  function visible(element: HTMLElement | null | undefined) {
    if (!element?.isConnected) return false;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
      const css = getComputedStyle(node);
      if (css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse') return false;
    }
    return true;
  }
  function placement(form: HTMLFormElement): Placement {
    // VTOP's main action buttons name the fragment they replace.
    const controls = [...root()!.querySelectorAll<HTMLButtonElement>('button[data-effectdivision]')].filter(button => {
      const target = document.getElementById(button.dataset.effectdivision!);
      return target?.contains(form) && !form.contains(button) && visible(button);
    });
    const primary = controls.at(-1);
    if (primary) return {anchor: primary.parentElement!.matches('.col-auto') ? primary.parentElement! : primary, inline:true};
    const action = [...form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button,input[type=submit]')].find(button => visible(button) &&
      (button.type === 'submit' || /submit|save|search|view|apply|request/i.test(clean(button.textContent || button.value))));
    return action ? {anchor:action,inline:true} : {container:form,inline:false};
  }
  async function restore() {
    if (!ready || running) return;
    running = true;
    let rescan = false;
    try {
      for (const form of root()?.querySelectorAll('form') || []) {
        const key = formKey(form)!, preset = saved[key];
        if (!preset?.enabled || !visible(form) || (dialog.open && editing?.form === form)) continue;
        const list = fields(form);
        for (const field of list) {
          if (!field.isConnected) {rescan=true;continue;}
          if (field.disabled || !owns(field) || dialog.open && editing?.form===form) continue;
          const value = preset.values[fieldKey(field, list)];
          if (!available(field, value)) continue;
          const id = slot(key, field, list), prior = applied.get(id);
          if (prior?.visit === visit && (prior.manual || filled.has(field) || !blank(field))) continue;
          applied.set(id, {visit}); filled.add(field);
          const target=isLookup(field) && document.getElementById(field.dataset.effectdivision!);
          const needsLookup=field.tagName==='SELECT' && field.dataset.isprimarycontrol==='true' && target && [...target.querySelectorAll('select')].some(child=>Object.hasOwn(preset.values,fieldKey(child,fields(form))) && !available(child,preset.values[fieldKey(child,fields(form))]));
          if (JSON.stringify(read(field)) === JSON.stringify(value) && !needsLookup) continue;
          if (globalThis.VtopPageActions && typeof value === 'string' && (field.tagName === 'SELECT' && !field.multiple || field.tagName === 'INPUT' && isLookup(field))) {
            await globalThis.VtopPageActions.change(field, value,{force:!!needsLookup}); // a single select or lookup input: available() checked it is a string
            // A native handler may replace this form. Resume against fresh controls.
            if (!field.isConnected) {rescan=true;break;}
          } else {
            // available() checked the value's shape for this kind of field.
            if (field.type === 'checkbox' || field.type === 'radio') field.checked = value as boolean;
            else if (field.multiple) [...field.options!].forEach(option => { option.selected = (value as string[]).includes(option.value); });
            else field.value = value as string;
            field.dispatchEvent(new Event('input', {bubbles:true}));
            field.dispatchEvent(new Event('change', {bubbles:true}));
          }
        }
      }
    } finally { running = false;if(rescan){clearTimeout(pending);pending=setTimeout(scan,160);} }
  }
  function label(field: Field, index: number) {
    return clean([...field.labels || []].map(item => {const copy=item.cloneNode(true) as HTMLLabelElement;copy.querySelectorAll('input,select,textarea,.vtop-search-select').forEach(node=>node.remove());return copy.textContent;}).join(' ')) || field.getAttribute('aria-label') || field.placeholder || field.name || field.id || `Field ${index + 1}`;
  }
  const { logo, tokens, font, shortcut } = globalThis.VtopBrand;
  const host = document.createElement('div'); host.id = 'vtop-form-presets';
  const shadow = host.attachShadow({mode:'open'});
  const theme = `
    :host{all:initial;color-scheme:light;${tokens.light};font:${font};color:var(--text)}
    :host([data-dark]){color-scheme:dark;${tokens.dark}}
    *{box-sizing:border-box}[hidden]{display:none!important}button,input,select,textarea{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  `;
  globalThis.VtopBrand.setMarkup(shadow, `<style>${theme}${globalThis.VtopCombobox?.css || ''}
    dialog{padding:0;margin:8vh auto 0;width:min(620px,calc(100vw - 28px));max-height:84vh;border:1px solid var(--line);border-radius:20px;background:var(--surface);color:var(--text);box-shadow:0 24px 100px #0005;overflow:hidden}
    dialog[open]{display:flex;flex-direction:column}dialog::backdrop{background:#10182788;backdrop-filter:blur(5px)}
    header{display:flex;gap:12px;align-items:center;padding:20px 22px 12px;flex-shrink:0}.brand{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:750;letter-spacing:2px;color:var(--muted)}.brand .logo{width:24px;height:24px}.spacer{flex:1}
    button{border:1px solid var(--line);border-radius:8px;background:var(--hover);color:var(--text);padding:9px 13px}.close{padding:5px 8px;font-size:12px;background:transparent;color:var(--muted)}button:hover{border-color:var(--accent)}
    .intro{padding:4px 22px 18px}h2{font-size:22px;letter-spacing:-.5px;line-height:1.3;margin:4px 0 7px}.page{font-size:13px;color:var(--muted);margin:0}.body{overflow:auto;overscroll-behavior:contain;padding:0 22px;min-height:0}
    .meta{display:flex;justify-content:space-between;gap:10px;padding:10px 22px;border-block:1px solid var(--line);font-size:11px;color:var(--muted);letter-spacing:.5px;flex-shrink:0}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 16px;padding:20px 0 24px}
    .field{display:block;min-width:0}.field.wide{grid-column:1/-1}.field>span{display:block;font-size:12px;font-weight:600;margin-bottom:7px}.field-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-height:18px;margin-bottom:7px}.field-head>span{min-width:0;font-size:12px;font-weight:600}.field-head .reset{flex-shrink:0;padding:0 2px;border:0;border-radius:4px;background:transparent;color:var(--muted);font-size:11px;line-height:18px}.field-head .reset:hover{color:var(--accent)}.field-head .unset{flex-shrink:0;font-size:11px;font-weight:400;color:var(--muted)}.fields input:not([type=checkbox]):not([type=radio]):not(.cb-search),.fields textarea{display:block;width:100%;min-height:40px;margin:0;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);font-size:13px;line-height:1.4;box-shadow:0 1px 2px #0000000a;transition:border-color .12s,background .12s}.fields input:not([type=checkbox]):not([type=radio]):not(.cb-search):hover:not(:disabled),.fields textarea:hover:not(:disabled){background:var(--hover)}.fields input:not([type=checkbox]):not([type=radio]):not(.cb-search):focus-visible,.fields textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.fields input:disabled,.fields textarea:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}.fields input::-webkit-calendar-picker-indicator{opacity:.6;cursor:pointer}input::placeholder,textarea::placeholder{color:var(--muted)}textarea{min-height:90px;resize:vertical}.check{display:flex;align-items:center;gap:10px}.check>span{margin:0}.check input{accent-color:var(--accent)}
    details{border-top:1px solid var(--line);padding:12px 0;color:var(--muted);font-size:12px}summary{cursor:pointer}details p{line-height:1.6;margin:8px 0 0}
    footer{padding:16px 22px;border-top:1px solid var(--line);background:var(--surface);flex-shrink:0}.toggle-row{display:flex;align-items:center;justify-content:space-between;gap:18px}.toggle-title{display:block;font-weight:600;font-size:13px}.toggle-help{display:block;color:var(--muted);font-size:12px;margin-top:2px}.toggle-row input{appearance:none;position:relative;flex-shrink:0;width:36px;height:21px;margin:0;border:1px solid var(--line);border-radius:20px;background:var(--muted);cursor:pointer}.toggle-row input::before{content:"";position:absolute;width:15px;height:15px;top:2px;left:2px;border-radius:50%;background:var(--surface)}.toggle-row input:checked{background:var(--accent);border-color:var(--accent)}.toggle-row input:checked::before{transform:translateX(15px)}
    .actions{display:flex;gap:8px;margin-top:16px;align-items:center}.delete{margin-right:auto;background:transparent;color:var(--muted);font-size:12px}.cancel{margin-left:auto;background:transparent}.save:disabled{opacity:.5;cursor:default}.status{font-size:12px;color:var(--muted);margin:0}.status:not(:empty){margin-top:10px}
    @media(max-width:480px){dialog{margin-top:4vh;max-height:92vh}.fields{grid-template-columns:minmax(0,1fr);gap:16px}header{padding-top:16px}.intro{padding-bottom:14px}.toggle-help{max-width:220px}.actions button{padding:8px 10px}}
    @media(prefers-reduced-motion:no-preference){dialog[open]{animation:arrive .13s ease-out}.toggle-row input::before{transition:transform .15s}@keyframes arrive{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}}
    </style><dialog aria-labelledby="title" aria-describedby="preset-page"><header><span class="brand">${logo}VTOP / PRESETS</span><span class="spacer"></span><button type="button" class="close" aria-label="Close preset">Esc</button></header>
    <div class="intro"><h2 id="title">Create form preset</h2><p class="page" id="preset-page"></p></div><div class="meta"><span class="field-count"></span><span>ONLY ON THIS DEVICE</span></div>
    <div class="body"><div class="fields"></div><details><summary>About this preset</summary><p>Saved values fill this form when you return. You still review and submit it yourself.</p><p>Type in a dropdown to search its choices. School, venue and work choices load their dependent fields from VTOP. Nothing is submitted.</p><p>Passwords, security codes, hidden fields and files are excluded.</p></details></div>
    <footer><label class="toggle-row"><span><span class="toggle-title">Automatically fill this form</span><span class="toggle-help">Turn off to keep your preset without applying it.</span></span><input class="enabled" type="checkbox" role="switch" aria-label="Automatically fill this form" checked></label><div class="actions"><button type="button" class="delete">Delete preset</button><button type="button" class="cancel">Cancel</button><button type="button" class="save">Save preset</button></div><p class="status" role="status"></p></footer></dialog>`);
  document.body.append(host);
  const dialog = shadow.querySelector('dialog')!, $ = <E extends Element = HTMLElement>(s: string): E => shadow.querySelector<E>(s)!;
  let editing: EditSession | undefined, previousFocus: HTMLElement | undefined;
  function open(form: HTMLFormElement, button: HTMLElement) {
    const key = formKey(form); if (!key) return;
    const list = fields(form), preset = saved[key];
    previousFocus = button;
    editing = {key, form, controls:[], queue:[], loading:false, cancelled:false};
    $('.body').scrollTop = 0;
    shadow.querySelector('details')!.open = false;
    $('#title').textContent = preset ? 'Edit form preset' : 'Create form preset';
    $('.page').textContent = clean(root()?.querySelector('h1,h2,h3,h4,h5,h6,.card-header,.panel-title')?.textContent) || 'VTOP form';
    $('.fields').replaceChildren(); $('.status').textContent = ''; $<HTMLButtonElement>('.save').disabled = false;
    $<HTMLInputElement>('.enabled').checked = preset?.enabled !== false; $('.delete').hidden = !preset;
    list.forEach((field, index) => {
      // Copy controls only; native scripts, submit actions and inline handlers stay on VTOP.
      const copy = document.createElement(field.tagName.toLowerCase()) as Field;
      if (field.tagName === 'INPUT') (copy as HTMLInputElement).type = field.type;
      if (field.tagName === 'SELECT') {
        copy.multiple = field.multiple;
        for (const option of field.options!) { const item = new Option(option.text, option.value); item.disabled = option.disabled || (option.parentElement as HTMLSelectElement | HTMLOptGroupElement).disabled; copy.add!(item); }
      }
      for (const attr of ['min','max','step','maxlength','placeholder']) if(field.hasAttribute(attr)) copy.setAttribute(attr,field.getAttribute(attr)!);
      const id = fieldKey(field,list), kept = preset && Object.hasOwn(preset.values || {},id);
      // A field missing from a saved preset was reset (or unavailable when saved), so it starts empty.
      const cleared = !!preset && !kept, value = kept ? preset!.values[id] : cleared ? emptyValue(copy) : read(field);
      if (field.tagName === 'SELECT' && !cleared) {
        const selected = field.multiple ? value : [value];
        for (const missing of Array.isArray(selected) ? selected : []) if (typeof missing === 'string' && ![...copy.options!].some(option => option.value === missing)) copy.add!(new Option(`${missing || 'Empty choice'} (currently unavailable)`, missing));
      }
      if (['checkbox','radio'].includes(field.type)) { copy.checked = value === true; copy.name = field.type === 'radio' ? `preset-${field.name || field.id}` : ''; }
      else if (copy.multiple) [...copy.options!].forEach(option => { option.selected = Array.isArray(value) && value.includes(option.value); });
      else copy.value = value as string;
      copy.disabled = field.disabled;
      copy.setAttribute('aria-label',label(field,index));
      const toggle = ['checkbox','radio'].includes(field.type);
      const wrapper = document.createElement(toggle?'label':'div'), title = document.createElement('span');
      wrapper.className = toggle ? 'field check' : field.tagName === 'TEXTAREA' ? 'field wide' : 'field';
      title.textContent = label(field,index);
      const control: Control = {id,copy,sourceId:field.id,desired:read(copy),pendingDesired:!!preset && !cleared,cleared,picker:null,head:null};
      if(toggle) wrapper.append(title,copy);
      else {
        // Each field can be reset on its own: it empties and is left out of the preset, so auto-fill skips it.
        const head = document.createElement('div'), reset = document.createElement('button'), unset = document.createElement('span');
        head.className = 'field-head'; reset.type = 'button'; reset.className = 'reset'; reset.textContent = 'Reset';
        reset.setAttribute('aria-label',`Reset ${label(field,index)}`); unset.className = 'unset'; unset.textContent = 'Not filled';
        reset.addEventListener('click',()=>{clearControl(editing!,control);(control.picker?.trigger || copy).focus();});
        head.append(title,reset,unset); wrapper.append(head,copy); control.head = head;
      }
      $('.fields').append(wrapper);
      editing!.controls.push(control);
      if(copy.tagName === 'SELECT' && globalThis.VtopCombobox) control.picker = globalThis.VtopCombobox.create(copy as HTMLSelectElement,{label:label(field,index)});
      copy.addEventListener('input',()=>{control.desired=read(copy);if(control.cleared){control.cleared=false;showState(control);}});
      copy.addEventListener('change',()=>{
        control.desired=read(copy);control.pendingDesired=false;control.cleared=false;showState(control);
        const source=sourceFor(editing!,control);
        if(isLookup(source)) queueLookup(editing,control,control.desired,true);
      });
      showState(control);
    });
    countFields();
    dialog.showModal(); $('.close').focus();
    // Reopen saved presets even when the native page hasn't loaded their children yet.
    for(const control of editing!.controls) {
      const source=sourceFor(editing,control);
      if(isLookup(source) && control.desired && (source.tagName!=='SELECT' || !/select|choose/i.test(control.copy.selectedOptions![0]?.textContent || '') && control.desired!=='-1')) queueLookup(editing,control,control.desired,false);
    }
  }
  function emptyValue(copy: Field): PresetValue {
    if (['checkbox','radio'].includes(copy.type)) return false;
    if (copy.multiple) return [];
    if (copy.tagName === 'SELECT') return [...copy.options!].some(option => option.value === '') ? '' : copy.options![0]?.value || '';
    return '';
  }
  function countFields() {
    const count = editing ? editing.controls.filter(control => !control.cleared && !control.copy.disabled).length : 0;
    $('.field-count').textContent = `${count} SAVED ${count === 1 ? 'FIELD' : 'FIELDS'}`;
  }
  function showState(control: Control) {
    if (control.head) { control.head.querySelector<HTMLElement>('.reset')!.hidden = control.cleared; control.head.querySelector<HTMLElement>('.unset')!.hidden = !control.cleared; }
    countFields();
  }
  // Empty a field and leave it out of the preset. Its dependents empty with it; nothing is sent to VTOP.
  function clearControl(session: EditSession,control: Control) {
    const copy = control.copy, empty = emptyValue(copy);
    if (copy.multiple) [...copy.options!].forEach(option => { option.selected = false; }); else if (['checkbox','radio'].includes(copy.type)) copy.checked = false; else copy.value = empty as string;
    session.queue = session.queue.filter(task => task.control !== control);
    control.desired = read(copy); control.pendingDesired = false; control.cleared = true; control.picker?.sync(); showState(control);
    const source = sourceFor(session,control);
    if (isLookup(source)) for (const child of dependents(session,source)) if (!child.cleared) clearControl(session,child);
  }
  const lookupIds = new Set(['costCentreId','roomTypeId','buildingId','lateHourEventId','fromTime','lateHourFromDate','lateHourToDate','leaveFromDate','leaveToDate']);
  function isLookup(source: Field | undefined): source is Field {
    return (source && /^(LateHourRequestForm|LeaveRequestForm)$/.test(source.form?.id || '') && lookupIds.has(source.id)) as boolean;
  }
  function sourceFor(session: EditSession,control: Control) {
    return fields(session.form).find(field=>fieldKey(field,fields(session.form))===control.id);
  }
  // Fields a lookup reloads: those in its effect division, or the venue for a block (which reloads itself too).
  function dependents(session: EditSession,source: Field) {
    const target=document.getElementById(source.dataset.effectdivision!);
    return session.controls.filter(control=>{
      const field=sourceFor(session,control);
      return field && field!==source && target?.contains(field) && (!target.contains(source) || source.id==='buildingId' && field.id==='venue');
    });
  }
  function resetChildren(session: EditSession,source: Field) {
    for(const control of dependents(session,source)) {
      const field=sourceFor(session,control);
      control.pendingDesired=false;control.cleared=true;control.refreshed=null;showState(control);
      control.desired=field!.tagName==='SELECT' ? field!.options![0]?.value || '' : '';
      if(control.copy.tagName==='SELECT')control.copy.replaceChildren(new Option('Loading choices…',''));
      // Combobox sync() takes no argument; the extra one is ignored at runtime.
      control.copy.disabled=true;(control.picker as {sync(force?: boolean): void} | null)?.sync(true);
      session.queue=session.queue.filter(task=>task.control!==control);
    }
  }
  function refreshEditor(session: EditSession) {
    if(!/^(LateHourRequestForm|LeaveRequestForm)$/.test(session.form.id))return;
    if(editing!==session || session.cancelled || !dialog.open)return;
    for(const control of session.controls) {
      const source=sourceFor(session,control), copy=control.copy;
      if(!source) {copy.disabled=true;control.picker?.sync();continue;}
      copy.disabled=source.disabled;
      for(const attr of ['min','max','step']) {if(source.hasAttribute(attr))copy.setAttribute(attr,source.getAttribute(attr)!);else copy.removeAttribute(attr);}
      if(copy.tagName==='SELECT') {
        // Page changes elsewhere also trigger this; rebuilding an unchanged list would make an open dropdown jump.
        const signature=JSON.stringify([source.disabled,[...source.options!].map(option=>[option.value,option.text,option.disabled||(option.parentElement as HTMLSelectElement | HTMLOptGroupElement | null)?.disabled]),control.desired,control.pendingDesired]);
        if(control.refreshed===signature)continue;
        control.refreshed=signature;
        copy.replaceChildren(...[...source.options!].map(option=>{const item=new Option(option.text,option.value);item.disabled=option.disabled||(option.parentElement as HTMLSelectElement | HTMLOptGroupElement)?.disabled;return item;}));
        if(available(copy,control.desired)) {
          // A saved value stays wanted until you change it or its parent: a later lookup may reload its choices.
          if(copy.multiple)[...copy.options!].forEach(option=>{option.selected=(control.desired as string[]).includes(option.value);});else copy.value=control.desired as string;
        } else {copy.value=source.value;if(!control.pendingDesired)control.desired=read(copy);}
      } else if(!control.desired && source.value && !control.cleared) {copy.value=source.value;control.desired=read(copy);}
      // Combobox sync() takes no argument; the extra one is ignored at runtime.
      (control.picker as {sync(force?: boolean): void} | null)?.sync(true);
    }
    countFields();
  }
  async function queueLookup(session: EditSession | undefined,control: Control,value: PresetValue,reset: boolean) {
    if(!session || session.cancelled)return;
    const existing=session.queue.find(task=>task.control===control);
    if(existing){existing.value=value;existing.reset=reset;}else session.queue.push({control,value,reset});
    if(session.loading)return;
    session.loading=true;$<HTMLButtonElement>('.save').disabled=true;$('.status').textContent='Loading choices from VTOP…';
    try {
      while(session.queue.length && !session.cancelled && session===editing) {
        const task=session.queue.shift()!, source=sourceFor(session,task.control);
        // Lookup sources are single selects and date/time inputs, so their values are never checked states.
        if(!source || source.disabled || source.tagName==='SELECT'&&!available(source,task.value) || typeof task.value==='boolean')continue;
        if(task.reset)resetChildren(session,source);
        const ok=globalThis.VtopPageActions ? await globalThis.VtopPageActions.change(source,task.value,{force:true}) : await fallbackChange(source,task.value);
        if(session.cancelled || session!==editing)break;
        refreshEditor(session);
        if(!ok)throw new Error('Lookup failed');
      }
      if(!session.cancelled && session===editing)$('.status').textContent='';
    } catch {
      if(!session.cancelled && session===editing){refreshEditor(session);$('.status').textContent='Could not load choices. Change the previous field to try again.';}
    } finally {
      session.loading=false;
      if(session===editing){$<HTMLButtonElement>('.save').disabled=false;refreshEditor(session);}
    }
  }
  async function fallbackChange(source: Field,value: string | string[]) {
    if(source.multiple)[...source.options!].forEach(option=>{if(!option.disabled)option.selected=[value].flat().includes(option.value);});else source.value=String(value);
    source.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,180));return true;
  }
  const nativeStyle=document.createElement('style');nativeStyle.textContent='select[data-vtop-searchable]{display:none!important}';document.head.append(nativeStyle);
  function syncNativePickers() {
    if(!globalThis.VtopSearchSelect)return;
    for(const [select,record] of nativePickers)if(!select.isConnected){record.host.remove();nativePickers.delete(select);}
    for(const form of root()?.querySelectorAll('form') || []) {
      if(!/^(LateHourRequestForm|LeaveRequestForm)$/.test(form.id))continue;
      for(const select of fields(form).filter((field): field is HTMLSelectElement=>field.tagName==='SELECT')) {
        let record=nativePickers.get(select);
        if(!record) {
          const mount=document.createElement('span');mount.className='vtop-search-select';const ui=mount.attachShadow({mode:'open'});
          globalThis.VtopBrand.setMarkup(ui, `<style>${theme}${globalThis.VtopSearchSelect.css}:host{display:block;width:100%}[hidden]{display:none!important}</style>`);
          select.after(mount);select.setAttribute('data-vtop-searchable','');
          const picker=globalThis.VtopSearchSelect.create(select,ui,label(select,0),async value=>{
            // A pick here is yours, even though the change it fires isn't a trusted event.
            markManual(select);
            // A multiple select hands over the array of chosen values.
            if(globalThis.VtopPageActions)await globalThis.VtopPageActions.change(select,value);else await fallbackChange(select,value);
          });
          record={host:mount,picker};nativePickers.set(select,record);
        }
        record.picker.sync();
      }
    }
  }
  async function persist(next: Presets) {
    try { await chrome.storage.local.set({formPresets:next}); saved = next; return true; }
    catch { $('.status').textContent = 'Could not save. Reload VTOP and try again.'; return false; }
  }
  $('.save').addEventListener('click', async () => {
    if(editing?.loading)return;
    const values = Object.fromEntries(editing!.controls.filter(({copy,cleared})=>!copy.disabled && !cleared).map(({id,copy}) => [id,read(copy)]));
    if (!await persist({...saved,[editing!.key]:{enabled:$<HTMLInputElement>('.enabled').checked,values}})) return;
    appliedReset(); dialog.close(); scan();
  });
  $('.delete').addEventListener('click', async () => {
    const next = {...saved}; delete next[editing!.key];
    if(await persist(next)) { dialog.close(); scan(); }
  });
  function appliedReset() { applied = new Map(); filled = new WeakSet(); }
  for (const name of ['.close','.cancel']) $(name).addEventListener('click',()=>dialog.close());
  // A click on the backdrop discards edits, like Cancel and Esc.
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{if(editing){editing.cancelled=true;editing.queue=[];}if(previousFocus?.isConnected) previousFocus.focus();});
  document.addEventListener('keydown',event=>{if(dialog.open && shortcut.matches(event)) dialog.close();});
  function syncTheme() {
    const dark = document.documentElement.hasAttribute('data-vtop-command-dark');
    for (const node of [host,...bars.values(),...[...nativePickers.values()].map(record=>record.host)]) if(node.hasAttribute('data-dark') !== dark) node.toggleAttribute('data-dark',dark);
  }
  new MutationObserver(syncTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-vtop-command-dark']});
  function scan() {
    for (const [form,bar] of bars) if (!form.isConnected) {bar.remove();bars.delete(form);}
    for (const form of root()?.querySelectorAll('form') || []) {
      const key = formKey(form); if (!key || !fields(form).length) { bars.get(form)?.remove(); bars.delete(form); continue; }
      let bar = bars.get(form);
      if (!bar) {
        bar = document.createElement('span'); bar.className = 'vtop-form-preset-bar col-auto';
        const ui = bar.attachShadow({mode:'open'});
        globalThis.VtopBrand.setMarkup(ui, `<style>${theme}:host{display:inline-flex;vertical-align:middle;margin:0 0 0 8px}:host([hidden]){display:none!important}:host([data-standalone]){margin:0 0 14px}button{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-weight:550;white-space:nowrap;box-shadow:0 1px 3px #00000008}button:hover{background:var(--hover);border-color:var(--accent)}svg{width:14px;height:14px;color:var(--accent);flex-shrink:0}.state{padding:1px 5px;border-radius:4px;background:var(--hover);color:var(--muted);font-size:10px}.state.on{color:var(--accent)}</style><button type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--surface)"/><circle cx="15" cy="17" r="3" fill="var(--surface)"/></svg><span class="label"></span><span class="state" hidden></span></button>`);
        ui.querySelector('button')!.addEventListener('click',()=>open(form,ui.querySelector('button')!));
        bars.set(form,bar);
      }
      const show = visible(form) && fields(form).some(visible);
      if(bar.hidden === show) bar.hidden = !show;
      const position = placement(form);
      if(position.anchor) {
        let sibling = position.anchor.nextElementSibling;
        while(sibling?.classList.contains('vtop-form-preset-bar') && sibling !== bar) sibling = sibling.nextElementSibling;
        if(sibling !== bar) position.anchor.after(bar);
        if(bar.hasAttribute('data-standalone')) bar.removeAttribute('data-standalone');
      } else {
        if(bar.parentElement !== form || form.firstElementChild !== bar) form.prepend(bar);
        if(!bar.hasAttribute('data-standalone')) bar.setAttribute('data-standalone','');
      }
      const preset = saved[key];
      const button = bar.shadowRoot!.querySelector('button')!;
      const text = preset ? 'Edit preset' : 'Create preset';
      const title = button.querySelector('.label')!, state = button.querySelector<HTMLElement>('.state')!;
      if (title.textContent !== text) title.textContent = text;
      if(state.hidden !== !preset) state.hidden = !preset;
      if(preset) {
        const status = preset.enabled ? 'On' : 'Off';
        if(state.textContent !== status) state.textContent = status;
        if(state.classList.contains('on') !== !!preset.enabled) state.classList.toggle('on',!!preset.enabled);
      }
      button.setAttribute('aria-label',preset ? `${text}, ${preset.enabled ? 'on' : 'off'}` : text);
    }
    syncNativePickers();
    syncTheme();
    if(dialog.open && editing && !editing.loading)refreshEditor(editing);
    if(dialog.open && (!visible(editing?.form) || !formKey(editing!.form))) dialog.close();
    restore();
  }
  document.addEventListener('change',event=>{
    if(!event.isTrusted) return;
    // Preserve manual edits until the page is reopened.
    markManual(event.target as Element | null);
  },true);
  new MutationObserver(()=>{clearTimeout(pending);pending=setTimeout(scan,160);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','id','name','hidden','style','class','aria-hidden']});
  // Presets saved in another tab update this one, so saving here never writes back a stale copy over them.
  try { chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.formPresets) return;
    const next = changes.formPresets.newValue;
    saved = next && typeof next === 'object' && !Array.isArray(next) ? next as Presets : {};
  }); } catch {}
  try { chrome.storage.local.get(['formPresets']).then(settings=>{saved=settings.formPresets && typeof settings.formPresets==='object' && !Array.isArray(settings.formPresets)?settings.formPresets as Presets:{};ready=true;scan();}).catch(()=>{ready=true;scan();}); }
  catch {ready=true;scan();}
})();
