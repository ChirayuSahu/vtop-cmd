const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(__dirname+'/../build/deadline-cache.js','utf8');
const client=fs.readFileSync(__dirname+'/../build/deadline-cache-client.js','utf8');
const entry=()=>({records:[{title:'Example assignment',time:Date.now()+86400000,dateOnly:true,submitted:false}],expires:Date.now()+2*3600000});
function background({fail=false}={}){
 let listener;const data={},writes=[];
 const api={runtime:{id:'extension',onMessage:{addListener:fn=>{listener=fn;}}},storage:{session:{
  get:async key=>{if(fail)throw Error('Unavailable');return {[key]:JSON.parse(JSON.stringify(data[key]||{}))};},
  set:async value=>{if(fail)throw Error('Unavailable');writes.push(value);Object.assign(data,JSON.parse(JSON.stringify(value)));}
 }}};
 vm.runInNewContext(source,{browser:api,Date,Map,Object,Number});
 const sender={id:'extension',url:'https://vtop.vit.ac.in/vtop/content'};
 const call=(message,who=sender)=>new Promise(resolve=>listener({type:'vtop-deadline-cache',owner:'student-A',...message},who,resolve));
 return{call,data,writes,api};
}
test('privileged relay preserves TTLs and isolates each signed-in account',async()=>{
 const b=background(),saved=entry();
 await b.call({action:'update',put:{COURSE1:saved}});
 const a=await b.call({action:'get'});assert.equal(a.deadlineCache.COURSE1.expires,saved.expires);
 assert.equal(a.deadlineCache.COURSE1.records[0].title,'Example assignment');
 assert.deepEqual(Object.keys((await b.call({action:'get',owner:'student-B'})).deadlineCache),[]);
 assert.ok(!Object.hasOwn(b.data,'deadlineCache'),'legacy unscoped records are not reused');
});
test('simultaneous course updates merge; upload invalidation cannot be undone by another tab saving a different course',async()=>{
 const b=background();await Promise.all([b.call({action:'update',put:{A1:entry()}}),b.call({action:'update',put:{B2:entry()}})]);
 assert.deepEqual(Object.keys((await b.call({action:'get'})).deadlineCache).sort(),['A1','B2']);
 await Promise.all([b.call({action:'update',remove:['A1']}),b.call({action:'update',put:{C3:entry()}})]);
 assert.deepEqual(Object.keys((await b.call({action:'get'})).deadlineCache).sort(),['B2','C3']);
 await b.call({action:'update',clear:true});assert.equal(Object.keys((await b.call({action:'get'})).deadlineCache).length,0);
});
test('expired or malformed entries, arbitrary keys and foreign senders are rejected',async()=>{
 const b=background();const stale={...entry(),expires:Date.now()-1};
 await b.call({action:'update',put:{OLD:stale,BAD:{records:'wrong',expires:Date.now()+1000}}});
 assert.equal(Object.keys((await b.call({action:'get'})).deadlineCache).length,0);
 const foreign=await b.call({action:'get'},{id:'extension',url:'https://example.com/'});assert.equal(foreign.ok,false);
 assert.equal((await b.call({action:'get'},{id:'another',url:'https://vtop.vit.ac.in/vtop/content'})).ok,false);
 await b.call({action:'update',put:JSON.parse('{"__proto__":{"records":[],"expires":99999999999999}}')});
 assert.equal(Object.keys((await b.call({action:'get'})).deadlineCache).length,0);
});
test('background memory provides a disk-free fallback when session storage fails',async()=>{
 const b=background({fail:true});await b.call({action:'update',put:{A1:entry()}});
 assert.ok((await b.call({action:'get'})).deadlineCache.A1);assert.equal(b.writes.length,0);
});
test('Firefox-style client without content-script storage.session reuses background cache across page reloads',async()=>{
 const b=background();
 function page(){
  const dom=new JSDOM('<input id="authorizedIDX" value="student-A">',{runScripts:'outside-only'});
  dom.window.browser={runtime:{sendMessage:message=>b.call(message)}};dom.window.eval(client);
  return{dom,cache:dom.window.VtopDeadlineCache.create()};
 }
 const one=page();await one.cache.update({put:{A1:entry()}});one.dom.window.close();
 const two=page();assert.ok((await two.cache.get()).deadlineCache.A1);two.dom.window.close();
});
