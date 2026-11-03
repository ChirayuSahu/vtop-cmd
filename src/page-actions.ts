// Runs VTOP's native change and click handlers in order, once the page is idle. Read as `VtopPageActions`.
/** A form control whose value VtopPageActions.change can set. */
type VtopValueControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface VtopPageActionsApi {
  /** Sets the value (the chosen values, for a multiple select) and fires VTOP's change handler; resolves false if it was skipped or failed. Skips an unchanged value unless forced. */
  change(element: VtopValueControl, value: string | string[], options?: { force?: boolean }): Promise<boolean>;
  /** Clicks a menu link, re-resolved when its turn comes; cancels pending changes. Resolves false if it was missing or failed. */
  navigate(resolve: () => HTMLElement | null | undefined): Promise<boolean>;
}
declare var VtopPageActions: VtopPageActionsApi;

(() => {
  'use strict';
  // One queued change or click; the MAIN-world runtime answers each by token.
  interface PageTask { kind: 'change' | 'click'; element?: VtopValueControl; value?: string | string[]; force?: boolean; resolve: () => HTMLElement | null | undefined; done: (ok: boolean) => void; promise?: Promise<boolean>; token?: string }
  let queue: PageTask[]=[],current: PageTask | null=null,timer: ReturnType<typeof setTimeout> | undefined,sequence=0;
  const bridged=()=>document.documentElement.hasAttribute('data-vtop-runtime-ready');
  // A multiple select's value is its chosen option values, in any order; its disabled options keep their state.
  const read=(element: VtopValueControl): string | string[]=>element instanceof HTMLSelectElement&&element.multiple?[...element.selectedOptions].map(o=>o.value):element.value;
  const same=(a: string | string[] | undefined,b: string | string[] | undefined)=>Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every(v=>b.includes(v)):a===b;
  function assign(element: VtopValueControl,value: string | string[]){
    if(element instanceof HTMLSelectElement&&element.multiple){const chosen=[value].flat();for(const o of element.options)if(!o.disabled)o.selected=chosen.includes(o.value);}
    else element.value=String(value);
    element.dispatchEvent(new Event('change',{bubbles:true}));
  }
  const blocked=()=>document.documentElement.getAttribute('data-vtop-page-busy')==='true'||[...document.querySelectorAll('.blockUI.blockOverlay,.blockUI.blockMsg,.modal-backdrop')].some(node=>{const css=getComputedStyle(node);return css.display!=='none'&&css.visibility!=='hidden'&&css.pointerEvents!=='none';});
  function schedule(){clearTimeout(timer);if(queue.length&&!current)timer=setTimeout(pump,50);}
  function pump(){
    if(current||!queue.length)return;
    if(bridged()&&blocked()){schedule();return;}
    const task=queue.shift()!,element=task.resolve();
    if(!element?.isConnected){task.done(false);schedule();return;}
    if(task.kind==='change'&&!task.force&&same(read(element as VtopValueControl),task.value)){task.done(true);schedule();return;}
    if(!bridged()){
      if(task.kind==='change')assign(element as VtopValueControl,task.value!);else element.click();
      task.done(true);schedule();return;
    }
    current=task;task.token=`action-${++sequence}`;
    element.dispatchEvent(new CustomEvent('vtop-native-action',{bubbles:true,detail:JSON.stringify({token:task.token,kind:task.kind,value:task.value})}));
  }
  document.addEventListener('vtop-native-action-result',event=>{
    let message: { token?: unknown; status?: unknown };try{message=JSON.parse((event as CustomEvent<string>).detail);}catch{return;}
    if(!current||message.token!==current.token)return;
    const task=current;current=null;
    if(message.status==='busy')queue.unshift(task);else task.done(message.status==='done');
    schedule();
  });
  function change(element: VtopValueControl,value: string | string[],{force=false}={}): Promise<boolean>{
    // Unbridged previews/tests retain native synchronous behavior.
    if(!bridged()){assign(element,value);return Promise.resolve(true);}
    if(current?.element===element&&same(current.value,value))return current.promise!;
    const existing=queue.find(task=>task.element===element);
    if(existing){existing.value=value;existing.force=force;return existing.promise!;}
    let done!: (ok: boolean) => void;const promise=new Promise<boolean>(resolve=>{done=resolve;});
    queue.push({kind:'change',element,value,force,resolve:()=>element,done,promise});schedule();return promise;
  }
  function navigate(resolve: () => HTMLElement | null | undefined): Promise<boolean>{
    // Navigation takes priority over pending automatic changes on the old page.
    for(const task of queue)task.done(false);queue=[];
    if(!bridged()){const element=resolve();element?.click();return Promise.resolve(!!element);}
    // Multi-page tools can await the MAIN-world result before reading the new page.
    let done!: (ok: boolean) => void;const promise=new Promise<boolean>(finish=>{done=finish;});
    queue.push({kind:'click',resolve,done});schedule();return promise;
  }
  globalThis.VtopPageActions={change,navigate};
})();
