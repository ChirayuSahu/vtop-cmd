// The searchable UI around VTOP's own selects, read as `VtopSearchSelect`.
interface VtopSearchSelectControl {
  /** The picker, appended to the container given to create(). */
  element: HTMLDivElement;
  input: HTMLInputElement;
  /** Re-reads the native select; skipped when nothing changed unless forced. */
  sync(force?: boolean): void;
  close(): void;
}
interface VtopSearchSelectApi {
  /** onChoose applies the pick (an array of values for a multiple select); a rejection shows a retry message. */
  create(select: HTMLSelectElement, container: ParentNode & Node, name: string, onChoose: (value: string | string[]) => unknown): VtopSearchSelectControl;
  css: string;
}
declare var VtopSearchSelect: VtopSearchSelectApi;

// Searchable UI around a native select. The native control keeps its form value.
(() => {
  'use strict';
  let sequence = 0;
  function create(select: HTMLSelectElement, container: ParentNode & Node, name: string, onChoose: (value: string | string[]) => unknown): VtopSearchSelectControl {
    const doc = select.ownerDocument, id = `vtop-options-${++sequence}`;
    const picker = doc.createElement('div'); picker.className = 'select-picker';
    globalThis.VtopBrand.setMarkup(picker, `<input type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" spellcheck="false"><div class="select-options" role="listbox" hidden></div><div class="select-message" role="status" aria-live="polite"></div>`);
    const input = picker.querySelector('input')!, list = picker.querySelector<HTMLDivElement>('[role=listbox]')!, message = picker.querySelector<HTMLDivElement>('[role=status]')!;
    input.setAttribute('aria-label',name);input.setAttribute('aria-controls',id);list.id=id;list.setAttribute('aria-label',`${name} choices`);
    if(select.multiple)list.setAttribute('aria-multiselectable','true');
    container.append(picker);
    let expanded=false,active=-1,options:HTMLOptionElement[]=[],busy=false,query='',fingerprint='';
    const text = () => [...select.selectedOptions].map(option=>option.textContent.trim()).join(', ');
    const usable = (option: HTMLOptionElement) => !option.disabled && !(option.parentElement as HTMLOptGroupElement | null)?.disabled && !option.hidden;
    function close() {expanded=false;list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.value=text();query='';message.textContent='';}
    function render() {
      const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      options=[...select.options].filter(option=>usable(option)&&terms.every(term=>option.textContent.toLocaleLowerCase().includes(term)));
      active=Math.min(active,options.length-1);list.replaceChildren();
      options.forEach((option,index)=>{
        const item=doc.createElement('div');item.id=`${id}-${index}`;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.className='select-option';item.textContent=option.textContent;
        if(select.multiple)item.textContent=`${option.selected?'✓  ':''}${option.textContent}`;
        item.addEventListener('pointerdown',event=>event.preventDefault());item.addEventListener('click',()=>choose(index));list.append(item);
      });
      message.textContent=options.length?'':'No matching choices';highlight();
    }
    function highlight() {
      [...list.children].forEach((item,index)=>item.classList.toggle('active',index===active));
      if(active>=0&&list.children[active]){input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView?.({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
    }
    function open() {if(input.disabled)return;expanded=true;query='';active=-1;list.hidden=false;input.setAttribute('aria-expanded','true');input.value='';render();}
    async function choose(index: number) {
      const option=options[index];if(!option||busy||input.disabled)return;
      const value=select.multiple?[...select.selectedOptions].map(o=>o.value).filter(v=>v!==option.value).concat(option.selected?[]:[option.value]):option.value;
      const caption=option.textContent;close();input.value=caption;busy=true;input.setAttribute('aria-busy','true');
      try {await onChoose(value);} catch {message.textContent='Could not load choices. Try again.';}
      finally {busy=false;input.removeAttribute('aria-busy');sync(true);if(select.multiple&&input===(container.getRootNode() as Document | ShadowRoot).activeElement)open();}
    }
    input.addEventListener('beforeinput',event=>{if(!expanded && event.inputType?.startsWith('insert'))open();});
    input.addEventListener('focus',open);input.addEventListener('click',()=>{if(!expanded)open();});
    input.addEventListener('input',()=>{expanded=true;query=input.value;active=-1;list.hidden=false;input.setAttribute('aria-expanded','true');render();});
    input.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!expanded)open();active=Math.max(0,Math.min(options.length-1,active+(event.key==='ArrowDown'?1:-1)));highlight();}
      else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(expanded&&options.length)choose(active<0?0:active);}
      else if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();close();}
      else if(event.key==='Tab')close();
    });
    input.addEventListener('blur',()=>{close();});
    function sync(force=false) {
      const next=JSON.stringify([select.disabled,[...select.options].map(o=>[o.value,o.textContent,o.disabled,(o.parentElement as HTMLOptGroupElement | null)?.disabled,o.selected])]);
      if(!force&&next===fingerprint)return;fingerprint=next;input.disabled=select.disabled;
      if(input.disabled)close();else if(expanded)render();else input.value=text();
      input.placeholder=select.disabled?'Choose the previous field first':'Type to search…';
    }
    sync();return {element:picker,input,sync,close};
  }
  const css = `.select-picker{position:relative;min-width:0}.select-picker input{width:100%;min-height:42px;padding:10px 30px 10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);font:inherit;font-size:13px}.select-picker::after{content:'⌄';position:absolute;right:12px;top:10px;color:var(--muted);pointer-events:none}.select-picker input:disabled{opacity:.55;cursor:not-allowed}.select-picker input::placeholder{color:var(--muted)}.select-picker input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.select-options{position:relative;z-index:3;max-height:180px;overflow:auto;overscroll-behavior:contain;margin-top:5px;padding:4px;border:1px solid var(--line);border-radius:9px;background:var(--surface);box-shadow:0 6px 18px #0001}.select-option{padding:8px 9px;border-radius:6px;font-size:13px;line-height:1.4;cursor:pointer;white-space:normal;overflow-wrap:anywhere}.select-option:hover,.select-option.active{background:var(--hover);color:var(--accent)}.select-option[aria-selected=true]{font-weight:600}.select-message{font-size:11px;color:var(--muted);margin-top:4px}.select-options[hidden]{display:none!important}select[data-vtop-searchable]{display:none!important}`;
  globalThis.VtopSearchSelect={create,css};
})();
