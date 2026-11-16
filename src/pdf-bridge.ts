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
    if (blob instanceof Blob && /^$|application\/(?:pdf|octet-stream|msword|vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.(?:presentationml\.presentation|wordprocessingml\.document))/i.test(blob.type)) pdfBlobs.set(url,blob);
    return url;
  };
  URL.revokeObjectURL = function (url) { pdfBlobs.delete(url); return revokeURL(url); };
  const nativeURLs = new Set<string>();
  let sequence = 0;
  let bypassClick = false;
  let bypassTimer: ReturnType<typeof setTimeout> | undefined;
  let downloadIntent: { time: number; name?: string; materialName?: string; saveOnly?: boolean } | null = null;
  let materialAction: 'preview' | 'download' | undefined;
  const downloadHint = (value: string) => /\b(?:pdf|pptx?|powerpoint|presentation|slides?)\b|download|dwnld|curriculdown/i.test(value || '');
  function localURL(value: URLInput) {
    try {const url=new URL(value as string | URL,document.baseURI);return url.origin===location.origin&&url.pathname.startsWith('/vtop/');} catch {return false;}
  }
  function pendingDownload() {return downloadIntent && Date.now()-downloadIntent.time<10000;}
  const cleanText = (value: string | null) => (value || '').replace(/\s+/g,' ').trim();
  function materialHeader(table: HTMLTableElement) {
    return [...table.rows].find(row => [...row.cells].some(cell => /^material\s+detail$/i.test(cleanText(cell.textContent))) &&
      [...row.cells].some(cell => /^course\s+detail$/i.test(cleanText(cell.textContent))));
  }
  function materialContext(control: Element | null | undefined, knownHeader?: HTMLTableRowElement) {
    const row = control?.closest('tr'), table = row?.closest('table');
    if (!row || !table) return;
    // VTOP also uses tbody/td for header rows, rather than always thead/th.
    const header = knownHeader || materialHeader(table);
    if (!header || header === row) return;
    const cells = [...header.cells];
    const material = row.cells[cells.findIndex(cell => /^material\s+detail$/i.test(cleanText(cell.textContent)))];
    const action = row.cells[cells.findIndex(cell => /^(?:download|actions?)$/i.test(cleanText(cell.textContent)))];
    if (!material || !action) return;
    // The lines below the title contain the module number and '(Document)'.
    const range = document.createRange(); range.selectNodeContents(material);
    const lineBreak = material.querySelector('br'); if (lineBreak) range.setEndBefore(lineBreak);
    const title = cleanText(range.toString());
    return title ? { title: filename(null,title), action } : undefined;
  }
  function materialFilename(title: string, original: string) {
    const extension = original.match(/\.[a-z0-9]{1,10}$/i)?.[0] || '';
    if (!extension || title.toLowerCase().endsWith(extension.toLowerCase())) return title;
    return title.replace(/\.(?:pdf|pptx?|docx?)$/i,'') + extension;
  }
  const genericName = (value: string) => /^(?:(?:download|view|open)(?:\s+(?:as\s+)?(?:pdf|file|document))?|file|pdf|document|question paper)$/i.test(value.trim());
  const vtopFilename = /^(?:FALL|WINTER|SUMMER|SPRING)SEM\d{4}-\d{2,4}_[A-Z]{2,4}_[A-Z]{2,}\d+[A-Z]?_/i;
  function opaqueFilename(value: string) {
    const stem = value.replace(/\.[^.]+$/, '');
    return vtopFilename.test(stem) ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(stem) ||
      /^[a-f0-9]{16,}$/i.test(stem) ||
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9_-]{6,}$/.test(stem);
  }
  function descriptiveName(value: string | null | undefined) {
    if (!value) return undefined;
    const name = filename(null, value);
    const stem = name.replace(/\.(?:pdf|pptx?|docx?)$/i, '');
    return name && !genericName(stem) && !opaqueFilename(name) && !/^\d+$/.test(stem) ? name : undefined;
  }
  function contextFilename(control: Element | null | undefined): string | undefined {
    if (!control) return undefined;
    const candidates = [
      control.getAttribute('data-filename'), control.getAttribute('data-file-name'),
      control.getAttribute('download'), control.getAttribute('title'), control.getAttribute('aria-label'),
      control.textContent?.replace(/\s+/g, ' ').trim()
    ];
    const named = candidates.map(descriptiveName).find(Boolean);
    if (named) return named;
    const row = control.closest('tr');
    const cells = [...(row?.querySelectorAll('td,th') || [])];
    const headers = [...(row?.closest('table')?.querySelectorAll('thead th,thead td') || [])];
    const titleIndex = headers.findIndex(cell => /^(?:(?:document|file|assignment|material)\s*(?:name|title)|title|topic)$/i.test(cell.textContent || ''));
    const title = descriptiveName(cells[titleIndex]?.textContent?.trim());
    if (title) return title;
    return cells.filter(cell => !cell.contains(control))
      .map(cell => descriptiveName(cell.textContent?.replace(/\s+/g, ' ').trim()))
      .find(Boolean);
  }
  async function pdfTitle(blob: Blob) {
    // VTOP sometimes sends an opaque attachment name but preserves the document's PDF title metadata.
    const bytes = await blob.slice(0,128 * 1024).arrayBuffer();
    const match = /\/Title\s*\(([^()]{2,180})\)/.exec(new TextDecoder().decode(bytes));
    return match?.[1].replace(/\\([()\\])/g,'$1').replace(/\s+/g,' ').trim();
  }
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
    const extended = header?.match(/filename\*\s*=\s*(?:"([^"]+)"|([^;]+))/i);
    const encoded = (extended?.[1] || extended?.[2])?.trim();
    const plain = header?.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
    let name = encoded ? encoded.replace(/^[^']*'[^']*'/, '') : plain?.[1] || plain?.[2]?.trim() || fallback;
    try { if (encoded || /%[0-9a-f]{2}/i.test(name)) name = decodeURIComponent(name); } catch {}
    return name.replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g, '_').trim().replace(/[. ]+$/, '').slice(0,180) || 'document';
  }
  function linkFilename(value: string) {
    try {
      const url = new URL(value,document.baseURI);
      const candidates = [
        ...[...url.searchParams].filter(([key]) => /^(?:file|document|doc)?name$|^(?:file|document|doc)?title$/i.test(key.replace(/[_-]/g,''))).map(([,name]) => ({name})),
        {name:decodeURIComponent(url.pathname.split('/').pop() || '')}
      ];
      return candidates.find(({name:value}) => {
        const name = filename(null,value);
        const stem = name.replace(/\.[^.]+$/,'');
        return !!stem && !genericName(stem) && !opaqueFilename(name) && !/^\d+$/.test(stem);
      })?.name;
    } catch { return undefined; }
  }
  function fileNameWithExtension(name: string, type: 'pdf' | 'pptx' | 'ppt' | 'docx' | 'doc') {
    const extension = `.${type}`;
    return new RegExp(`\\${extension}$`, 'i').test(name) ? name : `${name.replace(/\.[a-z0-9]{1,5}$/i, '') || 'document'}${extension}`;
  }
  // VTOP download handlers often start a popup or synthetic anchor after their click handler returns.
  // Keep the bypass alive long enough for that work, rather than allowing it to re-enter preview interception.
  function bypassPreview() {
    bypassClick = true; clearTimeout(bypassTimer);
    bypassTimer = setTimeout(() => { bypassClick = false; }, 1500);
  }
  function emit(kind: string, id: string, extra: Record<string, unknown> = {}) { window.postMessage({ source: 'vtop-command-pdf', kind, id, ...extra }, location.origin); }
  function download(blob: Blob, name: string) {
    const url = createURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.dataset.vtopPdfBypass = 'true'; nativeURLs.add(url);
    document.documentElement.append(anchor); originalClick.call(anchor); anchor.remove();
    setTimeout(() => { nativeURLs.delete(url); revokeURL(url); },60000);
  }
  async function preview(url: string, init?: RequestInit, suggestedName?: string, fallback?: () => void, source?: Blob, saveOnly = !!(pendingDownload() && downloadIntent?.saveOnly)) {
    const intentName = pendingDownload() ? downloadIntent?.name : undefined;
    const materialName = pendingDownload() ? downloadIntent?.materialName : undefined;
    downloadIntent=null;
    const id = `pdf-${Date.now()}-${++sequence}`;
    if (!saveOnly) emit('loading',id);
    try {
      // VTOP has already fetched this blob. A course filename supplies both the name
      // and extension, so Shift-click can save immediately without inspecting its bytes.
      const sourceName = filename(null, suggestedName || '');
      if (saveOnly && source && vtopFilename.test(sourceName) &&
          /\.(?:pdf|pptx?|docx?)$/i.test(sourceName) && !/text\/html|application\/json/i.test(source.type)) {
        const suffix = sourceName.slice(sourceName.lastIndexOf('_') + 1);
        if (suffix.replace(/\.[^.]+$/, '').trim()) { download(source, materialName ? materialFilename(materialName,sourceName) : suffix); return; }
      }
      const response = source ? null : await nativeFetch(url,{credentials:'same-origin',...init});
      if (response && !response.ok) throw new Error('The document could not be loaded. Your VTOP session may have expired.');
      const blob = source || await response!.blob();
      const header = new Uint8Array(await blob.slice(0,1024).arrayBuffer());
      const isPdf = String.fromCharCode(...header).includes('%PDF-');
      const contentType = response?.headers.get('content-type') || blob.type;
      const contentDisposition = response?.headers.get('content-disposition');
      let pathName = '';
      try { pathName = decodeURIComponent(new URL(url, document.baseURI).pathname.split('/').pop()!); } catch {}
      let name = filename(contentDisposition, suggestedName || pathName || (isPdf ? 'document' : 'download'));
      const linkedName = descriptiveName(suggestedName) || descriptiveName(intentName) || descriptiveName(linkFilename(url));
      const typeName = [name, linkedName, pathName].find(value => value && /\.(?:pptx?|docx?)$/i.test(value)) || '';
      const isPptx = /application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation/i.test(contentType) || /\.pptx$/i.test(typeName);
      const isLegacyPpt = /application\/vnd\.ms-powerpoint/i.test(contentType) || /\.ppt$/i.test(typeName);
      const isDocx = /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i.test(contentType) || /\.docx$/i.test(typeName);
      const isLegacyDoc = /application\/msword/i.test(contentType) || /\.doc$/i.test(typeName);
      // Course Page names encode semester/course/date before the final document name.
      const documentSuffix = vtopFilename.test(name) ? name.slice(name.lastIndexOf('_') + 1) : undefined;
      let previewName = name;
      if ((isPdf || isPptx || isLegacyPpt || isDocx || isLegacyDoc) && opaqueFilename(name)) {
        const title = isPdf && (!saveOnly || !(documentSuffix || linkedName)) ? await pdfTitle(blob) : undefined;
        previewName = title && !genericName(title) ? title : suggestedName || 'VTOP document';
        name = documentSuffix || linkedName || descriptiveName(title) || 'VTOP document';
      }
      name = filename(null, name);
      previewName = filename(null, previewName);
      if (isPdf) { name = fileNameWithExtension(name, 'pdf'); previewName = fileNameWithExtension(previewName, 'pdf'); }
      else if (isPptx) { name = fileNameWithExtension(name, 'pptx'); previewName = fileNameWithExtension(previewName, 'pptx'); }
      else if (isLegacyPpt) { name = fileNameWithExtension(name, 'ppt'); previewName = fileNameWithExtension(previewName, 'ppt'); }
      else if (isDocx) { name = fileNameWithExtension(name, 'docx'); previewName = fileNameWithExtension(previewName, 'docx'); }
      else if (isLegacyDoc) { name = fileNameWithExtension(name, 'doc'); previewName = fileNameWithExtension(previewName, 'doc'); }
      if (materialName) { name = materialFilename(materialName,name); previewName = name; }
      if (!isPdf && /text\/html|application\/json/i.test(contentType)) {
        if (fallback && !saveOnly && /text\/html/i.test(contentType)) { emit('not-pdf',id); fallback(); return; }
        throw new Error('VTOP returned a page instead of a document. Sign in again and retry.');
      }
      if (saveOnly) { download(blob,name); return; }
      if (!isPdf) {
        if (isPptx || isLegacyPpt || isDocx || isLegacyDoc) {
          const bytes = await blob.arrayBuffer();
          const documentType = isPptx ? 'pptx' : isLegacyPpt ? 'ppt' : isDocx ? 'docx' : 'doc';
          emit('ready',id,{bytes,filename:name,previewName,documentType});
          return;
        }
        download(blob,name); emit('not-pdf',id); return;
      }
      // Send bytes directly; Firefox content scripts cannot reliably fetch page-owned blob URLs.
      const bytes = await blob.arrayBuffer();
      emit('ready',id,{bytes,filename:name,previewName,documentType:'pdf'});
    } catch (error) {
      if (fallback && !saveOnly) { emit('not-pdf',id); fallback(); return; }
      if (saveOnly) emit('loading',id);
      emit('error',id,{message:(error as Error).message || 'Unable to preview this document.'});
    }
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
    const material = materialContext(anchor);
    if (material) downloadIntent = {time:Date.now(),...downloadIntent,materialName:material.title};
    // VTOP has already received this file and is about to save its own blob URL.
    // Rename that link in place for Shift-click instead of starting another save.
    const sourceName=filename(null,anchor.download);
    if (isBlob && pendingDownload() && downloadIntent?.saveOnly && vtopFilename.test(sourceName) &&
        /\.(?:pdf|pptx?|docx?)$/i.test(sourceName) && !/text\/html|application\/json/i.test(pdfBlobs.get(url)?.type || '')) {
      const suffix=sourceName.slice(sourceName.lastIndexOf('_')+1);
      if (suffix.replace(/\.[^.]+$/,'').trim()) {
        const materialName=downloadIntent.materialName;
        downloadIntent=null;
        anchor.download=materialName ? materialFilename(materialName,sourceName) : suffix;anchor.dataset.vtopPdfBypass='true';
        nativeURLs.add(url);setTimeout(()=>nativeURLs.delete(url),10000);
        originalClick.call(anchor);return true;
      }
    }
    // Some VTOP handlers rely on browser navigation semantics that a fetch cannot reproduce. If previewing
    // fails, replay the original anchor click once with this bridge bypassed so the browser can still download it.
    const fallback = () => {
      bypassPreview(); originalClick.call(anchor);
    };
    preview(url,undefined,(vtopFilename.test(anchor.download) ? anchor.download : contextFilename(anchor)) || (pendingDownload() ? downloadIntent?.name : undefined),fallback,pdfBlobs.get(url)); return true;
  }
  function downloadAnchor(anchor: HTMLAnchorElement) {
    const rawHref=anchor.getAttribute('href')||'';
    if(!rawHref||/^\s*(?:#|javascript:)/i.test(rawHref)||anchor.matches('.systemB5BtnMenu,.systemBtnMenu,.quickB5MainMenu,[data-bs-toggle]'))return false;
    const url=anchor.href;
    const isBlob=url.startsWith(`blob:${location.origin}/`) && (anchor.hasAttribute('download')||pdfBlobs.has(url));
    const isDataPdf=/^data:application\/pdf(?:[;,])/i.test(url);
    const explicitFile=localURL(url)&&(anchor.hasAttribute('download')||anchor.type==='application/pdf'||downloadHint(controlHint(anchor)));
    if(!candidate(url)&&!isBlob&&!isDataPdf&&!explicitFile)return false;
    const material=materialContext(anchor);
    if(material)downloadIntent={time:Date.now(),materialName:material.title,saveOnly:true};
    void preview(url,undefined,(vtopFilename.test(anchor.download) ? anchor.download : contextFilename(anchor)),undefined,pdfBlobs.get(url),true); return true;
  }
  // Some download helpers open opaque endpoints, so a recent download-labelled control is the only
  // safe signal for those. `_csrf` appears on ordinary VTOP popups too and must not be used alone.
  window.open = function (url, ...args) {
    if (!bypassClick && (candidate(url) || pdfBlobs.has(url as string) || /^data:application\/pdf(?:[;,])/i.test(String(url)) || localURL(url)&&pendingDownload())) {
      const href = new URL(url as string | URL,document.baseURI).href;
      // Fall back to VTOP's original popup on any failed preview. Some endpoints depend on navigation-only
      // behaviour (rather than fetch) and the native path remains the most reliable final download route.
      const fallback = () => originalOpen.call(window,href,...args);
      const suggestedName = pendingDownload() ? downloadIntent?.name : undefined;
      preview(href,undefined,suggestedName,fallback,pdfBlobs.get(href)); return null;
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
    const origin = event.composedPath()[0];
    if (origin instanceof HTMLAnchorElement && origin.dataset.vtopPdfBypass === 'true') {
      // The Navigation API may also see the default download from this click.
      if (!nativeURLs.has(origin.href)) {
        const url = origin.href;
        nativeURLs.add(url); setTimeout(() => nativeURLs.delete(url), 10000);
      }
      return;
    }
    const control=(event.target as Partial<Element>).closest?.('button,a,input[type="button"],input[type="submit"],[role="button"]');
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      const anchor=(event.target as Partial<Element>).closest?.<HTMLAnchorElement>('a[href]');
      if (anchor && downloadAnchor(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (event.shiftKey && control && downloadHint(controlHint(control)) &&
          !control.matches('.systemB5BtnMenu,.systemBtnMenu,.quickB5MainMenu,[data-bs-toggle]')) {
        clearTimeout(bypassTimer);bypassClick=false;
        downloadIntent={time:Date.now(),name:contextFilename(control),materialName:materialContext(control)?.title,saveOnly:true};
        return;
      }
      downloadIntent=null;bypassPreview();return;
    }
    // Keep the surrounding document label even when VTOP opens an opaque download endpoint rather than
    // exposing a descriptive URL. It is only used if the server itself returns a generated filename.
    // Only a control that actually signals a document download can make a following opaque popup
    // previewable. Remembering every click misclassified ordinary VTOP popups (for example Student
    // Login) as downloads for ten seconds.
    const material=materialContext(control);
    downloadIntent=control&&(downloadHint(controlHint(control))||material)?{time:Date.now(),name:contextFilename(control),materialName:material?.title,saveOnly:materialAction==='download'}:null;
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
    const suggestedName = contextFilename(submitter) || (pendingDownload() ? downloadIntent?.name : undefined);
    const fields = new FormData(form);
    if (submitter?.name) fields.append(submitter.name,submitter.value);
    const params = new URLSearchParams(fields as unknown as string[][]/* lib.dom omits FormData; file forms never get here */);
    if (method === 'GET') { for (const [key,value] of params) url.searchParams.append(key,value); preview(url.href,undefined,suggestedName); }
    else if (form.enctype === 'multipart/form-data') preview(url.href,{method,body:fields},suggestedName);
    else if (form.enctype === 'application/x-www-form-urlencoded') preview(url.href,{method,body:params},suggestedName);
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
    preview(url,fields ? {method:'POST',body:fields} : undefined,descriptiveName(event.downloadRequest) || (pendingDownload() ? downloadIntent?.name : undefined),fields ? undefined : () => {
      // A GET that merely looks like a download is opened natively instead of being shown as an error.
      nativeURLs.add(url); setTimeout(() => nativeURLs.delete(url),10000); location.assign(url);
    });
  });
  HTMLFormElement.prototype.submit = function (...args) { if (!handleForm(this)) return originalSubmit.apply(this,args); };
  document.addEventListener('submit',event=>{
    if (!event.defaultPrevented && handleForm(event.target as HTMLFormElement,event.submitter as HTMLButtonElement | HTMLInputElement | null)) {event.preventDefault();event.stopImmediatePropagation();}
  },true);

  // Keep VTOP's original control (and its authenticated AJAX/POST handler) in place.
  // Both visible actions invoke it once; the bridge chooses preview or save above.
  const materialControls = new WeakMap<HTMLElement, HTMLSpanElement>();
  function scanMaterials() {
    for (const table of document.querySelectorAll('table')) {
      const header = materialHeader(table); if (!header) continue;
      for (const row of table.rows) {
        const material = materialContext(row,header);
        if (!material) continue;
        const native = material.action.querySelector<HTMLElement>('a,button,input[type="button"],input[type="submit"],[role="button"],[onclick]');
        if (!native || native.closest('[data-vtop-material-actions]')) continue;
        let actions = materialControls.get(native);
        if (!actions) {
          for (const stale of material.action.querySelectorAll('[data-vtop-material-actions]')) stale.remove();
          actions = document.createElement('span'); actions.dataset.vtopMaterialActions = 'true';
          actions.setAttribute('role','group'); actions.setAttribute('aria-label','Course material actions');
          for (const action of ['preview','download'] as const) {
            const button = document.createElement('button'); button.type = 'button';
            button.textContent = action === 'preview' ? 'Preview' : 'Download';
            button.addEventListener('click',event => {
              event.preventDefault(); event.stopPropagation();
              const current = materialContext(native); if (!current) return;
              clearTimeout(bypassTimer); bypassClick = false;
              materialAction = action;
              downloadIntent = {time:Date.now(),materialName:current.title,saveOnly:action==='download'};
              try { native.click(); } finally { materialAction = undefined; }
            });
            actions.append(button);
          }
          native.setAttribute('data-vtop-material-original','true');
          materialControls.set(native,actions);
        }
        if (actions.parentElement !== material.action) native.after(actions);
      }
    }
    if (document.querySelector('[data-vtop-material-actions]') && !document.getElementById('vtop-material-actions-style')) {
      const style = document.createElement('style'); style.id = 'vtop-material-actions-style';
      style.textContent = `[data-vtop-material-original]{display:none!important}
        [data-vtop-material-actions]{display:inline-flex;flex-wrap:wrap;gap:8px;align-items:center}
        [data-vtop-material-actions] button{font:inherit;font-size:12px;min-height:32px;padding:5px 9px;border:1px solid currentColor;border-radius:6px;color:inherit;background:transparent;cursor:pointer;white-space:nowrap}
        [data-vtop-material-actions] button:hover{ text-decoration:underline }
        [data-vtop-material-actions] button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`;
      document.documentElement.append(style);
    }
  }
  let materialScan: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => {
    if (materialScan !== undefined) return;
    materialScan = setTimeout(() => { materialScan = undefined; scanMaterials(); },50);
  }).observe(document,{childList:true,subtree:true,characterData:true});
  scanMaterials();
})();
