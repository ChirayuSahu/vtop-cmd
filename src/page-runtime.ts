// MAIN-world coordination: run native VTOP handlers only when the page is idle.
(() => {
  'use strict';
  // VTOP's jQuery, with the ajax counter and the blockUI plugin; absent on some pages.
  type PageWindow = Window & typeof globalThis & { jQuery?: { active?: number; unblockUI?: (options: { fadeOut: number }) => void } };
  interface RuntimeTask { token: string; started: number; before: Set<Element>; failed: boolean }
  let requests=0,active: RuntimeTask | null=null;
  const state=()=>{const root=document.documentElement;if(root){root.setAttribute('data-vtop-runtime-ready','true');root.setAttribute('data-vtop-page-busy',String(requests>0||Number((window as PageWindow).jQuery?.active||0)>0||!!active));}};
  const begin=()=>{requests++;state();};
  const end=()=>{requests=Math.max(0,requests-1);state();};
  if(window.fetch){const native=window.fetch;window.fetch=function(...args){begin();try{return Promise.resolve(native.apply(this,args)).then(response=>{
    // fetch resolves at headers; keep the gate closed until the body has arrived too.
    if(typeof response.clone==='function'&&response.body){
      try{
        // A streaming or long-held response must not keep the page "busy" forever: give up waiting after 20 s.
        const reader=response.clone().body!.getReader();let ended=false;const finish=()=>{if(!ended){ended=true;end();}};const cap=setTimeout(finish,20000);
        (async()=>{try{while(!(await reader.read()).done){}}finally{clearTimeout(cap);reader.releaseLock();finish();}})().catch(()=>{});
      }catch{end();}
    }else end();
    return response;
  },error=>{end();throw error;});}catch(error){end();throw error;}};}
  const nativeSend=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send=function(...args){begin();let ended=false;const finish=()=>{if(ended)return;ended=true;this.removeEventListener('loadend',finish);end();};this.addEventListener('loadend',finish);try{return nativeSend.apply(this,args);}catch(error){finish();throw error;}};
  const visible=(element: Element)=>{const css=getComputedStyle(element);return css.display!=='none'&&css.visibility!=='hidden'&&css.pointerEvents!=='none';};
  const blockers=()=>[...document.querySelectorAll('.blockUI.blockOverlay,.blockUI.blockMsg,.modal-backdrop')].filter(visible);
  // A select change names enabled options only: one value, or for a multiple select a list of them (a disabled one only if it is already chosen).
  function choices(element: Element,value: unknown){
    if(!(element instanceof HTMLSelectElement))return false;
    if(Array.isArray(value)&&!element.multiple)return false;
    return [value].flat().every(v=>typeof v==='string'&&[...element.options].some(o=>o.value===v&&(!o.disabled||element.multiple&&o.selected)));
  }
  function reply(token: string,status: string){document.dispatchEvent(new CustomEvent('vtop-native-action-result',{detail:JSON.stringify({token,status})}));}
  document.addEventListener('vtop-native-action',event=>{
    // Untyped JSON from the isolated-world content script; every field is checked before use.
    let message: any;try{message=JSON.parse((event as CustomEvent<string>).detail);}catch{return;}
    const element=event.target as HTMLElement | null;
    if(!/^action-\d+$/.test(message?.token)||!element?.isConnected)return;
    const dateControl=element instanceof HTMLInputElement && /^(date|time|datetime-local)$/.test(element.type) && /^(LateHourRequestForm|LeaveRequestForm)$/.test(element.form?.id || '') && typeof message.value==='string';
    if(message.kind==='change' ? !dateControl && !choices(element,message.value) : message.kind!=='click'||!element.matches('a.systemB5BtnMenu[data-url],a.systemBtnMenu[data-url],a.quickB5MainMenu[data-url],a[onclick*="home()"]')){reply(message.token,'skipped');return;}
    if(active||requests||Number((window as PageWindow).jQuery?.active||0)||blockers().length){reply(message.token,'busy');return;}
    const task={token:message.token,started:Date.now(),before:new Set(document.querySelectorAll('.blockUI')),failed:false};active=task;state();
    const onError=()=>{task.failed=true;};window.addEventListener('error',onError);
    const finish=(status: string)=>{window.removeEventListener('error',onError);if(active===task)active=null;state();reply(message.token,status);};
    try{
      if(message.kind!=='change')element.click();
      else{
        // A multiple select's disabled options keep their state; choices() checked every value.
        if(element instanceof HTMLSelectElement&&element.multiple){const chosen=[message.value].flat();for(const o of element.options)if(!o.disabled)o.selected=chosen.includes(o.value);}
        else (element as HTMLSelectElement | HTMLInputElement).value=message.value;
        element.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }catch{task.failed=true;}
    function settle(){
      const busy=requests>0||Number((window as PageWindow).jQuery?.active||0)>0;
      if(!busy){
        // Only clean up a blocker introduced by this action, after every request has settled.
        const owned=[...document.querySelectorAll('.blockUI')].filter(node=>!task.before.has(node));
        if(owned.length&&!document.querySelector('.modal.show')){
          if(typeof (window as PageWindow).jQuery?.unblockUI==='function')(window as PageWindow).jQuery!.unblockUI!({fadeOut:0});
          else owned.forEach(node=>node.remove());
        }
        finish(task.failed?'error':'done');return;
      }
      if(Date.now()-task.started>30000){finish('timeout');return;}
      setTimeout(settle,60);
    }
    setTimeout(settle,80);
  },true);
  state();document.addEventListener('DOMContentLoaded',state,{once:true});
})();
