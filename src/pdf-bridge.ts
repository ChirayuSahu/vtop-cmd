// Runs in VTOP's MAIN world to preserve its authenticated download requests.
(() => {
  'use strict';
  type BridgeWindow = Window & { __vtopCommandPdfBridge?: boolean };
  // window.open() also receives URL objects or nothing; new URL() stringifies either.
  type URLInput = string | URL | undefined;
  // Buttons and inputs carry name and value; other controls leave them undefined.
  type Control = Element & { name?: string; value?: string };
  // A synthetic click may be a plain Event without modifier keys.
  type ModifierKeys = Partial<Pick<MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>>;
  const marker = '__vtopCommandPdfBridge';
  if ((window as BridgeWindow)[marker]) return;
  (window as BridgeWindow)[marker] = true;
  const originalOpen = window.open;
  const originalClick = HTMLAnchorElement.prototype.click;
  const originalSubmit = HTMLFormElement.prototype.submit;
  const nativeFetch = window.fetch.bind(window);
  const createURL = URL.createObjectURL.bind(URL);
  const revokeURL = URL.revokeObjectURL.bind(URL);
  const pdfBlobs = new Map<string, Blob>();
  URL.createObjectURL = function (blob) {
    const url = createURL(blob);
    // Untyped blobs are common for AJAX downloads; preview() sniffs the bytes before showing them.
    // VTOP's downloadFileWithProgress revokes right after click(), so keep the Blob itself for preview().
    if (blob instanceof Blob && /^$|application\/(?:pdf|octet-stream|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml\.presentation)/i.test(blob.type)) pdfBlobs.set(url,blob);
    return url;
  };
  URL.revokeObjectURL = function (url) { pdfBlobs.delete(url); return revokeURL(url); };
  const nativeURLs = new Set<string>();
  let sequence = 0;
  let bypassClick = false;
  let downloadIntent: { time: number } | null = null;
  const downloadHint = (value: string) => /\b(?:pdf|pptx?|powerpoint|presentation|slides?)\b|download|dwnld|curriculdown/i.test(value || '');
  function localURL(value: URLInput) {
    try {const url=new URL(value as string | URL,document.baseURI);return url.origin===location.origin&&url.pathname.startsWith('/vtop/');} catch {return false;}
  }
  function pendingDownload() {return downloadIntent && Date.now()-downloadIntent.time<10000;}
  function controlHint(control: Control | null | undefined) {
    if (!control) return '';
    // Icon-only buttons carry intent in classes such as fa-download or fa-file-pdf.
    const classes = [control,...control.querySelectorAll('[class]')].map(node => node.getAttribute('class'));
    return [control.id,control.name,control.textContent,control.getAttribute('aria-label'),control.getAttribute('title'),control.value,...classes].filter(Boolean).join(' ');
  }
  function candidate(value: URLInput) {
    try {
      const url = new URL(value as string | URL, document.baseURI);
      return url.origin === location.origin && url.pathname.startsWith('/vtop/') &&
        /\.(?:pdf|pptx?|docx?)$|download|dwnld|curriculdown|viewfile/i.test(decodeURIComponent(url.pathname));
    } catch { return false; }
  }
  function filename(header: string | null | undefined, fallback = 'document.pdf') {
    const encoded = header?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
    const plain = header?.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
    let name = encoded || plain?.[1] || plain?.[2] || fallback;
    try { if (encoded) name = decodeURIComponent(name); } catch {}
    return name.replace(/[\\/\x00-\x1f]/g, '_').trim().slice(0,180) || fallback;
  }
  function emit(kind: string, id: string, extra: Record<string, unknown> = {}) { window.postMessage({ source: 'vtop-command-pdf', kind, id, ...extra }, location.origin); }
  function download(blob: Blob, name: string) {
    const url = createURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.dataset.vtopPdfBypass = 'true'; nativeURLs.add(url);
    document.documentElement.append(anchor); originalClick.call(anchor); anchor.remove();
    setTimeout(() => { nativeURLs.delete(url); revokeURL(url); },60000);
  }
  async function preview(url: string, init?: RequestInit, suggestedName?: string, fallback?: () => void, source?: Blob) {
    downloadIntent=null;
    const id = `pdf-${Date.now()}-${++sequence}`;
    emit('loading',id);
    try {
      const response = source ? null : await nativeFetch(url,{credentials:'same-origin',...init});
      if (response && !response.ok) throw new Error('The document could not be loaded. Your VTOP session may have expired.');
      const blob = source || await response!.blob();
      const header = new Uint8Array(await blob.slice(0,1024).arrayBuffer());
      const isPdf = String.fromCharCode(...header).includes('%PDF-');
      const contentType = response?.headers.get('content-type') || blob.type;
      const contentDisposition = response?.headers.get('content-disposition');
      let pathName = '';
      try { pathName = decodeURIComponent(new URL(url, document.baseURI).pathname.split('/').pop()!); } catch {}
      const name = filename(contentDisposition, suggestedName || pathName || (isPdf ? 'document.pdf' : 'download'));
      const isPptx = /application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation/i.test(contentType) || /\.pptx$/i.test(name);
      const isLegacyPpt = /application\/vnd\.ms-powerpoint/i.test(contentType) || /\.ppt$/i.test(name);
      const isDocx = /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(contentType) || /\.docx$/i.test(name);
      const isLegacyDoc = /application\/msword/i.test(contentType) || /\.doc$/i.test(name);
      if (!isPdf) {
        if (fallback && /text\/html/i.test(contentType)) { emit('not-pdf',id); fallback(); return; }
        if (/text\/html|application\/json/i.test(contentType)) throw new Error('VTOP returned a page instead of a document. Sign in again and retry.');
        if (isPptx || isLegacyPpt || isDocx || isLegacyDoc) {
          const bytes = await blob.arrayBuffer();
          const documentType = isPptx ? 'pptx' : isLegacyPpt ? 'ppt' : isDocx ? 'docx' : 'doc';
          emit('ready',id,{bytes,filename:name,documentType});
          return;
        }
        download(blob,name); emit('not-pdf',id); return;
      }
      // Send bytes directly; Firefox content scripts cannot reliably fetch page-owned blob URLs.
      const bytes = await blob.arrayBuffer();
      emit('ready',id,{bytes,filename:name,documentType:'pdf'});
    } catch (error) { emit('error',id,{message:(error as Error).message || 'Unable to preview this document.'}); }
  }
  function handleAnchor(anchor: HTMLAnchorElement) {
    if (bypassClick || anchor.dataset.vtopPdfBypass === 'true') return false;
    const rawHref=anchor.getAttribute('href')||'';
    // Menu entries and JavaScript helpers must run their native handlers first.
    if(!rawHref||/^\s*(?:#|javascript:)/i.test(rawHref)||anchor.matches('.systemB5BtnMenu,.systemBtnMenu,.quickB5MainMenu,[data-bs-toggle]'))return false;
    const url = anchor.href;
    const isBlob = url.startsWith(`blob:${location.origin}/`) && (anchor.hasAttribute('download') || pdfBlobs.has(url));
    const isDataPdf=/^data:application\/pdf(?:[;,])/i.test(url);
    const explicitFile=localURL(url)&&(anchor.hasAttribute('download')||anchor.type==='application/pdf'||downloadHint(controlHint(anchor)));
    if (!candidate(url) && !isBlob && !isDataPdf && !explicitFile) return false;
    preview(url,undefined,anchor.download || undefined,undefined,pdfBlobs.get(url)); return true;
  }
  // vtopDownload() opens `<endpoint>?authorizedID=…&_csrf=…`; a CSRF token in a popup URL marks a download.
  const tokenURL = (value: URLInput) => { try { return new URL(value as string | URL,document.baseURI).searchParams.has('_csrf'); } catch { return false; } };
  window.open = function (url, ...args) {
    if (!bypassClick && (candidate(url) || pdfBlobs.has(url as string) || /^data:application\/pdf(?:[;,])/i.test(String(url)) || localURL(url)&&(pendingDownload()||tokenURL(url)))) {
      const href = new URL(url as string | URL,document.baseURI).href;
      // Only the token heuristic may be wrong about a page; known download endpoints keep the session-expired error.
      const fallback = candidate(url) || pdfBlobs.has(href) ? undefined : () => originalOpen.call(window,href,...args);
      preview(href,undefined,undefined,fallback,pdfBlobs.get(href)); return null;
    }
    return originalOpen.call(this,url,...args);
  };
  HTMLAnchorElement.prototype.click = function (...args) {
    if (!handleAnchor(this)) return originalClick.apply(this,args);
  };
  // FileSaver-style helpers dispatch a synthetic click on a detached anchor, which the document listener never sees.
  const nativeDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event: Event & ModifierKeys) {
    if (this instanceof HTMLAnchorElement && !this.isConnected && event?.type === 'click' &&
      !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) && handleAnchor(this)) return false;
    return nativeDispatch.call(this,event);
  };
  document.addEventListener('click',event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      downloadIntent=null;bypassClick=true;setTimeout(()=>{bypassClick=false;},0);return;
    }
    const control=(event.target as Partial<Element>).closest?.('button,a,input[type="button"],input[type="submit"],[role="button"]');
    downloadIntent=downloadHint(controlHint(control))?{time:Date.now()}:null;
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = (event.target as Partial<Element>).closest?.<HTMLAnchorElement>('a[href]');
    if (anchor && handleAnchor(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); }
  },true);
  function handleForm(form: HTMLFormElement, submitter?: HTMLButtonElement | HTMLInputElement | null) {
    if(bypassClick)return false;
    const url = new URL(submitter?.getAttribute('formaction') || form.action,document.baseURI);
    const intendedDownload=downloadHint(`${form.id} ${form.name} ${controlHint(submitter)}`)||pendingDownload();
    if (!localURL(url.href) || (!candidate(url.href)&&!intendedDownload) || form.querySelector('input[type=file]')) return false;
    const method = (submitter?.getAttribute('formmethod') || form.method || 'get').toUpperCase();
    if (!['GET','POST'].includes(method)) return false;
    const fields = new FormData(form);
    if (submitter?.name) fields.append(submitter.name,submitter.value);
    const params = new URLSearchParams(fields as unknown as string[][]/* lib.dom omits FormData; file forms never get here */);
    if (method === 'GET') { for (const [key,value] of params) url.searchParams.append(key,value); preview(url.href); }
    else if (form.enctype === 'multipart/form-data') preview(url.href,{method,body:fields});
    else if (form.enctype === 'application/x-www-form-urlencoded') preview(url.href,{method,body:params});
    else return false;
    return true;
  }
  // Catch-all for location.href/assign, native form submissions and downloads the hooks above cannot see.
  // Strictly read-only: a POST is only taken over for an explicit download endpoint and is never replayed,
  // so VTOP never receives a request twice; only GET navigations fall back to the native page.
  window.navigation?.addEventListener?.('navigate',event => {
    if (bypassClick || !event.cancelable || event.hashChange || ['reload','traverse'].includes(event.navigationType)) return;
    const url = event.destination?.url;
    if (!url || nativeURLs.has(url) || [...(event.formData?.values() || [])].some(value => typeof value !== 'string')) return;
    const isDownload = event.downloadRequest != null;
    const isBlob = url.startsWith(`blob:${location.origin}/`) && (isDownload || pdfBlobs.has(url));
    const isDataPdf = /^data:application\/pdf(?:[;,])/i.test(url);
    const fields = event.formData;
    if (fields ? !candidate(url) : !candidate(url) && !isBlob && !isDataPdf && !(localURL(url) && (isDownload || pendingDownload()))) return;
    event.preventDefault();
    preview(url,fields ? {method:'POST',body:fields} : undefined,event.downloadRequest || undefined,fields ? undefined : () => {
      // A GET that merely looks like a download is opened natively instead of being shown as an error.
      nativeURLs.add(url); setTimeout(() => nativeURLs.delete(url),10000); location.assign(url);
    });
  });
  HTMLFormElement.prototype.submit = function (...args) { if (!handleForm(this)) return originalSubmit.apply(this,args); };
  document.addEventListener('submit',event=>{
    if (!event.defaultPrevented && handleForm(event.target as HTMLFormElement,event.submitter as HTMLButtonElement | HTMLInputElement | null)) {event.preventDefault();event.stopImmediatePropagation();}
  },true);
})();
