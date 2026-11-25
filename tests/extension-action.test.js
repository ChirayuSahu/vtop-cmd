const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(sendMessage,version='1.2.7'){
 let listener;const opened=[],access=[],lifecycle=[];
 const chrome={action:{onClicked:{addListener:callback=>{listener=callback;}}},tabs:{sendMessage,create:async tab=>opened.push(tab)},
  storage:{session:{setAccessLevel:async options=>access.push(options.accessLevel)}},
  runtime:{getManifest:()=>({version}),onStartup:{addListener:callback=>lifecycle.push(['startup',callback])},onInstalled:{addListener:callback=>lifecycle.push(['installed',callback])}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../build/extension-action.js','utf8'),{chrome});
 return{click:tab=>listener(tab),opened,access,lifecycle};
}
test('toolbar logo opens the existing VTOP command menu',async()=>{
 const sent=[];const runtime=setup(async(id,message)=>{sent.push({id,type:message.type});});await runtime.click({id:12});
 assert.deepEqual(sent,[{id:12,type:'vtop-toggle-command-menu'}]);assert.equal(runtime.opened.length,0);
});
test('toolbar logo opens VTOP when the current tab has no extension listener',async()=>{
 const runtime=setup(async()=>{throw new Error('No receiver');});await runtime.click({id:12});
 assert.equal(runtime.opened.length,1);assert.equal(runtime.opened[0].url,'https://vtop.vit.ac.in/vtop/content');
});
test('toolbar startup does not expose privileged session storage to content scripts',async()=>{
 const runtime=setup(async()=>{});
 assert.deepEqual(runtime.lifecycle.map(([event])=>event),['installed'],'only the update notice listens to lifecycle events');
 await runtime.lifecycle[0][1]({reason:'update',previousVersion:'1.2.6'});
 assert.deepEqual(runtime.access,[]);
});
test('an update opens the What\'s new page once for the installed version',async()=>{
 const runtime=setup(async()=>{});const installed=runtime.lifecycle.find(([event])=>event==='installed')[1];
 await installed({reason:'update',previousVersion:'1.2.6'});
 assert.deepEqual(runtime.opened.map(tab=>tab.url),['https://vtop-cmd.chirayusahu.com/whats-new?v=1.2.7']);
 // A first install, a reload of the same version and browser updates open nothing.
 for(const details of [{reason:'install'},{reason:'update',previousVersion:'1.2.7'},{reason:'update'},{reason:'chrome_update',previousVersion:'1.2.6'}])await installed(details);
 assert.equal(runtime.opened.length,1);
});
