(() => {
  'use strict';
  if (document.getElementById('vtop-pdf-preview')) return;
  const host=document.createElement('div');host.id='vtop-pdf-preview';
  const shadow=host.attachShadow({mode:'open'});
  const { logo, tokens, font, shortcut } = globalThis.VtopBrand;
  // Viewer frame → preview: lifecycle notices and forwarded keys, tagged with the frame's nonce.
  interface ViewerMessage { type?: 'viewer-ready'|'viewer-received'|'viewer-loaded'|'viewer-error'|'viewer-key'; nonce?: string; key?: string; code?: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }
  // pdf-bridge → preview on this window; `id` and `bytes` are checked before use.
  interface BridgeMessage { source?: string; id?: unknown; kind?: 'loading'|'not-pdf'|'error'|'ready'; bytes?: unknown; filename?: unknown; documentType?: string; nativeDownload?: unknown }
  // Either kind may arrive on the one listener, so every field is optional until checked.
  type IncomingMessage = Partial<ViewerMessage & BridgeMessage> | null | undefined;
  // Same surface, header and button language as the command menu (content.js).
  globalThis.VtopBrand.setMarkup(shadow, `<style>
    :host{all:initial;color-scheme:light;${tokens.themes.light};font:${font};color:var(--text)}
    :host([data-theme="dark"]){color-scheme:dark;${tokens.themes.dark}}:host([data-theme="oled"]){color-scheme:dark;${tokens.themes.oled}}:host([data-theme="blue"]){color-scheme:dark;${tokens.themes.blue}}
    *{box-sizing:border-box}
    dialog{padding:0;margin:auto;width:min(1200px,calc(100vw - 28px));height:calc(100vh - 48px);max-width:none;max-height:none;border:1px solid var(--line);border-radius:20px;background:var(--surface);color:var(--text);box-shadow:0 24px 100px #0005;overflow:hidden}
    dialog[open]{display:flex;flex-direction:column}
    dialog::backdrop{background:#10182788;backdrop-filter:blur(5px)}
    header{display:flex;gap:12px;align-items:center;padding:16px 22px 14px}
    .brand{display:flex;align-items:center;gap:9px;flex-shrink:0;font-size:11px;font-weight:750;letter-spacing:2px;color:var(--muted)}.logo{display:block;flex-shrink:0;width:24px;height:24px}
    h2{margin:0 0 0 6px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:550}
    .download,.close{font:inherit;font-size:12px;border:1px solid var(--line);border-radius:8px;color:var(--muted);background:transparent;padding:5px 8px;text-decoration:none;cursor:pointer;white-space:nowrap}
    .download:hover,.close:hover{background:var(--hover);color:var(--text)}
    :is(.download,.close):focus-visible{outline:2px solid var(--accent);outline-offset:3px}
    [hidden]{display:none!important}
    .status{padding:12px 22px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}.status:empty{display:none}
    iframe{display:block;width:100%;flex:1;min-height:0;border:0;background:var(--surface)}
    @media(max-width:480px){.brand-text{display:none}header{padding:12px 14px}}
    @media(prefers-reduced-motion:no-preference){dialog[open]{animation:arrive .13s ease-out}@keyframes arrive{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}}
  </style><dialog aria-label="Document preview"><header><span class="brand">${logo}<span class="brand-text">VTOP / PREVIEW</span></span><h2>Document preview</h2><a class="download" hidden>Download</a><button class="close" type="button" aria-label="Close document preview">Esc</button></header><div class="status" role="status" aria-live="polite"></div></dialog>`);
  document.documentElement.append(host);
  const dialog=shadow.querySelector('dialog')!,status=shadow.querySelector<HTMLDivElement>('.status')!,download=shadow.querySelector<HTMLAnchorElement>('.download')!;
  const viewerURL=chrome.runtime.getURL('pdf-viewer.html');
  const parsedViewerURL=new URL(viewerURL);
  const viewerOrigin=parsedViewerURL.protocol==='moz-extension:' ? `${parsedViewerURL.protocol}//${parsedViewerURL.host}` : parsedViewerURL.origin;
  let activeId: string|null|undefined,blobURL: string|null|undefined,previousFocus: (Element & HTMLOrSVGElement)|null|undefined,nonce: string|undefined,bytes: ArrayBuffer|null|undefined,filename: string|undefined,documentType: string|undefined,frame: HTMLIFrameElement|null|undefined,received: boolean|undefined,watchdog: ReturnType<typeof setTimeout>|undefined,theme:VtopTheme='light',nativeDownload=false;
  const validTheme=(value:unknown):value is VtopTheme=>['light','dark','oled','blue'].includes(String(value));
  function downloadName(value: unknown, type: string) {
    let name=String(value||'document').replace(/[\\/\x00-\x1f]/g,'_').trim().slice(0,180);
    try { if (/%[0-9a-f]{2}/i.test(name)) name=decodeURIComponent(name); } catch {}
    const extension=type==='pptx'?'.pptx':type==='ppt'?'.ppt':type==='docx'?'.docx':type==='doc'?'.doc':type==='unsupported'?'':'.pdf';
    if (!extension) return name || 'document';
    return new RegExp(`\\${extension}$`,'i').test(name) ? name : `${name.replace(/\.[a-z0-9]{1,5}$/i,'')||'document'}${extension}`;
  }
  function setTheme(value:unknown){theme=validTheme(value)?value:'light';host.dataset.theme=theme;host.toggleAttribute('data-dark',theme!=='light');}
  try {
    chrome.storage.local.get(['theme','darkMode']).then(settings=>setTheme(settings.theme ?? (settings.darkMode===true?'blue':'light'))).catch(()=>{});
    chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.theme)setTheme(changes.theme.newValue);else if(area==='local'&&changes.darkMode)setTheme(changes.darkMode.newValue===true?'blue':'light');});
  } catch { /* Preview without the extension runtime. */ }
  function release(){ clearTimeout(watchdog);if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;bytes=null;nativeDownload=false;frame?.remove();frame=null;download.removeAttribute('href');download.hidden=true; }
  function deliver(){ if(bytes&&frame?.contentWindow&&!received)frame.contentWindow.postMessage({type:'pdf-data',nonce,bytes:bytes.slice(0),filename,documentType},viewerOrigin); }
  // A new frame per document: reusing one turns viewer#a → viewer#b into a hash-only navigation that never reloads.
  function mount(type: string){
    nonce=crypto.randomUUID();received=false;
    frame=document.createElement('iframe');frame.title='Document viewer';frame.addEventListener('load',deliver);
    // The theme rides along in the URL so the viewer paints in the right colours from the first frame.
    frame.src=`${viewerURL}?theme=${theme}&type=${encodeURIComponent(type)}#${nonce}`;dialog.append(frame);
    watchdog=setTimeout(()=>{status.textContent='The viewer did not respond. Use Download to save the document, or retry the link.';},15000);
  }
  function close(){if(dialog.open)dialog.close();}
  shadow.querySelector<HTMLButtonElement>('.close')!.addEventListener('click',close);
  // Modifier-clicking a blob URL is normally treated as navigation by browsers. Keep Download a download:
  // create a short-lived page anchor marked for the MAIN-world bridge to leave alone.
  download.addEventListener('click',event=>{
    if(nativeDownload&&activeId){event.preventDefault();window.postMessage({source:'vtop-command-pdf-download',id:activeId},location.origin);return;}
    if(!(event.shiftKey||event.ctrlKey||event.metaKey||event.altKey)||!download.href)return;
    event.preventDefault();
    const native=document.createElement('a');
    native.href=download.href; native.download=download.download; native.dataset.vtopPdfBypass='true';
    document.documentElement.append(native); native.click(); native.remove();
  });
  // A click on the backdrop (outside the dialog box) closes it, like the command menu.
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
  dialog.addEventListener('close',()=>{activeId=null;release();if(previousFocus?.isConnected)previousFocus.focus();});
  function show(id: string){
    if(!dialog.open){previousFocus=document.activeElement as (Element & HTMLOrSVGElement)|null;dialog.showModal();}
    activeId=id;release();shadow.querySelector('h2')!.textContent='Document preview';status.textContent='Loading document…';
  }
  window.addEventListener('message',async (event: MessageEvent<IncomingMessage>)=>{
    if(frame && event.source===frame.contentWindow){
      if((event.origin!==viewerOrigin && event.origin!=='null') || event.data?.nonce!==nonce)return;
      // Past the nonce check event.data is a viewer message (a frame always has a nonce), hence the `!`s below.
      const type=event.data?.type;
      if(type==='viewer-ready')deliver();
      else if(type==='viewer-received')received=true;
      else if(type==='viewer-loaded'||type==='viewer-error'){clearTimeout(watchdog);if(type==='viewer-loaded')status.textContent='';}
      // Keys pressed inside the viewer frame never reach this document; the viewer forwards them.
      else if(type==='viewer-key'&&event.data!.key==='Escape')close();
      else if(type==='viewer-key'&&event.data!.key!=='Escape'){
        const forwarded=Object.hasOwn(event.data!,'ctrlKey')?event.data!:shortcut.eventInit();
        close();document.dispatchEvent(new KeyboardEvent('keydown',{key:forwarded.key,code:forwarded.code||'',metaKey:forwarded.metaKey===true,ctrlKey:forwarded.ctrlKey===true,altKey:forwarded.altKey===true,shiftKey:forwarded.shiftKey===true,bubbles:true,cancelable:true}));
      }
      return;
    }
    const message=event.data;
    if(event.source!==window || event.origin!==location.origin || message?.source!=='vtop-command-pdf' || typeof message.id!=='string' || !/^pdf-\d+-\d+$/.test(message.id))return;
    if(message.kind==='loading'){show(message.id);return;}
    if(message.id!==activeId)return;
    if(message.kind==='not-pdf'){close();return;}
    if(message.kind==='error'){status.textContent='Unable to load this document. Sign in again if needed, or Shift-click its original download link.';return;}
    if(message.kind!=='ready')return;
    const id=message.id;
    try{
      if(Object.prototype.toString.call(message.bytes)!=='[object ArrayBuffer]')throw new Error('Missing PDF data');
      const data=message.bytes as ArrayBuffer; // Checked by its toString tag just above.
      if(id!==activeId || !dialog.open)return;
      documentType=message.documentType || (new TextDecoder().decode(data.slice(0,5))==='%PDF-'?'pdf':'unsupported');
      nativeDownload=message.nativeDownload===true;
      filename=downloadName(message.filename,documentType);
      const mime=documentType==='pptx'?'application/vnd.openxmlformats-officedocument.presentationml.presentation':documentType==='ppt'||documentType==='unsupported'?'application/vnd.ms-powerpoint':documentType==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':documentType==='doc'?'application/msword':'application/pdf';
      bytes=data;blobURL=URL.createObjectURL(new Blob([data],{type:mime}));
      download.href=blobURL;download.download=filename;download.hidden=false;
      shadow.querySelector('h2')!.textContent=filename;
      if(documentType==='unsupported'){status.textContent='This file type cannot be previewed here. Use Download to open it in a compatible app.';return;}
      status.textContent='';mount(documentType);
    }catch{if(id===activeId)status.textContent='Unable to open this document. Retry the link, or Shift-click it to use the original download.';}
  });
  // Shortcut stays usable without placing the command menu behind an open preview.
  document.addEventListener('keydown',event=>{if(dialog.open&&shortcut.matches(event))close();},true);
})();
