const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const semester='<select id="semesterSubId"><option value="">Choose semester</option><option value="S1">Fall Semester 2026-27</option></select>';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(){
 const dom=new JSDOM(`<nav><a href="#" class="systemB5BtnMenu" data-url="marks">Marks</a></nav><main id="b5-pagewrapper"><h1>Attendance</h1>${semester}</main>`,{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),w=dom.window;
 const requests=[];w.fetch=()=>new Promise((resolve,reject)=>requests.push({resolve:()=>resolve({ok:true}),reject}));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.chrome={storage:{local:{get:async()=>({defaultSemester:{value:'S1',label:'Fall Semester 2026-27'}}),set:async()=>{}},onChanged:{addListener(){}}}};
 function load(file){w.eval(fs.readFileSync(__dirname+'/../build/'+file,'utf8'));}
 for(const file of ['navigation.js','semesters.js','page-runtime.js','page-actions.js'])load(file);
 function block(){const overlay=w.document.createElement('div');overlay.className='blockUI blockOverlay';w.document.body.append(overlay);return overlay;}
 return{dom,w,requests,load,block};
}
test('saved semester waits for page load, releases its orphaned loading overlay, and Cmd+K opens Marks',async()=>{
 const {dom,w,requests,load,block}=setup();
 let oldChanges=0,markChanges=0,clicks=0;
 const first=w.fetch('/load/attendance');
 w.document.querySelector('select').addEventListener('change',()=>{oldChanges++;block();w.fetch('/attendance/results').catch(()=>{});});
 w.document.querySelector('a').addEventListener('click',event=>{
  event.preventDefault();assert.equal(w.document.querySelector('.blockOverlay'),null);clicks++;
  w.document.querySelector('main').innerHTML='<h1>Marks</h1>'+semester;
  w.document.querySelector('select').addEventListener('change',()=>{markChanges++;});
 });
 load('brand.js');load('combobox.js');load('content.js');await pause(100);
 assert.equal(oldChanges,0,'no automatic change while native page is still loading');
 requests[0].resolve();await first;await pause(120);
 assert.equal(oldChanges,1);assert.ok(w.document.querySelector('.blockOverlay'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));
 const shadow=w.document.querySelector('#vtop-command-root').shadowRoot,input=shadow.querySelector('.search input');input.value='Marks';input.dispatchEvent(new w.Event('input'));input.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await pause(80);assert.equal(clicks,0,'navigation waits for the semester request');
 requests[1].resolve();await pause(600);
 assert.equal(clicks,1);assert.equal(w.document.querySelector('h1').textContent,'Marks');assert.equal(markChanges,1);
 assert.equal(w.document.querySelector('select').value,'S1');assert.equal(w.document.querySelector('.blockOverlay'),null);
 assert.equal(w.document.documentElement.getAttribute('data-vtop-page-busy'),'false');dom.window.close();
});
test('an unrelated native overlay is never removed to force automatic selection',async()=>{
 const {dom,w,block}=setup();const overlay=block();let changes=0;w.document.querySelector('select').addEventListener('change',()=>changes++);
 const result=w.VtopPageActions.change(w.document.querySelector('select'),'S1');await pause(180);
 assert.equal(changes,0);assert.equal(overlay.isConnected,true);overlay.remove();assert.equal(await result,true);assert.equal(changes,1);dom.window.close();
});
test('navigation cancels queued changes from the previous page',async()=>{
 const {dom,w,requests}=setup();const loading=w.fetch('/existing');let changes=0,clicks=0;
 w.document.querySelector('select').addEventListener('change',()=>changes++);w.document.querySelector('a').addEventListener('click',event=>{event.preventDefault();clicks++;});
 const old=w.VtopPageActions.change(w.document.querySelector('select'),'S1');w.VtopPageActions.navigate(()=>w.document.querySelector('a'));
 assert.equal(await old,false);requests[0].resolve();await loading;await pause(220);
 assert.equal(changes,0);assert.equal(clicks,1);dom.window.close();
});
test('failed automatic request releases only its own blocker and permits another page click',async()=>{
 const {dom,w,requests,block}=setup();let clicks=0;
 w.document.querySelector('select').addEventListener('change',()=>{block();w.fetch('/failed').catch(()=>{});});
 w.document.querySelector('a').addEventListener('click',event=>{event.preventDefault();clicks++;});
 const result=w.VtopPageActions.change(w.document.querySelector('select'),'S1');await pause(100);requests[0].reject(new Error('network error'));await result;
 assert.equal(w.document.querySelector('.blockOverlay'),null);w.VtopPageActions.navigate(()=>w.document.querySelector('a'));await pause(220);assert.equal(clicks,1);dom.window.close();
});
test('automatic selection waits for fetch response bodies, not just response headers',async()=>{
 const {dom,w}=setup();let bodyController,changes=0;
 // Start a real streaming response behind a second runtime instance in a clean document.
 dom.window.close();
 const other=new JSDOM('<select><option value="">Choose</option><option value="S1">Fall Semester 2026-27</option></select>',{runScripts:'outside-only',url:'https://vtop.vit.ac.in/vtop/content'}),page=other.window;
 page.fetch=async()=>new Response(new ReadableStream({start(controller){bodyController=controller;}}));
 for(const file of ['page-runtime.js','page-actions.js'])page.eval(fs.readFileSync(__dirname+'/../build/'+file,'utf8'));
 const response=await page.fetch('/slow-body');const select=page.document.querySelector('select');select.addEventListener('change',()=>changes++);
 const action=page.VtopPageActions.change(select,'S1');await pause(150);assert.equal(changes,0);
 bodyController.enqueue(new TextEncoder().encode('loaded'));bodyController.close();await response.text();assert.equal(await action,true);assert.equal(changes,1);other.window.close();
});
test('forced lookup reruns an unchanged parent; known form dates run change handlers without submitting',async()=>{
 const {dom,w}=setup();const select=w.document.querySelector('select');let changes=0,submits=0;select.value='S1';select.addEventListener('change',()=>changes++);assert.equal(await w.VtopPageActions.change(select,'S1'),true);assert.equal(changes,0);assert.equal(await w.VtopPageActions.change(select,'S1',{force:true}),true);assert.equal(changes,1);
 w.document.querySelector('main').insertAdjacentHTML('beforeend','<form id="LateHourRequestForm"><input type="date" id="lateHourFromDate"><button type="submit">Submit</button></form><form id="other"><input type="date"></form>');w.document.addEventListener('submit',e=>{e.preventDefault();submits++;});let dateChanges=0;const date=w.document.querySelector('#lateHourFromDate');date.addEventListener('change',()=>dateChanges++);assert.equal(await w.VtopPageActions.change(date,'2026-11-03'),true);assert.equal(dateChanges,1);assert.equal(date.value,'2026-11-03');assert.equal(await w.VtopPageActions.change(w.document.querySelector('#other input'),'2026-11-03'),false);assert.equal(submits,0);dom.window.close();
});
test('a multiple select takes a list of enabled options, keeps disabled choices, and rejects anything else',async()=>{
 const {dom,w}=setup();let changes=0,submits=0;
 w.document.querySelector('main').insertAdjacentHTML('beforeend','<form id="LeaveRequestForm"><select id="days" multiple><option value="mon">Monday</option><option value="tue">Tuesday</option><option value="wed">Wednesday</option><option value="sun" disabled selected>Sunday</option><option value="sat" disabled>Saturday</option></select><button type="submit">Submit</button></form>');
 w.document.addEventListener('submit',e=>{e.preventDefault();submits++;});
 const days=w.document.querySelector('#days'),chosen=()=>[...days.selectedOptions].map(o=>o.value);days.addEventListener('change',()=>changes++);
 assert.equal(await w.VtopPageActions.change(days,['tue','mon','sun']),true);assert.deepEqual(chosen(),['mon','tue','sun']);assert.equal(changes,1);
 assert.equal(await w.VtopPageActions.change(days,['sun','tue','mon']),true,'the same choices in another order are unchanged');assert.equal(changes,1);
 assert.equal(await w.VtopPageActions.change(days,['wed']),true,'a disabled choice left out stays chosen');assert.deepEqual(chosen(),['wed','sun']);assert.equal(changes,2);
 assert.equal(await w.VtopPageActions.change(days,[]),true);assert.deepEqual(chosen(),['sun']);assert.equal(changes,3);
 for(const value of [['mon','sat'],['mon','missing'],['mon',3],[['mon']]])assert.equal(await w.VtopPageActions.change(days,value),false,JSON.stringify(value));
 assert.deepEqual(chosen(),['sun']);assert.equal(changes,3);
 const semester=w.document.querySelector('#semesterSubId');let semesterChanges=0;semester.addEventListener('change',()=>semesterChanges++);
 assert.equal(await w.VtopPageActions.change(semester,['S1']),false,'a single select takes one value, not a list');assert.equal(semester.value,'');assert.equal(semesterChanges,0);
 assert.equal(submits,0);dom.window.close();
});
