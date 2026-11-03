const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(sendMessage){
 let listener;const opened=[],access=[],lifecycle=[];
 const chrome={action:{onClicked:{addListener:callback=>{listener=callback;}}},tabs:{sendMessage,create:async tab=>opened.push(tab)},
  storage:{session:{setAccessLevel:async options=>access.push(options.accessLevel)}},
  runtime:{onStartup:{addListener:callback=>lifecycle.push(['startup',callback])},onInstalled:{addListener:callback=>lifecycle.push(['installed',callback])}}};
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
test('toolbar startup does not expose privileged session storage to content scripts',()=>{
 const runtime=setup(async()=>{});assert.deepEqual(runtime.access,[]);assert.deepEqual(runtime.lifecycle,[]);
});
