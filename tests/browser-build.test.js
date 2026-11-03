const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Chrome manifest uses a service worker and preserves shared document viewers and restricted permissions',()=>{
 const python=process.platform==='win32'?'py':'python3';
 const result=spawnSync(python,[...(process.platform==='win32'?['-3']:[]),'-c',
  "import json; from scripts.browser_manifest import browser_manifest; m=json.load(open('manifest.json')); print(json.dumps({'chrome':browser_manifest(m,'chrome'),'firefox':browser_manifest(m,'firefox'),'original':m}))"],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const {chrome,firefox,original}=JSON.parse(result.stdout);
 assert.deepEqual(firefox,original,'Firefox source manifest remains unchanged');
 assert.deepEqual(chrome.background,{service_worker:'extension-background.js'});
 assert.equal(chrome.browser_specific_settings,undefined);assert.equal(chrome.version,'1.2.1');
 assert.deepEqual(chrome.permissions,['storage']);
 const directives=policy=>Object.fromEntries(policy.split(';').filter(rule=>rule.trim()).map(rule=>{const [name,...values]=rule.trim().split(/\s+/);return [name,values];}));
 const chromePolicy=directives(chrome.content_security_policy.extension_pages);
 const firefoxPolicy=directives(firefox.content_security_policy.extension_pages);
 assert.deepEqual(chromePolicy['worker-src'],["'self'"]);
 for(const name of ['script-src','script-src-elem','worker-src']){
  for(const value of chromePolicy[name]||[])assert.equal(value,"'self'",`Chrome rejects executable source ${value}`);
 }
 assert.deepEqual(chromePolicy,{...firefoxPolicy,'worker-src':["'self'"]});
 assert.match(fs.readFileSync(path.join(root,'pdf-viewer.mjs'),'utf8'),/workerSrc\s*=\s*new URL\('\.\/vendor\/pdf\.worker\.mjs',\s*import\.meta\.url\)/);
 for(const asset of ['pptx-viewer.mjs','ppt-viewer.mjs','word-viewer.mjs','vendor/pptx-renderer.browser.mjs','vendor/pptjs/pptjs.mjs','pdf-viewer.mjs']){
  assert.ok(chrome.web_accessible_resources[0].resources.includes(asset));assert.ok(fs.existsSync(path.join(root,asset)));
 }
 for(const asset of ['vendor/docx/docx-preview.min.mjs','vendor/docx/jszip.min.mjs','vendor/msdoc/purify.es.mjs','vendor/msdoc/modules/msdoc/parser.js']) assert.ok(fs.existsSync(path.join(root,asset)));
 assert.ok(chrome.web_accessible_resources[0].resources.includes('vendor/docx/*.mjs'));
 assert.ok(chrome.web_accessible_resources[0].resources.includes('vendor/msdoc/modules/msdoc/*'));
 assert.ok(chrome.content_scripts[0].js.includes('deadline-cache-client.js'));
 for(const manifest of [chrome,firefox]){
  const scripts=manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf('captcha-solver.js')>=0);
  assert.ok(scripts.indexOf('captcha.js')>scripts.indexOf('captcha-solver.js'));
  assert.ok(manifest.web_accessible_resources[0].resources.includes('captcha-model.json'));
 }
});
test('Chrome service worker loads shared session cache and toolbar listeners without DOM APIs',()=>{
 const loaded=[],listeners=[];
 const chrome={runtime:{id:'test',onMessage:{addListener:fn=>listeners.push(fn)}},storage:{session:{}},action:{onClicked:{addListener:fn=>listeners.push(fn)}}};
 const context=vm.createContext({chrome});
 context.importScripts=(...files)=>{for(const file of files){loaded.push(file);vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);}};
 vm.runInContext(fs.readFileSync(path.join(root,'extension-background.js'),'utf8'),context);
 assert.deepEqual(loaded,['navigation.js','command-history.js','deadline-cache.js','extension-action.js']);assert.equal(listeners.length,3);
});
