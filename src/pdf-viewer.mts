import * as pdfjs from './vendor/pdf.mjs';
interface PageState{number:number;element:HTMLElement;canvas:HTMLCanvasElement;placeholder:HTMLDivElement;text:HTMLDivElement;width:number;height:number;rendered:boolean;task:pdfjs.RenderTask|null;failed?:boolean;texted?:boolean}
// The page box is given page numbers; the DOM stringifies them.
interface PageInput extends HTMLInputElement{get value():string;set value(value:string|number);get max():string;set max(value:string|number);}
// What the viewer needs from VtopBrand.shortcut, so the fallback below (no VtopBrand) fits too.
type MenuKey=Pick<VtopShortcut,'matches'>&Partial<Pick<VtopShortcut,'set'>>;
// The parent's message; untrusted, so the listener checks each field before using it.
interface PdfDataMessage{type?:string;nonce?:string;bytes:ArrayBuffer;documentType?:string}
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
const $=<T extends Element=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!,nonce=location.hash.slice(1);
// Firefox can report the extension URL as this frame's referrer; this viewer is only embedded on VTOP.
const parentOrigin='https://vtop.vit.ac.in';
const container=$('#pages'),states:PageState[]=[],nearby=new Set<PageState>(),GUTTER=48;
// Match the command menu's palette and follow its dark-mode setting live.
if(globalThis.VtopBrand){const style=document.createElement('style');style.textContent=`:root{color-scheme:light;${VtopBrand.tokens.light}}:root[data-dark]{color-scheme:dark;${VtopBrand.tokens.dark}}`;document.head.prepend(style);}
function theme(dark:boolean){document.documentElement.toggleAttribute('data-dark',dark);}
theme(new URLSearchParams(location.search).get('theme')==='dark');
try{
 chrome.storage.local.get('darkMode').then(settings=>theme(settings.darkMode===true)).catch(()=>{});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.darkMode)theme(changes.darkMode.newValue===true);});
}catch{/* Tests and previews run without the extension runtime. */}
const menuKey:MenuKey=globalThis.VtopBrand?.shortcut||{modifier:'Ctrl',matches:event=>(event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&(event.key?.toLowerCase()==='k'||event.code==='KeyK')};
try{
 chrome.storage.local.get('commandShortcut').then(settings=>{if(settings.commandShortcut)menuKey.set?.(settings.commandShortcut as Partial<VtopShortcutBinding>);}).catch(()=>{});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.commandShortcut)menuKey.set?.(changes.commandShortcut.newValue as Partial<VtopShortcutBinding>|undefined);});
}catch{/* Tests and previews run without the extension runtime. */}
let pdf:pdfjs.PDFDocumentProxy|undefined,pageNumber=1,scale=1,received=false,autoFit=true,lastFitWidth=0,generation=0,running=false,scrollFrame:number|null|undefined,refreshTimer:ReturnType<typeof setTimeout>|undefined;
function status(text:string){$('#status').textContent=text;}
function notify(type:string,extra:Record<string,unknown>={}){parent.postMessage({type,nonce,...extra},parentOrigin);}
function sheetTop(state:PageState){return Math.max(0,state.element.offsetTop-(parseFloat(getComputedStyle(container).paddingTop)||0));}
function controls(){
 $<PageInput>('#page').value=pageNumber;$('#zoom').textContent=`${Math.round(scale*100)}%`;
}
function dimensions(state:PageState){state.element.style.width=`${state.width*scale}px`;state.element.style.height=`${state.height*scale}px`;}
function clearCanvas(state:PageState){
 if(state.task){state.task.cancel();state.task=null;}
 state.canvas.width=state.canvas.height=0;state.rendered=false;
 state.placeholder.hidden=false;state.placeholder.textContent=`Page ${state.number}`;
}
function updateCurrent(){
 if(!pdf)return;const bounds=container.getBoundingClientRect();let best:PageState|null=null,distance=Infinity;
 for(const state of nearby){const rect=state.element.getBoundingClientRect();if(rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue;
  const value=Math.abs(Math.max(rect.top,bounds.top)-bounds.top);
  if(value<distance){distance=value;best=state;}
 }
 if(best){pageNumber=best.number;controls();}
}
async function paint(){
 if(running||!pdf)return;running=true;
 try{
  while(true){
   const state=[...nearby].find(item=>!item.rendered&&!item.failed);if(!state)break;
   const version=generation;state.rendered=true;
   try{
    const page=await pdf.getPage(state.number);if(version!==generation||!nearby.has(state)){state.rendered=false;continue;}
    const base=page.getViewport({scale:1});state.width=base.width;state.height=base.height;dimensions(state);
    const viewport=page.getViewport({scale});
    const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(8000000/(viewport.width*viewport.height)));
    // Render off-screen and swap in, so the previous bitmap stays visible until the new one is ready.
    const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PDF page ${state.number} of ${pdf.numPages}`);
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    const task=page.render({canvasContext:canvas.getContext('2d')!,viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});state.task=task;
    try{await task.promise;}finally{if(state.task===task)state.task=null;}
    if(version!==generation){state.rendered=false;continue;}
    state.canvas.replaceWith(canvas);state.canvas=canvas;state.placeholder.hidden=true;
    // Text extraction is for screen readers only; never hold up the next page for it.
    if(!state.texted){state.texted=true;page.getTextContent().then(text=>{state.text.textContent=text.items.map(item=>item.str||'').join(' ');},()=>{state.texted=false;});}
    if(!nearby.has(state))clearCanvas(state);
   }catch(error){
    if(version!==generation||(error as Error|null|undefined)?.name==='RenderingCancelledException'){state.rendered=false;continue;}
    state.failed=true;state.placeholder.hidden=false;state.placeholder.textContent=`Page ${state.number} could not be rendered. Download the original PDF above to read it.`;
   }
  }
 }finally{running=false;}
}
const observer=new IntersectionObserver(entries=>{
 for(const entry of entries){const state=states[Number((entry.target as HTMLElement).dataset.page)-1];if(!state)continue;
  if(entry.isIntersecting)nearby.add(state);else{nearby.delete(state);if(!state.task)clearCanvas(state);}
 }
 updateCurrent();paint();
},{root:container,rootMargin:'800px 0px'});
function jump(number:number){
 if(!pdf||number<1||number>pdf.numPages)return;
 pageNumber=number;controls();const state=states[number-1];container.scrollTop=sheetTop(state);nearby.add(state);paint();
}
// Re-render at the current scale; visible bitmaps stay (stretched by CSS) until their sharp replacement lands.
function refresh(){
 generation++;
 for(const state of states){if(state.task){state.task.cancel();state.task=null;}state.rendered=false;state.failed=false;}
 paint();
}
// Zoom around a point (the pointer, or the viewport centre) so the content under it stays put.
function rescale(next:number,clientX?:number,clientY?:number){
 next=Math.max(.25,Math.min(4,next));if(!pdf||Math.abs(next-scale)<.001)return;
 const bounds=container.getBoundingClientRect();
 const x=clientX??(bounds.left||0)+container.clientWidth/2,y=clientY??(bounds.top||0)+container.clientHeight/2;
 const anchor=[...nearby].find(state=>{const rect=state.element.getBoundingClientRect();return rect.top<=y&&rect.bottom>=y;})||states[pageNumber-1];
 const before=anchor.element.getBoundingClientRect();
 const fx=(x-(before.left||0))/Math.max(1,before.width||1),fy=(y-before.top)/Math.max(1,before.bottom-before.top);
 scale=next;for(const state of states)dimensions(state);controls();
 const after=anchor.element.getBoundingClientRect(),dx=(after.left||0)+fx*(after.width||0)-x,dy=after.top+fy*(after.bottom-after.top)-y;
 if(Number.isFinite(dx)&&after.width)container.scrollLeft+=dx;
 if(Number.isFinite(dy))container.scrollTop+=dy;
 clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,150);
}
function zoom(factor:number,clientX?:number,clientY?:number){autoFit=false;rescale(scale*factor,clientX,clientY);}
async function fit(){
 if(!pdf)return;autoFit=true;lastFitWidth=container.clientWidth;if(!lastFitWidth)return;
 const first=await pdf.getPage(pageNumber),width=first.getViewport({scale:1}).width;
 const bounds=container.getBoundingClientRect();
 rescale((lastFitWidth-GUTTER)/width,undefined,(bounds.top||0)+1);
}
new ResizeObserver(()=>{if(pdf&&autoFit&&container.clientWidth!==lastFitWidth)fit();}).observe(container);
// Cmd/Ctrl+wheel zooms; trackpad pinch arrives as a ctrlKey wheel with small deltas.
container.addEventListener('wheel',event=>{
 if(!pdf||!(event.ctrlKey||event.metaKey))return;
 event.preventDefault();
 const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?container.clientHeight||800:1);
 zoom(Math.exp(-Math.max(-60,Math.min(60,delta))/300),event.clientX,event.clientY);
},{passive:false});
window.addEventListener('keydown',event=>{
 // Focus inside this frame hides keys from VTOP, so hand Escape and Cmd/Ctrl+K to the preview shell.
 if(event.key==='Escape'&&!event.isComposing){event.preventDefault();notify('viewer-key',{key:'Escape'});return;}
 if(menuKey.matches(event)){event.preventDefault();notify('viewer-key',{key:event.key,code:event.code,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey});return;}
 if(!pdf||!(event.ctrlKey||event.metaKey)||event.altKey)return;
 if(['+','='].includes(event.key)){event.preventDefault();zoom(1.2);}
 else if(['-','_'].includes(event.key)){event.preventDefault();zoom(1/1.2);}
 else if(event.key==='0'){event.preventDefault();fit();}
});
container.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=null;updateCurrent();});},{passive:true});
window.addEventListener('message',async(event:MessageEvent<PdfDataMessage|null|undefined>)=>{
 if(received||event.source!==parent||event.origin!==parentOrigin||event.data?.type!=='pdf-data'||event.data.nonce!==nonce||Object.prototype.toString.call(event.data.bytes)!=='[object ArrayBuffer]')return;
 received=true;notify('viewer-received');
 const documentType=event.data.documentType||'pdf';
 document.documentElement.dataset.type=documentType;
 if(['pptx','ppt','docx','doc'].includes(documentType)){
  status(documentType==='pptx'||documentType==='ppt'?'Opening presentation…':'Opening document…');
  try{
   if(documentType==='pptx'){
    const {renderPptx}=await import('./pptx-viewer.mjs');
    await renderPptx(event.data.bytes,container);
   }else if(documentType==='ppt'){
    const {renderLegacyPpt}=await import('./ppt-viewer.mjs');
    await renderLegacyPpt(event.data.bytes,container);
   }else{
    const {renderWord}=await import('./word-viewer.mjs');
    await renderWord(event.data.bytes,container,documentType);
   }
   status('');notify('viewer-loaded');
  }catch(error){
   console.error('Unable to render document.',error);
   status('This document could not be opened. You can still download the original using Download above.');
   notify('viewer-error');
  }
  return;
 }
 status('Opening PDF…');
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  // VTOP's PDFs often carry malformed form fields and font hints; PDF.js recovers, so only real errors are logged.
  const task=pdfjs.getDocument({data:new Uint8Array(event.data.bytes),verbosity:pdfjs.VerbosityLevel.ERRORS,isEvalSupported:false,useWasm:false,useSystemFonts:true,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href});
  // A worker that never answers must not leave the viewer stuck; password prompts wait for the user.
  timer=setTimeout(()=>task.destroy(),30000);
  task.onPassword=(updatePassword,reason)=>{clearTimeout(timer);status(reason===2?'Incorrect password. Try again.':'This PDF is password protected.');$('#password-form').hidden=false;$('#password').focus();$('#password-form').onsubmit=event=>{event.preventDefault();updatePassword($<HTMLInputElement>('#password').value);$<HTMLInputElement>('#password').value='';$('#password-form').hidden=true;};};
  pdf=await task.promise;clearTimeout(timer);$('#total').textContent=`/ ${pdf.numPages}`;$<PageInput>('#page').max=pdf.numPages;
  const first=await pdf.getPage(1),base=first.getViewport({scale:1});
  // Before layout the width is 0; the ResizeObserver fits once the frame has a size.
  lastFitWidth=container.clientWidth;scale=lastFitWidth?Math.max(.25,Math.min(4,(lastFitWidth-GUTTER)/base.width)):1;
  for(let number=1;number<=pdf.numPages;number++){
   const element=document.createElement('section');element.className='sheet';element.dataset.page=number as unknown as string/* the DOM stringifies it */;element.setAttribute('role','group');element.setAttribute('aria-label',`PDF page ${number} of ${pdf.numPages}`);
   const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`PDF page ${number} of ${pdf.numPages}`);
   const placeholder=document.createElement('div');placeholder.className='page-placeholder';placeholder.textContent=`Page ${number}`;
   const text=document.createElement('div');text.className='sr-only';
   element.append(canvas,placeholder,text);container.append(element);
   const state:PageState={number,element,canvas,placeholder,text,width:base.width,height:base.height,rendered:false,task:null};states.push(state);dimensions(state);observer.observe(element);
  }
  for(const control of document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('nav button,nav input'))control.disabled=false;
  status('');jump(1);notify('viewer-loaded',{pages:pdf.numPages});
 }catch{clearTimeout(timer);status('This PDF could not be opened. You can still download the original using Download above.');notify('viewer-error');}
});
$('#page').addEventListener('change',()=>{const value=Number($<PageInput>('#page').value);if(pdf&&Number.isInteger(value)&&value>=1&&value<=pdf.numPages)jump(value);else $<PageInput>('#page').value=pageNumber;});
$('#zoom-in').addEventListener('click',()=>zoom(1.2));
$('#zoom-out').addEventListener('click',()=>zoom(1/1.2));
$('#fit').addEventListener('click',fit);
notify('viewer-ready');
