const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const api = require('../build/dark-readability');
test('legacy red and green statuses are lifted to readable colors while readable text is kept', () => {
  const background = [24,33,48];
  for (const color of [[0,128,0,1],[255,0,0,1],[0,0,255,1],[0,0,0,1],[105,105,105,1]]) {
    const replacement = api.replacement(color,background);
    assert.ok(replacement);
    assert.ok(api.contrast(api.palette[replacement],background) >= 4.5);
  }
  assert.equal(api.replacement([0,128,0,1],background),'green');
  assert.equal(api.replacement([255,0,0,1],background),'red');
  assert.equal(api.replacement([224,230,240,1],background),null);
  assert.equal(api.replacement([0,0,0,1],[255,255,255]),null);
  assert.equal(api.replacement([224,230,240,1],[255,255,255]),'ink');
});
test('contrast repair accounts for transparent text and colored badge backgrounds', () => {
  assert.deepEqual(api.parse('rgba(0, 128, 0, 0.5)'),[0,128,0,.5]);
  assert.equal(api.parse('url(image)'),null);
  assert.equal(api.lightSurface([255,255,255,1]),true);
  assert.equal(api.lightSurface([240,240,240,1]),true);
  assert.equal(api.lightSurface([255,193,7,1]),false);
  assert.equal(api.lightSurface([255,255,255,0]),false);
  for (const background of [[24,33,48],[32,45,67],[255,255,255],[13,110,253],[255,193,7],[25,135,84]]) {
    for (const color of [[0,128,0,1],[255,0,0,1],[224,230,240,.4]]) {
      const replacement = api.replacement(color,background);
      if (replacement) assert.ok(api.contrast(api.palette[replacement],background) >= 4.5);
    }
  }
});
const pause = () => new Promise(resolve => setTimeout(resolve,180));
test('dark-mode repair follows nested AJAX content and restores native colors in light mode', async () => {
  const dom = new JSDOM('<html data-vtop-command-dark><body style="background-color:rgb(24,33,48)"><main id="b5-pagewrapper"><span id="status" style="color:green">Registered and Approved</span><span style="color:rgb(224,230,240)">Readable</span><div id="legacy" style="background-color:white;color:black">Nested panel</div><div id="warning" style="background-color:rgb(255,193,7);color:black">Warning</div><svg><text style="color:green">Chart</text></svg><input disabled value="disabled"></main></body></html>',{runScripts:'outside-only'});
  const w = dom.window;
  w.HTMLElement.prototype.getClientRects = function(){return [{width:100,height:20}];};
  const native = w.getComputedStyle.bind(w);
  w.getComputedStyle = element => {
    const css = native(element);
    // jsdom has no layout; use the same stylesheet rule as the packaged browser extension.
    if (w.document.documentElement.hasAttribute('data-vtop-command-dark')) {
      return new Proxy(css,{get(target,key){
        if (key==='color' && element.hasAttribute('data-vtop-readable')) return `rgb(${api.palette[element.getAttribute('data-vtop-readable')].join(',')})`;
        if (key==='backgroundColor' && element.hasAttribute('data-vtop-dark-surface')) return 'rgb(24,33,48)';
        return Reflect.get(target,key);
      }});
    }
    return css;
  };
  w.eval(fs.readFileSync(__dirname+'/../build/dark-readability.js','utf8'));
  await pause();
  const status = w.document.querySelector('#status');
  assert.equal(status.getAttribute('data-vtop-readable'),'green');
  assert.equal(status.style.color,'green');
  assert.equal(w.document.querySelector('svg text').hasAttribute('data-vtop-readable'),false);
  assert.equal(w.document.querySelector('input').hasAttribute('data-vtop-readable'),false);
  const legacy = w.document.querySelector('#legacy');
  assert.equal(legacy.hasAttribute('data-vtop-dark-surface'),true);
  assert.equal(legacy.getAttribute('data-vtop-readable'),'text');
  assert.equal(legacy.style.backgroundColor,'white');
  assert.equal(w.document.querySelector('#warning').hasAttribute('data-vtop-dark-surface'),false);
  const detail = w.document.createElement('div'); detail.innerHTML='<span style="color:red">Absent</span>';
  w.document.querySelector('main').append(detail); await pause();
  assert.equal(detail.firstChild.getAttribute('data-vtop-readable'),'red');
  status.style.color='rgb(224,230,240)'; await pause();
  assert.equal(status.hasAttribute('data-vtop-readable'),false);
  w.document.documentElement.removeAttribute('data-vtop-command-dark'); await pause();
  assert.equal(w.document.querySelectorAll('[data-vtop-readable]').length,0);
  assert.equal(w.document.querySelectorAll('[data-vtop-dark-surface]').length,0);
  assert.equal(detail.firstChild.style.color,'red');
  dom.window.close();
});
test('a fixed button mid-transition keeps its fix on later scans instead of flickering', async () => {
  const dom = new JSDOM('<html data-vtop-command-dark><body style="background-color:rgb(24,33,48)"><main id="b5-pagewrapper"><button id="download" class="btn">Download</button></main></body></html>',{runScripts:'outside-only'});
  const w = dom.window;
  w.HTMLElement.prototype.getClientRects = function(){return [{width:100,height:20}];};
  w.requestIdleCallback = callback => setTimeout(callback,0);
  const native = w.getComputedStyle.bind(w);
  // Once fixed, the button fades whenever its fix is removed: unless held, it reads a half-faded, readable colour.
  w.getComputedStyle = element => {
    const css = native(element);
    if (element.id !== 'download') return css;
    const fading = element.fixedOnce && !element.hasAttribute('data-vtop-readability-hold');
    return new Proxy(css,{get:(target,key)=>key==='color'?(fading?'rgb(200, 200, 200)':'rgb(30, 30, 30)'):Reflect.get(target,key)});
  };
  w.eval(fs.readFileSync(__dirname+'/../build/dark-readability.js','utf8'));
  await pause(); await pause();
  const button = w.document.querySelector('#download');
  assert.ok(button.hasAttribute('data-vtop-readable')); button.fixedOnce = true;
  for (let i = 0; i < 3; i++) { w.document.querySelector('main').append(w.document.createElement('span')); await pause(); await pause(); assert.ok(button.hasAttribute('data-vtop-readable'),`stable after scan ${i+1}`); }
  assert.equal(w.document.querySelectorAll('[data-vtop-readability-hold]').length,0,'hold is released after each scan');
  // Light mode drops fixes without measuring.
  w.document.documentElement.removeAttribute('data-vtop-command-dark'); await pause(); await pause();
  assert.equal(button.hasAttribute('data-vtop-readable'),false);
  dom.window.close();
});
