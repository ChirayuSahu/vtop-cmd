const {test}=require('node:test');
const {packaged}=require('./paths');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(__dirname+'/../build/pdf-bridge.js','utf8');
const pause=()=>new Promise(resolve=>setTimeout(resolve,35));
const samplePdf=()=>new TextEncoder().encode('%PDF-1.4\npreview test').buffer;
function bridge({body='%PDF-1.4\nmock',type='application/pdf',disposition="attachment; filename*=UTF-8''Lecture%20notes.pdf",ok=true,navigation=false}={}){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window;
 const calls=[],messages=[],opens=[],downloads=[];
 let blobNumber=0;
 w.Blob=Blob;w.fetch=async(url,init)=>{calls.push({url,init});return{ok,blob:async()=>new Blob([body],{type}),headers:{get:name=>name==='content-type'?type:name==='content-disposition'?disposition:null}};};
 w.URL.createObjectURL=()=>`blob:https://vtop.vit.ac.in/${++blobNumber}`;w.URL.revokeObjectURL=()=>{};
 w.open=(...args)=>opens.push(args);
 w.HTMLAnchorElement.prototype.click=function(){downloads.push({href:this.href,name:this.download});};
 w.HTMLFormElement.prototype.submit=function(){calls.push({native:true});};
 if(navigation)w.navigation=new w.EventTarget();
 w.addEventListener('message',event=>messages.push(event.data));w.eval(source);
 return{dom,w,calls,messages,opens,downloads};
}
test('VTOP window.open download becomes a PDF preview using original authenticated GET',async()=>{
 const {dom,w,calls,messages,opens}=bridge();
 w.open('downloadSpotLightViewFile/820?token=test');await pause();
 assert.equal(opens.length,0);assert.equal(calls.length,1);assert.equal(calls[0].init.credentials,'same-origin');
 assert.ok(calls[0].url.includes('token=test'));
 const ready=messages.find(m=>m.kind==='ready');assert.ok(ready);assert.equal(ready.filename,'Lecture notes.pdf');
 assert.equal(new TextDecoder().decode(ready.bytes),'%PDF-1.4\nmock');assert.equal(ready.blobUrl,undefined);
 assert.ok(!JSON.stringify(messages).includes('token=test'));dom.window.close();
});
test('PDF headers within the first 1024 bytes are recognized',async()=>{
 const prefix='VTOP document preamble '.repeat(3),{dom,w,messages,downloads}=bridge({body:`${prefix}%PDF-1.4\nmock`});
 w.open('/vtop/download/course.pdf');await pause();
 assert.ok(messages.some(message=>message.kind==='ready'));assert.equal(downloads.length,0);dom.window.close();
});
test('PPTX and legacy PPT downloads are both previewed',async()=>{
 const pptx=bridge({body:'PK\u0003\u0004presentation',type:'application/vnd.openxmlformats-officedocument.presentationml.presentation',disposition:null});
 pptx.w.open('/vtop/download/Week%201.pptx');await pause();
 const ready=pptx.messages.find(message=>message.kind==='ready');
 assert.equal(ready.documentType,'pptx');assert.equal(ready.filename,'Week 1.pptx');assert.equal(pptx.downloads.length,0);pptx.dom.window.close();
 const legacy=bridge({body:'legacy presentation',type:'application/vnd.ms-powerpoint',disposition:null});
 legacy.w.open('/vtop/download/Week%201.ppt');await pause();
 const old=legacy.messages.find(message=>message.kind==='ready');
 assert.equal(old.documentType,'ppt');assert.equal(old.filename,'Week 1.ppt');legacy.dom.window.close();
});
test('DOCX and legacy DOC downloads are previewed locally',async()=>{
 const docx=bridge({body:'PK\u0003\u0004word document',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',disposition:null});
 docx.w.open('/vtop/download/assignment.docx');await pause();
 const modern=docx.messages.find(message=>message.kind==='ready');
 assert.equal(modern.documentType,'docx');assert.equal(modern.filename,'assignment.docx');assert.equal(docx.downloads.length,0);docx.dom.window.close();
 const legacy=bridge({body:'legacy word document',type:'application/msword',disposition:null});
 legacy.w.open('/vtop/download/notes.doc');await pause();
 const old=legacy.messages.find(message=>message.kind==='ready');
 assert.equal(old.documentType,'doc');assert.equal(old.filename,'notes.doc');assert.equal(legacy.downloads.length,0);legacy.dom.window.close();
});
test('external URLs and ordinary VTOP navigation retain native browser behavior',async()=>{
 const {dom,w,calls,opens}=bridge();w.open('https://example.com/file.pdf');w.open('/vtop/academics/home');
 assert.equal(opens.length,2);assert.equal(calls.length,0);dom.window.close();
});
test('Student Login popups stay native and never open a document preview',()=>{
 const {dom,w,calls,opens,messages}=bridge();const button=w.document.createElement('button');
 button.textContent='VTOP Student Login';button.addEventListener('click',()=>w.open('/vtop/login'));
 w.document.body.append(button);button.click();
 assert.equal(opens.length,1);assert.equal(calls.length,0);assert.equal(messages.some(message=>message.kind==='loading'),false);dom.window.close();
});
test('PDF blob anchors are intercepted even when detached; non-PDF responses keep download behavior',async()=>{
 const a=bridge();const anchor=a.w.document.createElement('a');anchor.href=a.w.URL.createObjectURL(new a.w.Blob(['%PDF-1.4'],{type:'application/pdf'}));anchor.download='notes.pdf';anchor.click();await pause();
 assert.ok(a.messages.some(m=>m.kind==='ready'));assert.equal(a.downloads.length,0);a.dom.window.close();
 const b=bridge({body:'spreadsheet',type:'application/vnd.ms-excel'});b.w.open('/vtop/download/report');await pause();
 assert.equal(b.downloads.length,1);assert.ok(b.messages.some(m=>m.kind==='not-pdf'));b.dom.window.close();
});
test('POST download forms retain fields; non-download/file-upload forms are left alone',async()=>{
 const {dom,w,calls,messages}=bridge();
 const form=w.document.createElement('form');form.method='POST';form.action='/vtop/download/document';form.innerHTML='<input name="_csrf" value="test-only"><input name="course" value="sample">';w.document.body.append(form);form.submit();await pause();
 assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.body.get('_csrf'),'test-only');assert.ok(messages.some(m=>m.kind==='ready'));
 form.action='/vtop/upload';form.submit();assert.equal(calls.at(-1).native,true);
 form.action='/vtop/download/upload';form.innerHTML='<input type="file">';form.submit();assert.equal(calls.at(-1).native,true);dom.window.close();
});
test('failed preview requests fall back to VTOP\'s original download navigation',async()=>{
 const {dom,w,messages,opens,downloads}=bridge({body:'<html>Sign in</html>',type:'text/html'});w.open('/vtop/download/file');await pause();
 assert.ok(messages.some(m=>m.kind==='not-pdf'));assert.equal(opens.length,1);assert.equal(downloads.length,0);dom.window.close();
});
test('PDF resources are bundled locally and MAIN interception is scoped only to VTOP',()=>{
 const manifest=JSON.parse(fs.readFileSync(__dirname+'/../static/manifest.json'));
 const main=manifest.content_scripts.find(script=>script.world==='MAIN');assert.deepEqual(main.matches,['https://vtop.vit.ac.in/vtop/*']);assert.equal(main.run_at,'document_start');
 assert.deepEqual(manifest.permissions,['storage']);
 const viewerResources=manifest.web_accessible_resources.find(resource=>resource.resources.includes('pdf-viewer.html')).resources;
 for(const file of ['pdf-viewer.html','pdf-viewer.css','pdf-viewer.mjs','pptx-viewer.mjs','ppt-viewer.mjs','word-viewer.mjs','brand.js','vendor/pdf.mjs','vendor/pdf.worker.mjs','vendor/pptx-renderer.browser.mjs','vendor/pptjs/pptjs.mjs']) {
  assert.ok(fs.existsSync(packaged(file)));
  assert.ok(viewerResources.includes(file));
 }
 for(const file of ['vendor/docx/docx-preview.min.mjs','vendor/docx/jszip.min.mjs','vendor/msdoc/purify.es.mjs','vendor/msdoc/modules/msdoc/parser.js','vendor/msdoc/modules/render/html.js']) assert.ok(fs.existsSync(__dirname+'/../'+file));
 assert.ok(viewerResources.includes('vendor/docx/*.mjs'));
 assert.ok(viewerResources.includes('vendor/msdoc/*'));
 assert.ok(viewerResources.includes('vendor/msdoc/modules/msdoc/*'));
 assert.ok(viewerResources.includes('vendor/msdoc/modules/render/*'));
 assert.ok(viewerResources.includes('vendor/cmaps/*'));
 assert.ok(viewerResources.includes('vendor/standard_fonts/*'));
 assert.ok(!fs.readFileSync(__dirname+'/../static/pdf-viewer.html','utf8').includes('https://'));
});
test('Shift-click bypasses the viewer for native javascript download helpers',()=>{
 const {dom,w,opens,calls}=bridge();const anchor=w.document.createElement('a');anchor.href='javascript:void(0)';anchor.addEventListener('click',()=>w.open('/vtop/download/original'));w.document.body.append(anchor);
 anchor.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));
 assert.equal(opens.length,1);assert.equal(calls.length,0);dom.window.close();
});
test('Shift-clicking a delayed VTOP popup leaves preview interception disabled',async()=>{
 const {dom,w,calls,opens}=bridge();const link=w.document.createElement('a');
 // The helper has no directly downloadable href; its delayed popup is what must retain the modifier bypass.
 link.href='javascript:void(0)';
 link.addEventListener('click',event=>{event.preventDefault();setTimeout(()=>w.open('/vtop/download/original.pdf'),20);});w.document.body.append(link);
 link.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();
 assert.equal(calls.length,0);assert.equal(opens.length,1);dom.window.close();
});
test('Shift-clicking a document link saves it directly with a contextual name',async()=>{
 const {dom,w,calls,downloads}=bridge({disposition:'attachment; filename="w4HdVJyD.pdf"'});const link=w.document.createElement('a');
 link.href='/vtop/download/file';link.title='Linear Algebra Notes';w.document.body.append(link);
 link.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();
 assert.equal(calls.length,1);assert.deepEqual(downloads,[{href:'blob:https://vtop.vit.ac.in/1',name:'Linear Algebra Notes.pdf'}]);dom.window.close();
});
test('document names use the server name and add the matching file extension when missing',async()=>{
 const named=bridge({disposition:'attachment; filename="Module 3 notes"'});named.w.open('/vtop/download/file');await pause();
 assert.equal(named.messages.find(message=>message.kind==='ready').filename,'Module 3 notes.pdf');named.dom.window.close();
 const linked=bridge({disposition:null});linked.w.open('/vtop/download/file');await pause();
 assert.equal(linked.messages.find(message=>message.kind==='ready').filename,'file.pdf');linked.dom.window.close();
});
test('RFC 5987 and percent-encoded server filenames are decoded before download',async()=>{
 const encoded=bridge({disposition:"attachment; filename*=UTF-8'en'%E2%82%AC%20notes.pdf"});encoded.w.open('/vtop/download/file');await pause();
 assert.equal(encoded.messages.find(message=>message.kind==='ready').filename,'€ notes.pdf');encoded.dom.window.close();
 const plain=bridge({disposition:'attachment; filename="Course%20notes"'});plain.w.open('/vtop/download/file');await pause();
 assert.equal(plain.messages.find(message=>message.kind==='ready').filename,'Course notes.pdf');plain.dom.window.close();
});
test('opaque server names use the clicked document label instead',async()=>{
 const {dom,w,messages}=bridge({disposition:'attachment; filename="t_wT7NP6.pdf"'});const link=w.document.createElement('a');
 link.href='/vtop/download/file';link.title='Module 3 Lecture Notes';w.document.body.append(link);link.click();await pause();
 assert.equal(messages.find(message=>message.kind==='ready').filename,'Module 3 Lecture Notes.pdf');dom.window.close();
});
test('opaque server names fall back to the filename in the original download link',async()=>{
 const {dom,w,messages}=bridge({disposition:'attachment; filename="t_wT7NP6.pdf"'});const link=w.document.createElement('a');
 link.href='/vtop/download/file?fileName=Lecture%201%20Notes.pdf';w.document.body.append(link);link.click();await pause();
 assert.equal(messages.find(message=>message.kind==='ready').filename,'Lecture 1 Notes.pdf');dom.window.close();
});
test('preview names retain the previous document-title naming when downloads use link filenames',async()=>{
 const {dom,w,messages}=bridge({body:'%PDF-1.4\n1 0 obj << /Title (Linear Algebra Notes) >>',disposition:'attachment; filename="t_wT7NP6.pdf"'});const link=w.document.createElement('a');
 link.href='/vtop/download/file?fileName=Lecture%201%20Notes.pdf';w.document.body.append(link);link.click();await pause();
 const ready=messages.find(message=>message.kind==='ready');assert.equal(ready.filename,'Lecture 1 Notes.pdf');assert.equal(ready.previewName,'Linear Algebra Notes.pdf');dom.window.close();
});
test('opaque popup names use the surrounding download-row title',async()=>{
 const {dom,w,messages}=bridge({disposition:'attachment; filename="w4HdVJyD.pdf"'});const row=w.document.createElement('tr'),cell=w.document.createElement('td'),button=w.document.createElement('button');
 cell.textContent='Linear Algebra Unit 2 Notes';button.textContent='Download PDF';button.addEventListener('click',()=>w.open('/vtop/download/file'));row.append(cell,button);w.document.body.append(row);
 button.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();
 assert.equal(messages.find(message=>message.kind==='ready').filename,'Linear Algebra Unit 2 Notes.pdf');dom.window.close();
});
test('opaque PDF names use embedded title metadata or a clean fallback',async()=>{
 const titled=bridge({body:'%PDF-1.4\n1 0 obj << /Title (Linear Algebra Notes) >>',disposition:'attachment; filename="34cXHw_P.pdf"'});titled.w.open('/vtop/download/file');await pause();
 assert.equal(titled.messages.find(message=>message.kind==='ready').filename,'Linear Algebra Notes.pdf');titled.dom.window.close();
 const unnamed=bridge({disposition:'attachment; filename="34cXHw_P.pdf"'});unnamed.w.open('/vtop/download/file');await pause();
 assert.equal(unnamed.messages.find(message=>message.kind==='ready').filename,'VTOP document.pdf');unnamed.dom.window.close();
});
test('preview ignores forged origins and accepts PDF bytes without fetching page blob URLs',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window;
 w.chrome={runtime:{getURL:name=>'moz-extension://test-extension/'+name}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.URL.createObjectURL=()=>'blob:https://vtop.vit.ac.in/preview-copy';w.URL.revokeObjectURL=()=>{};
 let fetched=0;w.fetch=async()=>{fetched++;throw new Error('Should not fetch');};
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));w.eval(fs.readFileSync(__dirname+'/../build/pdf-preview.js','utf8'));
 const send=(origin,kind,extra={})=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin,data:{source:'vtop-command-pdf',id:'pdf-1-1',kind,...extra}}));
 send('https://attacker.example','loading');const dialog=w.document.querySelector('#vtop-pdf-preview').shadowRoot.querySelector('dialog');assert.equal(dialog.open,false);
 send(w.location.origin,'loading');assert.equal(dialog.open,true);
 send(w.location.origin,'ready',{blobUrl:'blob:https://vtop.vit.ac.in/forged'});assert.equal(fetched,0);assert.equal(w.document.querySelector('#vtop-pdf-preview').shadowRoot.querySelector('iframe'),null);
 send(w.location.origin,'ready',{bytes:samplePdf()});await pause();assert.equal(fetched,0);assert.ok(w.document.querySelector('#vtop-pdf-preview').shadowRoot.querySelector('iframe'));dom.window.close();
});
test('a click on the preview backdrop closes it; clicks inside do not',()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window;
 w.chrome={runtime:{getURL:name=>'moz-extension://test-extension/'+name}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));w.eval(fs.readFileSync(__dirname+'/../build/pdf-preview.js','utf8'));
 w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{source:'vtop-command-pdf',id:'pdf-1-1',kind:'loading'}}));
 const dialog=w.document.querySelector('#vtop-pdf-preview').shadowRoot.querySelector('dialog');dialog.getBoundingClientRect=()=>({left:20,right:980,top:20,bottom:700});
 dialog.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:500,clientY:300}));assert.equal(dialog.open,true);
 dialog.querySelector('h2').dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:5,clientY:5}));assert.equal(dialog.open,true);
 dialog.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:5,clientY:5}));assert.equal(dialog.open,false);dom.window.close();
});
test('preview Download keeps original PDF bytes and filename, and Close revokes temporary data',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window;
 const bytes=new TextEncoder().encode('%PDF-1.4\noriginal bytes').buffer,revoked=[];
 w.chrome={runtime:{getURL:name=>'moz-extension://test-extension/'+name}};
 w.TextDecoder=TextDecoder;w.Blob=Blob;w.fetch=async()=>({arrayBuffer:async()=>bytes});
 w.URL.createObjectURL=()=> 'blob:https://vtop.vit.ac.in/original-copy';w.URL.revokeObjectURL=url=>revoked.push(url);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));w.eval(fs.readFileSync(__dirname+'/../build/pdf-preview.js','utf8'));
 const send=(kind,extra={})=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{source:'vtop-command-pdf',id:'pdf-1-1',kind,...extra}}));
 send('loading');send('ready',{bytes:samplePdf(),filename:'Lecture.pdf'});await pause();
 const shadow=w.document.querySelector('#vtop-pdf-preview').shadowRoot,download=shadow.querySelector('a');
 assert.equal(download.hidden,false);assert.equal(download.download,'Lecture.pdf');assert.equal(download.href,'blob:https://vtop.vit.ac.in/original-copy');
 assert.equal(shadow.querySelector('h2').textContent,download.download);
 shadow.querySelector('button').click();assert.equal(download.hidden,true);assert.deepEqual(revoked,['blob:https://vtop.vit.ac.in/original-copy']);dom.window.close();
});
test('preview headings use their supplied display name instead of the download filename',async()=>{
 const {dom,shadow,send}=previewWindow();send('pdf-1-1','loading');send('pdf-1-1','ready',{bytes:samplePdf(),filename:'Lecture 1 Notes.pdf',previewName:'Linear Algebra Notes.pdf'});await pause();
 assert.equal(shadow.querySelector('h2').textContent,'Linear Algebra Notes.pdf');dom.window.close();
});
test('preview Download normalizes encoded names and document extensions',async()=>{
 const {dom,shadow,send}=previewWindow();send('pdf-1-1','loading');send('pdf-1-1','ready',{bytes:samplePdf(),filename:'Course%20notes'});await pause();
 assert.equal(shadow.querySelector('.download').download,'Course notes.pdf');dom.window.close();
});
test('modifier-clicking preview Download still starts a native file download',async()=>{
 const {dom,w,shadow,send}=previewWindow();const clicks=[];
 w.HTMLAnchorElement.prototype.click=function(){clicks.push({href:this.href,name:this.download,bypass:this.dataset.vtopPdfBypass});};
 send('pdf-1-1','loading');send('pdf-1-1','ready',{bytes:samplePdf(),filename:'Lecture.pdf'});await pause();
 shadow.querySelector('.download').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));
 assert.deepEqual(clicks,[{href:'blob:https://vtop.vit.ac.in/copy',name:'Lecture.pdf',bypass:'true'}]);dom.window.close();
});
test('preview Download uses the retained copy on every click after the original URL is revoked',async()=>{
 const page=bridge(),viewer=previewWindow();
 const original=page.w.document.createElement('a');
 original.href=page.w.URL.createObjectURL(new page.w.Blob(['%PDF-1.4']));
 original.download='Lecture.pdf';original.click();page.w.URL.revokeObjectURL(original.href);await pause();
 for(const message of page.messages)viewer.send(message.id,message.kind,message);
 const link=viewer.shadow.querySelector('.download');
 const clicks=[];
 link.addEventListener('click',event=>{
  clicks.push({href:link.href,name:link.download,handled:event.defaultPrevented});
  event.preventDefault();
 });
 link.click();link.click();
 assert.deepEqual(clicks,Array(2).fill({href:'blob:https://vtop.vit.ac.in/copy',name:'Lecture.pdf',handled:false}));
 page.dom.window.close();viewer.dom.window.close();
});
test('opaque Office attachments retain their type when the server sends generic binary data',async()=>{
 for(const type of ['pptx','ppt','docx','doc']){
  const page=bridge({body:'office document',type:'application/octet-stream',disposition:`attachment; filename="w4HdVJyD.${type}"`});
  page.w.open('/vtop/download/file');await pause();
  const ready=page.messages.find(message=>message.kind==='ready');
  assert.equal(ready?.documentType,type);assert.equal(ready.filename,`VTOP document.${type}`);
  assert.equal(page.downloads.length,0);page.dom.window.close();
 }
});
test('direct download displays an error for a sign-in page or JSON error',async()=>{
 for(const type of ['text/html','application/json']){
  const page=bridge({body:type==='text/html'?'<html>Sign in</html>':'{"error":"expired"}',type,disposition:null});
  const link=page.w.document.createElement('a');link.href='/vtop/download/file.pdf';page.w.document.body.append(link);
  link.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();
  assert.deepEqual(page.downloads,[]);
  const viewer=previewWindow();
  for(const message of page.messages)viewer.send(message.id,message.kind,message);
  assert.ok(viewer.shadow.querySelector('dialog').open);
  assert.match(viewer.shadow.querySelector('.status').textContent,/sign in again/i);
  assert.ok(viewer.shadow.querySelector('.download').hidden);
  viewer.dom.window.close();page.dom.window.close();
 }
});
test('real Curriculum button submits curriculDown form to the viewer once with authenticated POST fields',async()=>{
 const {dom,w,calls,messages}=bridge();const form=w.document.createElement('form');form.id='curriculumDownloadForm';form.method='post';form.action='academics/curriculDown/';
 form.innerHTML='<input type="hidden" name="_csrf" value="mock-csrf"><input type="hidden" name="authorizedID" value="mock-user"><input type="hidden" name="regNo" value="mock-registration">';
 const button=w.document.createElement('button');button.type='button';button.id='curriculumDownload';button.textContent='Download Curriculum as PDF';button.addEventListener('click',()=>form.submit());w.document.body.append(form,button);
 button.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://vtop.vit.ac.in/vtop/academics/curriculDown/');assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.body.get('regNo'),'mock-registration');assert.equal(calls[0].init.body.get('_csrf'),'mock-csrf');assert.ok(messages.some(message=>message.kind==='ready'));dom.window.close();
});
test('PDF-labelled controls cover opaque form and window.open endpoints without changing unrelated forms',async()=>{
 const a=bridge();const form=a.w.document.createElement('form');form.method='post';form.action='academics/render/42';form.innerHTML='<input name="report" value="sample">';
 const button=a.w.document.createElement('button');button.textContent='Download as PDF';button.addEventListener('click',()=>form.submit());a.w.document.body.append(form,button);button.dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();
 assert.equal(a.calls[0].init.method,'POST');assert.ok(a.messages.some(message=>message.kind==='ready'));a.dom.window.close();
 const b=bridge();const control=b.w.document.createElement('button');control.textContent='View PDF';control.addEventListener('click',()=>b.w.open('academics/render/42'));b.w.document.body.append(control);control.dispatchEvent(new b.w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();assert.equal(b.opens.length,0);assert.ok(b.messages.some(message=>message.kind==='ready'));b.dom.window.close();
});
test('PDF download attributes on opaque URLs, data URLs and dwnld endpoints open the viewer',async()=>{
 for(const href of ['academics/render/42','data:application/pdf;base64,JVBERi0xLjQ=','academics/courseDwnld/42']){
  const {dom,w,messages}=bridge();const link=w.document.createElement('a');link.href=href;link.download='Course.pdf';link.click();await pause();assert.ok(messages.some(message=>message.kind==='ready'),href);dom.window.close();
 }
});
test('Shift-click saves programmatic PDF form downloads with one POST',async()=>{
 const {dom,w,calls}=bridge();const form=w.document.createElement('form');form.id='curriculumDownloadForm';form.method='post';form.action='academics/curriculDown/';
 const button=w.document.createElement('button');button.textContent='Download Curriculum as PDF';button.addEventListener('click',()=>form.submit());w.document.body.append(form,button);button.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();assert.equal(calls.length,1);assert.equal(calls[0].init.method,'POST');dom.window.close();
});
test('download-labelled navigation entries stay native instead of fetching the current page as a PDF',async()=>{
 const {dom,w,calls}=bridge();let navigations=0;
 const link=w.document.createElement('a');link.href='#';link.className='systemB5BtnMenu';link.dataset.url='events/certificateDownload';link.textContent='Certificate Download';link.addEventListener('click',event=>{event.preventDefault();navigations++;});w.document.body.append(link);
 link.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();assert.equal(navigations,1);assert.equal(calls.length,0);dom.window.close();
});
function navigate(w,url,extra={}){
 const event=new w.Event('navigate',{cancelable:true});
 Object.defineProperties(event,{destination:{value:{url:new URL(url,w.location.href).href}},navigationType:{value:'push'},hashChange:{value:false},downloadRequest:{value:null},formData:{value:null},...Object.fromEntries(Object.entries(extra).map(([key,value])=>[key,{value}]))});
 w.navigation.dispatchEvent(event);return event;
}
test('Navigation API leaves downloads from the preview link alone',()=>{
 const {dom,w,calls}=bridge({navigation:true});
 const host=w.document.createElement('div');w.document.body.append(host);
 const shadow=host.attachShadow({mode:'open'}),link=w.document.createElement('a');
 link.href='blob:https://vtop.vit.ac.in/preview-copy';link.download='Lecture.pdf';
 link.dataset.vtopPdfBypass='true';shadow.append(link);
 link.addEventListener('click',event=>event.preventDefault());
 link.dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true,cancelable:true}));
 assert.equal(navigate(w,link.href,{downloadRequest:link.download}).defaultPrevented,false);
 assert.equal(calls.length,0);dom.window.close();
});
test('Navigation API catches location-style downloads and POST navigations, leaving ordinary pages native',async()=>{
 const {dom,w,calls,messages}=bridge({navigation:true});
 const download=navigate(w,'/vtop/downloadQuestionPaper?id=7');await pause();
 assert.equal(download.defaultPrevented,true);assert.equal(calls[0].url,'https://vtop.vit.ac.in/vtop/downloadQuestionPaper?id=7');assert.ok(messages.some(m=>m.kind==='ready'));
 const fields=new w.FormData();fields.append('_csrf','test-only');
 const post=navigate(w,'/vtop/examinations/doDownload',{formData:fields});await pause();
 assert.equal(post.defaultPrevented,true);assert.equal(calls[1].init.method,'POST');assert.equal(calls[1].init.body.get('_csrf'),'test-only');
 const page=navigate(w,'/vtop/academics/home');const external=navigate(w,'https://example.com/file.pdf');const back=navigate(w,'/vtop/download/x',{navigationType:'traverse'});
 assert.equal(page.defaultPrevented,false);assert.equal(external.defaultPrevented,false);assert.equal(back.defaultPrevented,false);assert.equal(calls.length,2);dom.window.close();
});
test('Navigation API is read-only: a POST is sent once and never replayed, and file uploads are never touched',async()=>{
 const {dom,w,calls,messages}=bridge({navigation:true,body:'<html>Report</html>',type:'text/html'});
 const fields=new w.FormData();fields.append('report','7');
 navigate(w,'/vtop/download/report',{formData:fields});await pause();
 assert.equal(calls.length,1);assert.equal(calls[0].init.method,'POST');assert.ok(!calls.some(call=>call.native),'POST never replayed');assert.ok(messages.some(m=>m.kind==='error'));
 const intent=navigate(w,'/vtop/academics/saveSomething',{formData:fields});assert.equal(intent.defaultPrevented,false,'POST to a non-download endpoint stays native');assert.equal(calls.length,1);
 const upload=new w.FormData();upload.append('file',new w.File(['x'],'x.pdf'));
 assert.equal(navigate(w,'/vtop/download/upload',{formData:upload}).defaultPrevented,false);dom.window.close();
});
test('synthetic clicks on detached blob anchors and icon-only download buttons open the viewer',async()=>{
 const a=bridge();const anchor=a.w.document.createElement('a');anchor.href=a.w.URL.createObjectURL(new a.w.Blob(['%PDF-1.4']));anchor.download='saved';
 assert.equal(anchor.dispatchEvent(new a.w.MouseEvent('click',{cancelable:true})),false);await pause();
 assert.ok(a.messages.some(m=>m.kind==='ready'));assert.equal(a.downloads.length,0);a.dom.window.close();
 const b=bridge();const button=b.w.document.createElement('button');button.innerHTML='<i class="fa fa-download"></i>';button.addEventListener('click',()=>b.w.open('academics/render/42'));b.w.document.body.append(button);
 button.querySelector('i').dispatchEvent(new b.w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();
 assert.equal(b.opens.length,0);assert.ok(b.messages.some(m=>m.kind==='ready'));b.dom.window.close();
});
test('preview mounts a fresh viewer frame per document and delivers bytes on load',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window;
 w.chrome={runtime:{getURL:name=>'moz-extension://test-extension/'+name}};
 w.TextDecoder=TextDecoder;w.Blob=Blob;w.fetch=async()=>({arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.4').buffer});
 w.URL.createObjectURL=()=>'blob:https://vtop.vit.ac.in/copy';w.URL.revokeObjectURL=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));w.eval(fs.readFileSync(__dirname+'/../build/pdf-preview.js','utf8'));
 const shadow=w.document.querySelector('#vtop-pdf-preview').shadowRoot;
 const send=(id,kind,extra={})=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{source:'vtop-command-pdf',id,kind,...extra}}));
 send('pdf-1-1','loading');send('pdf-1-1','ready',{bytes:samplePdf()});await pause();
 const first=shadow.querySelector('iframe');assert.ok(first);
 const posted=[];first.contentWindow.postMessage=(data,origin)=>posted.push({data,origin});first.dispatchEvent(new w.Event('load'));
 assert.equal(posted.length,1);assert.equal(posted[0].data.type,'pdf-data');assert.equal(posted[0].origin,'moz-extension://test-extension');
 send('pdf-2-2','loading');assert.equal(shadow.querySelector('iframe'),null);
 send('pdf-2-2','ready',{bytes:samplePdf()});await pause();
 const second=shadow.querySelector('iframe');assert.ok(second&&second!==first);assert.notEqual(second.src,first.src);
 assert.equal(shadow.querySelectorAll('iframe').length,1);dom.window.close();
});
test('Firefox opaque extension message origin completes the viewer-ready handshake',async()=>{
 const {dom,w,shadow,send}=previewWindow({extensionProtocol:'moz-extension:'});
 send('pdf-1-1','loading');send('pdf-1-1','ready',{bytes:samplePdf()});await pause();
 const frame=shadow.querySelector('iframe'),posted=[];assert.ok(frame);
 frame.contentWindow.postMessage=(data,origin)=>posted.push({data,origin});
 const nonce=new URL(frame.src).hash.slice(1);
 w.dispatchEvent(new w.MessageEvent('message',{source:frame.contentWindow,origin:'null',data:{type:'viewer-ready',nonce}}));
 assert.equal(posted.length,1);assert.equal(posted[0].data.type,'pdf-data');assert.equal(posted[0].origin,'moz-extension://test-extension');
 dom.window.close();
});
function previewWindow({dark=false,extensionProtocol='moz-extension:'}={}){
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window,listeners=[];
 w.chrome={runtime:{getURL:name=>`${extensionProtocol}//test-extension/${name}`},storage:{local:{get:async()=>({darkMode:dark})},onChanged:{addListener:listener=>listeners.push(listener)}}};
 w.TextDecoder=TextDecoder;w.Blob=Blob;w.fetch=async()=>({arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.4').buffer});
 w.URL.createObjectURL=()=>'blob:https://vtop.vit.ac.in/copy';w.URL.revokeObjectURL=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));w.eval(fs.readFileSync(__dirname+'/../build/pdf-preview.js','utf8'));
 const host=w.document.querySelector('#vtop-pdf-preview'),shadow=host.shadowRoot;
 const send=(id,kind,extra={})=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data:{source:'vtop-command-pdf',id,kind,...extra}}));
 return{dom,w,host,shadow,send,listeners};
}
test('preview shares the command menu palette and follows the saved dark mode, passing it to the viewer',async()=>{
 const {dom,w,host,shadow,send,listeners}=previewWindow({dark:true});await pause();
 assert.equal(host.hasAttribute('data-dark'),true);assert.match(shadow.querySelector('style').textContent,/--surface:#171d29/);
 assert.match(shadow.querySelector('.brand').textContent,/VTOP \/ PREVIEW/);assert.equal(shadow.querySelector('.close').textContent,'Esc');
 send('pdf-1-1','loading');send('pdf-1-1','ready',{bytes:samplePdf()});await pause();
 assert.match(shadow.querySelector('iframe').src,/\?theme=blue&\btype=pdf#/);
 listeners.forEach(listener=>listener({darkMode:{newValue:false}},'local'));assert.equal(host.hasAttribute('data-dark'),false);dom.window.close();
});
test('PPTX and legacy PPT previews route bytes to their presentation viewers',async()=>{
 const pptx=previewWindow(),presentation=new TextEncoder().encode('PK\u0003\u0004slides').buffer;
 pptx.send('pdf-1-1','loading');pptx.send('pdf-1-1','ready',{bytes:presentation,filename:'slides.pptx',documentType:'pptx'});await pause();
 assert.match(pptx.shadow.querySelector('iframe').src,/type=pptx#/);
 pptx.dom.window.close();
 const legacy=previewWindow();
 legacy.send('pdf-1-1','loading');legacy.send('pdf-1-1','ready',{bytes:new TextEncoder().encode('old powerpoint').buffer,filename:'slides.ppt',documentType:'unsupported'});
 assert.equal(legacy.shadow.querySelector('iframe'),null);
 assert.match(legacy.shadow.querySelector('.status').textContent,/file type cannot be previewed/);
 assert.equal(legacy.shadow.querySelector('.download').download,'slides.ppt');
 legacy.dom.window.close();
 const supported=previewWindow();
 supported.send('pdf-1-1','loading');supported.send('pdf-1-1','ready',{bytes:new TextEncoder().encode('old powerpoint').buffer,filename:'slides.ppt',documentType:'ppt'});
 assert.match(supported.shadow.querySelector('iframe').src,/type=ppt#/);
 supported.dom.window.close();
});
test('DOCX and legacy DOC previews route to the Word viewer',async()=>{
 for(const documentType of ['docx','doc']){
  const word=previewWindow();
  word.send('pdf-1-1','loading');word.send('pdf-1-1','ready',{bytes:new TextEncoder().encode('word document').buffer,filename:`notes.${documentType}`,documentType});
  assert.match(word.shadow.querySelector('iframe').src,new RegExp(`type=${documentType}#`));
  word.dom.window.close();
 }
});
test('Escape and Cmd/Ctrl+K forwarded from the viewer close the preview and reopen the command menu',async()=>{
 const {dom,w,shadow,send}=previewWindow();await pause();const keys=[];
 w.document.addEventListener('keydown',event=>keys.push(event.key));
 const open=async id=>{send(id,'loading');send(id,'ready',{bytes:samplePdf()});await pause();return shadow.querySelector('iframe');};
 const fromViewer=(frame,key)=>{const nonce=new URL(frame.src).hash.slice(1);w.dispatchEvent(new w.MessageEvent('message',{source:frame.contentWindow,origin:'moz-extension://test-extension',data:{type:'viewer-key',key,nonce}}));};
 const dialog=shadow.querySelector('dialog');
 fromViewer(await open('pdf-1-1'),'Escape');assert.equal(dialog.open,false);assert.deepEqual(keys,[]);
 fromViewer(await open('pdf-2-2'),'k');assert.equal(dialog.open,false);assert.deepEqual(keys,['k']);dom.window.close();
});
test('Word blob popups still preview after VTOP revokes the URL',async()=>{
 for(const [ext,type] of [['doc','application/msword'],['docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document']]){
  const {dom,w,messages,opens}=bridge();
  const url=w.URL.createObjectURL(new w.Blob(['Word bytes'],{type}));
  w.open(url);w.URL.revokeObjectURL(url);await pause();
  assert.equal(messages.find(item=>item.kind==='ready')?.documentType,ext);
  assert.equal(opens.length,0);dom.window.close();
 }
});
test('VTOP downloadFileWithProgress: untyped blob revoked right after click still opens the viewer',async()=>{
 const {dom,w,messages,downloads}=bridge();const revoke=w.URL.revokeObjectURL;let revoked=0;w.URL.revokeObjectURL=url=>{revoked++;revoke(url);};
 const blob=new w.Blob(['%PDF-1.4 lecture']);const link=w.document.createElement('a');link.href=w.URL.createObjectURL(blob);link.download='Module 3';
 w.document.body.appendChild(link);link.click();w.document.body.removeChild(link);w.URL.revokeObjectURL(link.href);await pause();
 assert.ok(revoked>=1);assert.ok(messages.some(m=>m.kind==='ready'));assert.equal(downloads.length,0);dom.window.close();
 const other=bridge();const sheet=other.w.document.createElement('a');sheet.href=other.w.URL.createObjectURL(new other.w.Blob(['PK spreadsheet']));sheet.download='marks.xlsx';
 other.w.document.body.append(sheet);sheet.click();await pause();assert.equal(other.downloads.length,1);assert.equal(other.downloads[0].name,'marks.xlsx');other.dom.window.close();
});
test('download-labelled controls can preview opaque VTOP popups; other CSRF popups stay native',async()=>{
 const a=bridge();const download=a.w.document.createElement('button');download.textContent='Download question paper';
 download.addEventListener('click',()=>a.w.open('examinations/getQuestionPaper/12?authorizedID=X&_csrf=test'));a.w.document.body.append(download);download.click();await pause();
 assert.equal(a.opens.length,0);assert.ok(a.messages.some(m=>m.kind==='ready'));a.dom.window.close();
 const b=bridge({body:'<html>page</html>',type:'text/html'});const fallback=b.w.document.createElement('button');fallback.textContent='Download question paper';
 fallback.addEventListener('click',()=>b.w.open('examinations/getQuestionPaper/12?authorizedID=X&_csrf=test'));b.w.document.body.append(fallback);fallback.click();await pause();
 assert.equal(b.opens.length,1);assert.ok(b.messages.some(m=>m.kind==='not-pdf'));b.dom.window.close();
 const c=bridge();c.w.open('vtop/login?_csrf=test');assert.equal(c.opens.length,1);assert.equal(c.calls.length,0);c.dom.window.close();
});

test('generated identifiers use document labels for preview and direct download',async()=>{
 for(const identifier of ['708f1eaa-fe75-4448-930f-d324a2593b9f','abcdef0123456789abcdef0123456789','w4HdVJyD']){
  for(const direct of [false,true]){
   const page=bridge({disposition:`attachment; filename="${identifier}.pdf"`});
   const link=page.w.document.createElement('a');
   link.href='/vtop/download/file';link.download=identifier+'.pdf';
   link.textContent='Unit 2 Notes';page.w.document.body.append(link);
   link.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:direct}));await pause();
   assert.equal(direct?page.downloads[0]?.name:page.messages.find(m=>m.kind==='ready')?.filename,'Unit 2 Notes.pdf');
   page.dom.window.close();
  }
 }
});
test('meaningful server names win over labels across supported types',async()=>{
 for(const type of ['pdf','pptx','ppt','docx','doc']){
  const page=bridge({body:type==='pdf'?'%PDF-1.4':'Office bytes',type:'application/octet-stream',disposition:`attachment; filename="Original Notes.${type}"`});
  const link=page.w.document.createElement('a');link.href='/vtop/download/file';link.title='Other Label';page.w.document.body.append(link);link.click();await pause();
  assert.equal(page.messages.find(m=>m.kind==='ready')?.filename,`Original Notes.${type}`);page.dom.window.close();
 }
});
test('document-title column wins over unrelated course and date cells',async()=>{
 const page=bridge({disposition:'attachment; filename="abcdef0123456789.pdf"'});
 page.w.document.body.innerHTML='<table><thead><tr><th>Course Name</th><th>Document Title</th><th>Date</th><th>Action</th></tr></thead><tbody><tr><td>Computer Science</td><td>Unit 3 Notes</td><td>2026-11-14</td><td><a href="/vtop/download/file">Download</a></td></tr></tbody></table>';
 page.w.document.querySelector('a').click();await pause();
 assert.equal(page.messages.find(m=>m.kind==='ready')?.filename,'Unit 3 Notes.pdf');page.dom.window.close();
});
test('encoded contextual names are sanitized for direct download',async()=>{
 const page=bridge({disposition:'attachment; filename="abcdef0123456789.pdf"'});
 const link=page.w.document.createElement('a');link.href='/vtop/download/file';link.dataset.filename='Unit%202%2FNotes%3A%20Intro';
 page.w.document.body.append(link);link.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();
 assert.equal(page.downloads[0]?.name,'Unit 2_Notes_ Intro.pdf');page.dom.window.close();
});
test('generated names fall back to URL, PDF title, then clean default',async()=>{
 for(const [url,body,expected] of [
  ['/vtop/download/file?fileName=Lecture%20Notes.pdf','%PDF-1.4','Lecture Notes.pdf'],
  ['/vtop/download/file','%PDF-1.4 /Title (Lecture Notes)','Lecture Notes.pdf'],
  ['/vtop/download/file','%PDF-1.4','VTOP document.pdf']
 ]){
  const page=bridge({body,disposition:'attachment; filename="abcdef0123456789.pdf"'});
  page.w.open(url);await pause();assert.equal(page.messages.find(m=>m.kind==='ready')?.filename,expected);page.dom.window.close();
 }
});
test('POST downloads retain the clicked document label and send the request once',async()=>{
 const page=bridge({disposition:'attachment; filename="abcdef0123456789.pdf"'});
 const form=page.w.document.createElement('form');form.method='post';form.action='/vtop/download/document';
 const button=page.w.document.createElement('button');button.type='button';button.textContent='Download';button.dataset.filename='Semester Notes';
 button.addEventListener('click',()=>form.submit());form.append(button);page.w.document.body.append(form);
 button.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true}));await pause();
 assert.equal(page.calls.length,1);assert.equal(page.calls[0].init.method,'POST');
 assert.equal(page.messages.find(m=>m.kind==='ready')?.filename,'Semester Notes.pdf');page.dom.window.close();
});

test('VTOP course filenames use the suffix after the last underscore',async()=>{
 for(const type of ['pdf','pptx','ppt','docx','doc']){
  for(const direct of [false,true]){
   const page=bridge({body:type==='pdf'?'%PDF-1.4':'Office bytes',type:'application/octet-stream',disposition:`attachment; filename="FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.${type}"`});
   const link=page.w.document.createElement('a');link.href='/vtop/download/file';
   link.textContent='Cloud Architecture Notes';page.w.document.body.append(link);
   link.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:direct}));await pause();
   assert.equal(direct?page.downloads[0]?.name:page.messages.find(m=>m.kind==='ready')?.filename,`Module-8.${type}`);
   page.dom.window.close();
  }
 }
});
test('extensionless VTOP PDF filenames retain the final suffix and gain a PDF extension',async()=>{
 const page=bridge({disposition:'attachment; filename="FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8"'});
 page.w.open('/vtop/download/file');await pause();
 assert.equal(page.messages.find(m=>m.kind==='ready')?.filename,'Module-8.pdf');page.dom.window.close();
});

test('Shift-clicking an icon button saves a delayed revoked blob with its course filename suffix',async()=>{
 const {dom,w,downloads,messages}=bridge();
 const button=w.document.createElement('button');button.innerHTML='<i class="bi bi-download"></i>';
 button.addEventListener('click',()=>setTimeout(()=>{
  const link=w.document.createElement('a');
  link.href=w.URL.createObjectURL(new w.Blob(['%PDF-1.4']));
  link.download='FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.pdf';
  link.click();w.URL.revokeObjectURL(link.href);
 },5));
 w.document.body.append(button);
 button.firstChild.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();
 assert.equal(downloads.length,1);assert.equal(downloads[0].name,'Module-8.pdf');
 assert.equal(messages.some(m=>m.kind==='loading'||m.kind==='ready'),false);dom.window.close();
});
test('Shift-clicking a download button saves a popup response directly',async()=>{
 const {dom,w,downloads,messages,opens}=bridge({disposition:'attachment; filename="FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.pdf"'});
 const button=w.document.createElement('button');button.title='Download';
 button.addEventListener('click',()=>w.open('/vtop/download/file'));w.document.body.append(button);
 button.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));await pause();
 assert.equal(downloads[0]?.name,'Module-8.pdf');assert.equal(opens.length,0);
 assert.equal(messages.some(m=>m.kind==='loading'||m.kind==='ready'),false);dom.window.close();
});
test('Shift-click saves an already-downloaded course blob without reading it again',()=>{
 const {dom,w,downloads,calls,messages}=bridge();
 const button=w.document.createElement('button');button.title='Download';
 let reads=0;
 button.addEventListener('click',()=>{
  const blob=new w.Blob(['%PDF-1.4'],{type:'application/pdf'});
  blob.slice=()=>{reads++;throw new Error('Direct save should not inspect document bytes');};
  blob.arrayBuffer=()=>{reads++;throw new Error('Direct save should not copy document bytes');};
  const link=w.document.createElement('a');link.href=w.URL.createObjectURL(blob);
  link.download='FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.pdf';
  link.click();w.URL.revokeObjectURL(link.href);
 });
 w.document.body.append(button);
 button.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));
 assert.equal(downloads[0]?.name,'Module-8.pdf');
 assert.equal(reads,0);assert.equal(calls.length,0);assert.equal(messages.length,0);
 dom.window.close();
});
test('Shift-click reuses the original completed course download URL',()=>{
 const {dom,w,downloads}=bridge();let url;
 const button=w.document.createElement('button');button.title='Download Material';
 button.addEventListener('click',()=>{
  const link=w.document.createElement('a');
  url=w.URL.createObjectURL(new w.Blob(['%PDF-1.4'],{type:'application/pdf'}));
  link.href=url;link.download='FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.pdf';
  link.click();w.URL.revokeObjectURL(url);
 });
 w.document.body.append(button);
 button.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,shiftKey:true}));
 assert.deepEqual(downloads,[{href:url,name:'Module-8.pdf'}]);
 dom.window.close();
});

const materialButtons=host=>[...host.shadowRoot.querySelectorAll('button')];
async function courseMaterial(page,{title='m1 - intro',header='thead',native='button',settings={}}={}){
 const {w}=page;
 w.document.body.innerHTML=`<table><${header}><tr><th>#</th><th>Course Detail</th><th>Material Detail</th><th>Uploaded By</th><th>Download</th></tr></${header}><tbody><tr><td>12</td><td>Fall Semester 2026-27<br>BITE314L - Multimedia Systems - TH</td><td class="material"><span></span><br><i>1</i> <span>(Document)</span></td><td>19725 - Faculty<br>21-07-2026</td><td class="action">${native==='button'?'<button type="button"><i class="bi bi-download"></i></button>':native==='icon'?'<i class="bi bi-download" onclick=""></i>':'<a href="/vtop/download/file"><i class="bi bi-download"></i></a>'}</td></tr></tbody></table>`;
 w.document.querySelector('.material span').textContent=title;
 const original=w.document.querySelector('.action').firstChild;
 if(native!=='a')original.addEventListener('click',()=>w.open('/vtop/download/file'));
 if(!page.materialUI){
  page.materialUI=true;page.materialListeners=[];
  w.chrome={storage:{local:{get:async()=>settings},onChanged:{addListener:listener=>page.materialListeners.push(listener)}}};
  for(const file of ['brand','semesters','enhancements','page-enhancements'])w.eval(fs.readFileSync(__dirname+`/../build/${file}.js`,'utf8'));
 }
 await new Promise(resolve=>setTimeout(resolve,200));
 const actions=w.document.querySelector('[data-vtop-material-actions]');
 assert.ok(actions);const buttons=materialButtons(actions);
 assert.deepEqual(buttons.map(button=>button.textContent),['Preview','Download']);
 assert.deepEqual(buttons.map(button=>button.getAttribute('aria-label')),[`Preview ${title}`,`Download ${title}`]);
 assert.equal(original.dataset.vtopMaterialOriginal,'true');
 return{original,actions,preview:buttons[0],download:buttons[1]};
}

test('course material actions use Material Detail for direct and preview downloads across file types',async()=>{
 for(const type of ['pdf','pptx','ppt','docx','doc','zip']){
  for(const direct of [false,true]){
   const page=bridge({body:type==='pdf'?'%PDF-1.4 /Title (Unrelated PDF title)':'file bytes',type:'application/octet-stream',disposition:`attachment; filename="Original Notes.${type}"`});
   const controls=await courseMaterial(page,{header:direct?'tbody':'thead'});
   (direct?controls.download:controls.preview).click();await pause();
   assert.equal(controls.original.hasAttribute('data-vtop-material-action'),false);
   assert.equal(page.calls.length,1);assert.equal(page.opens.length,0);
   if(direct||type==='zip'){
    assert.equal(page.downloads[0]?.name,`m1 - intro.${type}`);
    assert.equal(page.messages.some(message=>message.kind==='ready'),false);
    if(direct)assert.equal(page.messages.some(message=>message.kind==='loading'),false);
   }else{
    const ready=page.messages.find(message=>message.kind==='ready');
    assert.equal(ready?.filename,`m1 - intro.${type}`);assert.equal(ready.previewName,ready.filename);
    const viewer=previewWindow();viewer.send(ready.id,'loading');viewer.send(ready.id,'ready',ready);await pause();
    assert.equal(viewer.shadow.querySelector('.download').download,`m1 - intro.${type}`);
    viewer.dom.window.close();assert.equal(page.downloads.length,0);
   }
   page.dom.window.close();
  }
 }
});

test('explicit material actions also work for native download links and sanitize the title',async()=>{
 for(const direct of [false,true]){
  const page=bridge({disposition:'attachment; filename="FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.pdf"'});
  const controls=await courseMaterial(page,{native:'a',title:'Module 1.2 / Audio: intro'});
  (direct?controls.download:controls.preview).click();await pause();
  assert.equal(direct?page.downloads[0]?.name:page.messages.find(m=>m.kind==='ready')?.filename,'Module 1.2 _ Audio_ intro.pdf');
  assert.equal(page.calls.length,1);page.dom.window.close();
 }
});

test('material titles override the fast save path for delayed revoked VTOP blobs',async()=>{
 const page=bridge(),controls=await courseMaterial(page);
 controls.original.replaceWith(controls.original.cloneNode(true));
 const original=page.w.document.querySelector('[data-vtop-material-original]');
 let blobUrl,reads=0;
 original.addEventListener('click',()=>setTimeout(()=>{
  const blob=new page.w.Blob(['%PDF-1.4'],{type:'application/pdf'});
  blob.slice=()=>{reads++;throw new Error('Completed download must not be read again');};
  const anchor=page.w.document.createElement('a');blobUrl=page.w.URL.createObjectURL(blob);anchor.href=blobUrl;
  anchor.download='FALLSEM2026-27_VL_BCSE355L_00200_TH_2026-11-05_Module-8.pdf';
  anchor.click();page.w.URL.revokeObjectURL(blobUrl);
 },5));
 await new Promise(resolve=>setTimeout(resolve,200));
 // The replacement row gets a fresh pair bound to the new original control.
 assert.equal(page.w.document.querySelectorAll('[data-vtop-material-actions]').length,1);
 materialButtons(page.w.document.querySelector('[data-vtop-material-actions]'))[1].click();await pause();
 assert.deepEqual(page.downloads,[{href:blobUrl,name:'m1 - intro.pdf'}]);
 assert.equal(reads,0);assert.equal(page.calls.length,0);assert.equal(page.messages.length,0);page.dom.window.close();
});

test('material controls stay unique after redraws and use the current title',async()=>{
 const page=bridge(),controls=await courseMaterial(page);
 page.w.document.querySelector('.material span').textContent='audio';
 await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(page.w.document.querySelectorAll('[data-vtop-material-actions]').length,1);
 controls.download.click();await pause();assert.equal(page.downloads[0]?.name,'audio.pdf');
 await courseMaterial(page,{title:'sound'});
 assert.equal(page.w.document.querySelectorAll('[data-vtop-material-actions]').length,1);
 materialButtons(page.w.document.querySelector('[data-vtop-material-actions]'))[1].click();await pause();
 assert.equal(page.downloads[1]?.name,'sound.pdf');page.dom.window.close();
});

test('unrelated document tables do not gain course material actions',async()=>{
 const page=bridge();await courseMaterial(page);
 page.w.document.body.innerHTML='<table><tr><th>Document Title</th><th>Download</th></tr><tr><td>Notes</td><td><button>Download</button></td></tr></table>';
 await new Promise(resolve=>setTimeout(resolve,200));assert.equal(page.w.document.querySelector('[data-vtop-material-actions]'),null);page.dom.window.close();
});

test('explicit material actions honor their choice even with modifier keys',async()=>{
 for(const direct of [false,true]){
  const page=bridge(),controls=await courseMaterial(page);
  (direct?controls.download:controls.preview).dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));await pause();
  assert.equal(page.opens.length,0);assert.equal(page.calls.length,1);
  assert.equal(direct?page.downloads[0]?.name:page.messages.find(message=>message.kind==='ready')?.filename,'m1 - intro.pdf');
  page.dom.window.close();
 }
});

test('Shift-clicking Preview downloads directly for native buttons and links',async()=>{
 for(const native of ['button','a']){
  const page=bridge(),controls=await courseMaterial(page,{native});
  controls.preview.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,composed:true,cancelable:true,shiftKey:true}));await pause();
  assert.equal(page.calls.length,1);assert.equal(page.opens.length,0);
  assert.equal(page.downloads[0]?.name,'m1 - intro.pdf');
  assert.equal(page.messages.some(message=>message.kind==='ready'||message.kind==='loading'),false);
  assert.equal(controls.original.hasAttribute('data-vtop-material-action'),false);page.dom.window.close();
 }
});

test('unrelated popups in a material row never acquire download intent',async()=>{
 const page=bridge();await courseMaterial(page);
 const button=page.w.document.createElement('button');button.textContent='Student Login';
 button.addEventListener('click',()=>page.w.open('/vtop/login'));
 page.w.document.querySelector('.material').append(button);button.click();await pause();
 assert.equal(page.calls.length,0);assert.equal(page.opens.length,1);assert.equal(page.messages.length,0);page.dom.window.close();
});

test('material buttons follow brand themes and update accessible names on DOM replacement',async()=>{
 const page=bridge(),controls=await courseMaterial(page,{settings:{theme:'dark'}});
 assert.equal(controls.actions.dataset.theme,'dark');
 assert.match(controls.actions.shadowRoot.querySelector('style').textContent,/var\(--accent\)/);
 for(const theme of ['oled','blue','light']){
  page.materialListeners.forEach(listener=>listener({theme:{newValue:theme}},'local'));
  assert.equal(controls.actions.dataset.theme,theme);
 }
 page.w.document.querySelector('.material span').textContent='audio';await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(controls.preview.getAttribute('aria-label'),'Preview audio');
 assert.equal(controls.download.getAttribute('aria-label'),'Download audio');page.dom.window.close();
});

test('material scans ignore character-only mutations and still handle AJAX replacements',async()=>{
 const page=bridge(),controls=await courseMaterial(page);let reads=0;
 const createRange=page.w.document.createRange.bind(page.w.document);
 page.w.document.createRange=()=>{reads++;return createRange();};
 page.w.document.querySelector('.material span').firstChild.data='audio';
 await new Promise(resolve=>setTimeout(resolve,200));assert.equal(reads,0);
 page.w.document.querySelector('.material span').textContent='sound';
 await new Promise(resolve=>setTimeout(resolve,200));assert.ok(reads>0);
 assert.equal(controls.download.getAttribute('aria-label'),'Download sound');page.dom.window.close();
});

test('native DOM clicks from the content world retain the material action',async(t)=>{
 const page=bridge(),controls=await courseMaterial(page,{native:'a'});
 t.after(()=>page.dom.window.close());
 // Isolated-world click() reaches the MAIN-world document listener, without
 // calling its patched HTMLAnchorElement.prototype.click first.
 controls.original.click=()=>controls.original.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true}));
 controls.download.click();await pause();
 assert.equal(page.calls.length,1);assert.equal(page.downloads[0]?.name,'m1 - intro.pdf');
 assert.equal(page.messages.some(message=>message.kind==='ready'),false);page.dom.window.close();
});

test('material actions work when the native control is a bare onclick icon',async(t)=>{
 for(const direct of [false,true]){
  const page=bridge(),controls=await courseMaterial(page,{native:'icon'});
  t.after(()=>page.dom.window.close());
  (direct?controls.download:controls.preview).click();await pause();
  assert.equal(page.calls.length,1);assert.equal(page.opens.length,0);
  if(direct){
   assert.equal(page.downloads[0]?.name,'m1 - intro.pdf');
   assert.equal(page.messages.some(message=>message.kind==='loading'),false);
  }else{
   assert.equal(page.messages.find(message=>message.kind==='ready')?.filename,'m1 - intro.pdf');
   assert.equal(page.downloads.length,0);
  }
  page.dom.window.close();
 }
});

test('material POST helpers preserve authentication fields and send the request once',async(t)=>{
 const page=bridge(),controls=await courseMaterial(page,{native:'a'}),form=page.w.document.createElement('form');
 t.after(()=>page.dom.window.close());
 form.method='post';form.action='/vtop/academics/renderFile';form.innerHTML='<input name="_csrf" value="test-only"><input name="materialId" value="12">';
 page.w.document.body.append(form);controls.original.href='javascript:void(0)';
 controls.original.click=()=>controls.original.dispatchEvent(new page.w.MouseEvent('click',{bubbles:true,cancelable:true}));
 controls.original.addEventListener('click',()=>form.submit());controls.download.click();await pause();
 assert.equal(page.calls.length,1);assert.equal(page.calls[0].init.method,'POST');
 assert.equal(page.calls[0].init.body.get('_csrf'),'test-only');assert.equal(page.calls[0].init.body.get('materialId'),'12');
 assert.equal(page.downloads[0]?.name,'m1 - intro.pdf');page.dom.window.close();
});
