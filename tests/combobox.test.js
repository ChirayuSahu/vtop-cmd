const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
function setup(markup='<option value="">Choose a semester…</option><option value="fall">Fall Semester 2026-27</option><option value="winter">Winter Semester 2026-27</option><option disabled value="old">Old Semester</option>'){
 const dom=new JSDOM(`<dialog open><label>Term<select>${markup}</select></label></dialog>`,{runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync(__dirname+'/../build/brand.js','utf8'));
 w.eval(fs.readFileSync(__dirname+'/../build/combobox.js','utf8'));
 const select=w.document.querySelector('select'),changes=[];select.addEventListener('change',()=>changes.push(select.value));
 const box=w.VtopCombobox.create(select,{label:'Semester'});
 const key=(target,value)=>{const event=new w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true});target.dispatchEvent(event);return event;};
 const type=value=>{box.input.value=value;box.input.dispatchEvent(new w.Event('input'));};
 const items=()=>[...box.element.querySelectorAll('[role=option]')].map(item=>item.textContent);
 return {dom,w,select,box,changes,key,type,items};
}
const tick=()=>new Promise(r=>setTimeout(r,0));
test('trigger shows the placeholder, opens a searchable list and skips prompt and disabled options',()=>{
 const s=setup();assert.equal(s.box.trigger.textContent.trim(),'Choose a semester…');assert.equal(s.box.trigger.getAttribute('aria-expanded'),'false');
 s.box.trigger.click();assert.equal(s.box.trigger.getAttribute('aria-expanded'),'true');assert.equal(s.w.document.activeElement,s.box.input);
 assert.deepEqual(s.items(),['Fall Semester 2026-27','Winter Semester 2026-27']);
 s.type('win 26');assert.deepEqual(s.items(),['Winter Semester 2026-27']);
 s.type('summer');assert.deepEqual(s.items(),[]);assert.match(s.box.element.querySelector('.cb-empty').textContent,/No results/);s.dom.window.close();
});
test('arrow keys and Enter choose through the native select and fire one change event',async()=>{
 const s=setup();s.key(s.box.trigger,'ArrowDown');assert.equal(s.box.trigger.getAttribute('aria-expanded'),'true');
 s.key(s.box.input,'ArrowDown');s.key(s.box.input,'Enter');await tick();
 assert.equal(s.select.value,'winter');assert.deepEqual(s.changes,['winter']);assert.equal(s.box.trigger.textContent.trim(),'Winter Semester 2026-27');
 assert.equal(s.box.trigger.getAttribute('aria-expanded'),'false');assert.equal(s.w.document.activeElement,s.box.trigger);s.dom.window.close();
});
test('Escape closes only the list; typing on the trigger starts a search',()=>{
 const s=setup();s.key(s.box.trigger,'w');assert.equal(s.box.input.value,'w');assert.deepEqual(s.items(),['Winter Semester 2026-27']);
 const event=s.key(s.box.input,'Escape');assert.equal(event.defaultPrevented,true);assert.equal(s.box.trigger.getAttribute('aria-expanded'),'false');
 assert.equal(s.w.document.querySelector('dialog').open,true);assert.equal(s.changes.length,0);s.dom.window.close();
});
test('follows replaced options, programmatic values and disabled state',async()=>{
 const s=setup();s.select.replaceChildren(new s.w.Option('Loading semesters…',''));s.select.disabled=true;await tick();
 assert.equal(s.box.trigger.disabled,true);assert.equal(s.box.trigger.textContent.trim(),'Loading semesters…');
 s.select.replaceChildren(new s.w.Option('Choose…',''),new s.w.Option('Fall','fall'));s.select.disabled=false;s.select.value='fall';s.box.sync();
 assert.equal(s.box.trigger.disabled,false);assert.equal(s.box.trigger.textContent.trim(),'Fall');s.dom.window.close();
});
test('a click outside closes the list without choosing',()=>{
 const s=setup();s.box.trigger.click();s.w.document.body.dispatchEvent(new s.w.Event('pointerdown',{bubbles:true,composed:true}));
 assert.equal(s.box.trigger.getAttribute('aria-expanded'),'false');assert.equal(s.changes.length,0);s.dom.window.close();
});
