const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const pause=()=>new Promise(resolve=>setTimeout(resolve,35));
function setup({query='',bytes,referrer}={}){
 const html=fs.readFileSync(__dirname+'/../static/pdf-viewer.html','utf8');
 const dom=new JSDOM(html,{runScripts:'outside-only',url:`https://vtop.vit.ac.in/pdf-viewer.html${query}#scroll-test`,referrer,pretendToBeVisual:true}),w=dom.window;
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));
 const container=w.document.querySelector('#pages'),paints=[];let observer;
 Object.defineProperty(container,'clientWidth',{value:800});
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(this===container)return{top:0,bottom:600};if(this.classList.contains('sheet')){const top=this.offsetTop-container.scrollTop;return{top,bottom:top+parseFloat(this.style.height)};}return{top:0,bottom:0};};
 Object.defineProperty(w.HTMLElement.prototype,'offsetTop',{get(){return this.classList.contains('sheet')?(Number(this.dataset.page)-1)*(parseFloat(this.style.height)+18):0;}});
 w.HTMLElement.prototype.scrollIntoView=function(){container.scrollTop=this.offsetTop;container.dispatchEvent(new w.Event('scroll'));};
 w.HTMLCanvasElement.prototype.getContext=()=>({});
 w.ResizeObserver=class{observe(){}};
 w.IntersectionObserver=class{constructor(callback){this.callback=callback;observer=this;}observe(element){this.callback([{target:element,isIntersecting:element.dataset.page==='1'}]);}};
 w.testPdf={GlobalWorkerOptions:{},VerbosityLevel:{ERRORS:0},getDocument:()=>({promise:Promise.resolve({numPages:3,getPage:async number=>({getViewport:({scale})=>({width:600*scale,height:800*scale}),render:()=>{paints.push(number);return{promise:Promise.resolve(),cancel(){}};},getTextContent:async()=>({items:[{str:`Sample page ${number}`} ]})})})})};
 let source=fs.readFileSync(__dirname+'/../build/pdf-viewer.mjs','utf8').replace(/^import \* as pdfjs[^\n]+\n/,'const pdfjs=window.testPdf;\n').replaceAll('import.meta.url',JSON.stringify('https://vtop.vit.ac.in/pdf-viewer.mjs'));
 w.eval(source);
 w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:'https://vtop.vit.ac.in',data:{type:'pdf-data',nonce:'scroll-test',bytes:bytes||new w.ArrayBuffer(8)}}));
 return{dom,w,container,paints,entries:entries=>observer.callback(entries)};
}
test('continuous viewer creates every page in one scroll container and renders only nearby pages',async()=>{
 const {dom,w,container,paints,entries}=setup();await pause();
 const pages=[...container.querySelectorAll('.sheet')];assert.equal(pages.length,3);assert.ok(paints.includes(1));assert.ok(!paints.includes(3));
 container.scrollTop=pages[2].offsetTop;entries([{target:pages[0],isIntersecting:false},{target:pages[2],isIntersecting:true}]);await pause();
 assert.equal(pages[0].querySelector('canvas').width,0);assert.ok(pages[2].querySelector('canvas').width>0);assert.equal(w.document.querySelector('#page').value,'3');dom.window.close();
});
test('page controls scroll within the full document instead of replacing a single canvas',async()=>{
 const {dom,w,container}=setup();await pause();const original=[...container.children];
 const input=w.document.querySelector('#page');input.value='2';input.dispatchEvent(new w.Event('change'));await pause();assert.equal(input.value,'2');assert.ok(container.scrollTop>0);assert.equal(container.children.length,3);assert.equal(container.children[0],original[0]);
 input.value='3';input.dispatchEvent(new w.Event('change'));await pause();assert.equal(container.children[2],original[2]);assert.equal(input.value,'3');dom.window.close();
});
test('zoom resizes all page placeholders while retaining continuous page order',async()=>{
 const {dom,w,container}=setup();await pause();const pages=[...container.children],width=parseFloat(pages[0].style.width);
 w.document.querySelector('#zoom-in').click();await pause();assert.ok(parseFloat(pages[0].style.width)>width);
 assert.deepEqual([...container.children].map(page=>page.dataset.page),['1','2','3']);assert.equal(container.children[0],pages[0]);assert.equal(parseFloat(pages[0].style.width),parseFloat(pages[2].style.width));dom.window.close();
});
test('viewer acknowledges the document and reports when it has loaded',async()=>{
 const {dom,w}=setup(),types=[];w.addEventListener('message',event=>types.push(event.data?.type));await pause();
 assert.ok(types.includes('viewer-loaded'));assert.equal(w.document.querySelector('#status').textContent,'');dom.window.close();
});
test('viewer accepts PDF bytes transferred from another JavaScript realm',async()=>{
 const other=new JSDOM('');const {dom,w}=setup({bytes:new other.window.ArrayBuffer(8),referrer:'moz-extension://test-extension/pdf-preview.js'});await pause();
 assert.equal(w.document.querySelector('#total').textContent,'/ 3');assert.equal(w.document.querySelector('#status').textContent,'');other.window.close();dom.window.close();
});
test('Cmd/Ctrl+wheel and pinch zoom the document; a plain wheel only scrolls',async()=>{
 const {dom,w,container}=setup();await pause();const page=container.children[0],width=parseFloat(page.style.width);
 const plain=new w.WheelEvent('wheel',{deltaY:100,cancelable:true,clientX:400,clientY:300});container.dispatchEvent(plain);
 assert.equal(plain.defaultPrevented,false);assert.equal(parseFloat(page.style.width),width);
 const zoomIn=new w.WheelEvent('wheel',{deltaY:-100,metaKey:true,cancelable:true,clientX:400,clientY:300});container.dispatchEvent(zoomIn);
 assert.equal(zoomIn.defaultPrevented,true);const zoomed=parseFloat(page.style.width);assert.ok(zoomed>width);
 const pinch=new w.WheelEvent('wheel',{deltaY:8,ctrlKey:true,cancelable:true,clientX:400,clientY:300});container.dispatchEvent(pinch);
 assert.ok(parseFloat(page.style.width)<zoomed);assert.match(w.document.querySelector('#zoom').textContent,/^\d+%$/);
 assert.deepEqual([...container.children].map(sheet=>sheet.dataset.page),['1','2','3']);dom.window.close();
});
test('keyboard zoom shortcuts work inside the viewer and Cmd+0 fits the width again',async()=>{
 const {dom,w,container}=setup();await pause();const page=container.children[0],width=parseFloat(page.style.width);
 w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'=',metaKey:true,cancelable:true}));assert.ok(parseFloat(page.style.width)>width);
 w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'0',ctrlKey:true,cancelable:true}));await pause();assert.equal(parseFloat(page.style.width),width);dom.window.close();
});
test('viewer uses the shared palette, starts in the requested theme and forwards Escape/Cmd+K to the shell',async()=>{
 const {dom,w}=setup({query:'?theme=dark'}),messages=[];w.addEventListener('message',event=>messages.push(event.data));await pause();
 assert.equal(w.document.documentElement.hasAttribute('data-dark'),true);assert.match(w.document.head.querySelector('style').textContent,/--backdrop/);
 w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',cancelable:true}));w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,cancelable:true}));await pause();
 assert.deepEqual(messages.filter(m=>m?.type==='viewer-key').map(m=>m.key),['Escape','k']);dom.window.close();
});
