const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { search, recordUsage, sanitizeUsage, usageScore, USAGE_KEY } = require('../navigation');
const source = file => fs.readFileSync(__dirname + '/../' + file, 'utf8');
const DAY = 86400000, NOW = 1800000000000;
const commands = [
  { id: 'first', label: 'First page' }, { id: 'frequent', label: 'Frequent page' },
  { id: 'recent', label: 'Recent page' }, { id: 'unused', label: 'Unused page' }
];
const ids = items => items.map(item => item.id);

test('empty-query ranking combines frequency and recency, retains every result and stable unused order', () => {
  const history = {
    first: { weight: 100, lastUsed: NOW - 100 * DAY },
    frequent: { weight: 5, lastUsed: NOW - DAY },
    recent: { weight: 1, lastUsed: NOW }
  };
  assert.deepEqual(ids(search(commands, '', history, NOW)), ['frequent', 'recent', 'first', 'unused']);
  assert.deepEqual(ids(search(commands, '', {}, NOW)), ids(commands));
  const all = Array.from({ length: 119 }, (_, i) => ({ id: 'page/' + i, label: 'Page ' + i }));
  assert.equal(search(all, '', recordUsage({}, 'page/118', NOW), NOW).length, 119);
  assert.equal(search(all, '', recordUsage({}, 'page/118', NOW), NOW)[0].id, 'page/118');
});

test('recent selections win equal frequencies, and visit weight halves each week', () => {
  const history = { first: { weight: 1, lastUsed: NOW - DAY }, recent: { weight: 1, lastUsed: NOW } };
  assert.equal(search(commands, '', history, NOW)[0].id, 'recent');
  const next = recordUsage({ frequent: { weight: 4, lastUsed: NOW - 7 * DAY } }, 'frequent', NOW);
  assert.equal(next.frequent.weight, 3);
  assert.equal(usageScore(next.frequent, NOW + 7 * DAY), 1.5);
});

test('search relevance takes priority, while equally relevant duplicate labels use personal history', () => {
  const pages = [
    { id: 'exact', label: 'Attendance' }, { id: 'other', label: 'Attendance details' },
    { id: 'regular', label: 'Exam Schedule' }, { id: 'arrear', label: 'Exam Schedule' }
  ];
  const history = { other: { weight: 100, lastUsed: NOW }, arrear: { weight: 3, lastUsed: NOW } };
  assert.equal(search(pages, 'attendance', history, NOW)[0].id, 'exact');
  assert.equal(search(pages, 'exam schedule', history, NOW)[0].id, 'arrear');
  assert.equal(search(pages, 'zzzzz', history, NOW).length, 0);
});

test('invalid history is ignored, future dates are clamped, and storage is bounded', () => {
  for (const value of [null, [], 'bad', 123]) assert.deepEqual(sanitizeUsage(value, NOW), {});
  const history = JSON.parse('{"__proto__":{"weight":10,"lastUsed":1}}');
  Object.assign(history, { bad: { weight: Infinity, lastUsed: NOW }, negative: { weight: -1, lastUsed: NOW },
    broken: { weight: 1 }, future: { weight: 1, lastUsed: NOW + DAY },
    'route?token=secret': { weight: 1, lastUsed: NOW } });
  assert.deepEqual(sanitizeUsage(history, NOW), { future: { weight: 1, lastUsed: NOW } });
  let many = Object.fromEntries(Array.from({ length: 301 }, (_, i) => ['page/' + i, { weight: 1, lastUsed: NOW - i }]));
  many = recordUsage(many, 'new', NOW + 1);
  assert.equal(Object.keys(many).length, 300);
  assert.ok(many.new); assert.equal(many['page/300'], undefined);
});

function background(store = {}) {
  let listener, now = NOW, readFails = false, writeFails = false;
  const subscribers = [], writes = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const local = {
    async get(key) {
      if (readFails) throw Error('read unavailable');
      if (typeof key === 'string') return { [key]: clone(store[key] ?? null) };
      return Object.fromEntries(key.map(name => [name, clone(store[name] ?? null)]));
    },
    async set(value) {
      if (writeFails) throw Error('write unavailable');
      const copy = clone(value);
      const changes = Object.fromEntries(Object.entries(copy).map(([key, newValue]) => [key, { newValue }]));
      Object.assign(store, copy); writes.push(copy);
      for (const fn of subscribers) fn(changes, 'local');
    },
    async remove() {}
  };
  const api = { runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; } } }, storage: { local } };
  const context = vm.createContext({ chrome: api, Date: { now: () => now } });
  vm.runInContext(source('navigation.js'), context);
  vm.runInContext(source('command-history.js'), context);
  const sender = { id: 'test', url: 'https://vtop.vit.ac.in/vtop/content' };
  function send(message, from = sender) {
    return new Promise(resolve => listener(message, from, resolve));
  }
  return { store, local, subscribers, writes, send,
    record: (id, from) => send({ type: 'vtop-command-used', id }, from),
    time: value => { now = value; },
    fail: (read, write) => { readFails = read; writeFails = write; } };
}

test('background serializes concurrent selections, preserves distinct routes, and restores after restart', async () => {
  const bg = background();
  const results = await Promise.all(Array.from({ length: 25 }, () => bg.record('attendance')));
  assert.ok(results.every(result => result.ok));
  assert.equal(bg.store[USAGE_KEY].attendance.weight, 25);
  await Promise.all([bg.record('marks'), bg.record('timetable')]);
  assert.equal(Object.keys(bg.store[USAGE_KEY]).length, 3);
  const restarted = background(bg.store);
  await restarted.record('attendance');
  assert.equal(bg.store[USAGE_KEY].attendance.weight, 26);
  assert.deepEqual(Object.keys(bg.store[USAGE_KEY].attendance).sort(), ['lastUsed', 'weight']);
});

test('background validates senders and IDs, and handles unavailable storage without destroying history', async () => {
  const bg = background({ [USAGE_KEY]: { old: { weight: 3, lastUsed: NOW } } });
  assert.equal((await bg.record('page', { id: 'other', url: 'https://vtop.vit.ac.in/vtop/content' })).ok, false);
  assert.equal((await bg.record('page', { id: 'test', url: 'https://evil.example/vtop/content' })).ok, false);
  assert.equal((await bg.record('__proto__')).ok, false);
  assert.equal((await bg.record('page?token=secret')).ok, false);
  bg.fail(true, false);
  assert.equal((await bg.record('page')).ok, false);
  assert.equal(bg.writes.length, 0);
  bg.fail(false, true);
  assert.equal((await bg.record('page')).ok, false);
  bg.fail(false, false);
  assert.equal((await bg.record('page')).ok, true);
  assert.equal(bg.store[USAGE_KEY].old.weight, 3);
  assert.equal(bg.store[USAGE_KEY].page.weight, 2);
});

function page(bg, { platform = 'Win32', historyRead } = {}) {
  const dom = new JSDOM(source('tests/fixture.html'), {
    runScripts: 'outside-only', url: 'https://vtop.vit.ac.in/vtop/content'
  });
  const w = dom.window;
  w.Date.now = () => NOW;
  Object.defineProperty(w.navigator, 'platform', { value: platform });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  let localListener;
  w.chrome = {
    storage: { local: { ...bg.local, get: key => key === USAGE_KEY && historyRead ? historyRead : bg.local.get(key) },
      onChanged: { addListener(fn) { localListener = fn; bg.subscribers.push(fn); } } },
    runtime: { sendMessage: message => bg.send(message), onMessage: { addListener() {} } }
  };
  for (const file of ['brand.js', 'combobox.js', 'navigation.js', 'semesters.js', 'content.js']) w.eval(source(file));
  w.document.addEventListener('click', event => event.preventDefault());
  const shadow = w.document.querySelector('#vtop-command-root').shadowRoot;
  const input = shadow.querySelector('.search input');
  const key = (key, options = {}, target = w.document) =>
    target.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
  const open = () => {
    if (shadow.querySelector('dialog').open) shadow.querySelector('.close').click();
    key('k', platform === 'MacIntel' ? { metaKey: true } : { ctrlKey: true });
    assert.equal(shadow.querySelector('dialog').open, true);
  };
  const query = text => { input.value = text; input.dispatchEvent(new w.Event('input')); };
  const top = () => shadow.querySelector('.option .label')?.textContent;
  const close = () => { bg.subscribers.splice(bg.subscribers.indexOf(localListener), 1); dom.window.close(); };
  return { dom, w, shadow, input, key, open, query, top, close };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Ctrl+K and Cmd+K persist keyboard and mouse choices across tabs and page/browser reloads', async () => {
  const bg = background(), first = page(bg), second = page(bg, { platform: 'MacIntel' });
  await tick();
  first.open(); first.query('attendance'); first.key('Enter', {}, first.input);
  await tick();
  assert.equal(bg.store[USAGE_KEY]['academics/common/StudentAttendance'].weight, 1);
  first.open(); assert.equal(first.top(), 'Class Attendance');
  second.open(); assert.equal(second.top(), 'Class Attendance');
  second.query('da'); second.shadow.querySelector('.option').click();
  await tick();
  second.open(); second.query('da'); second.shadow.querySelector('.option').click();
  await tick();
  first.open(); assert.equal(first.top(), 'Digital Assignment Upload');
  const expectedCount = first.shadow.querySelectorAll('.option').length;
  first.close(); second.close();
  const reloaded = page(background(bg.store)); await tick();
  reloaded.open();
  assert.equal(reloaded.top(), 'Digital Assignment Upload');
  assert.equal(reloaded.shadow.querySelectorAll('.option').length, expectedCount);
  reloaded.close();
});

test('opening/searching does not record use, vanished routes are ignored, and built-in commands are ranked', async () => {
  const bg = background(), p = page(bg);
  await tick(); p.open(); p.query('attendance'); await tick();
  assert.equal(bg.writes.length, 0);
  p.w.document.querySelector('[data-url="academics/common/StudentAttendance"]').remove();
  p.key('Enter', {}, p.input); await tick();
  assert.equal(bg.writes.length, 0);
  p.query('dark'); p.key('Enter', {}, p.input); await tick();
  assert.equal(bg.store[USAGE_KEY]['vtop:theme'].weight, 1);
  p.open(); assert.equal(p.top(), 'Toggle dark mode');
  p.close();
});

test('a stale startup read cannot undo a selection; unavailable storage still permits navigation', async () => {
  const bg = background(); let resolveRead;
  const historyRead = new Promise(resolve => { resolveRead = resolve; });
  const p = page(bg, { historyRead }); await tick();
  p.open(); p.query('attendance'); p.key('Enter', {}, p.input); await tick();
  resolveRead({ [USAGE_KEY]: {} }); await tick();
  p.open(); assert.equal(p.top(), 'Class Attendance'); p.close();
  const broken = background(); broken.fail(true, true);
  const q = page(broken); await tick();
  q.open(); q.query('attendance'); q.key('Enter', {}, q.input); await tick();
  q.open(); assert.equal(q.top(), 'Class Attendance'); q.close();
});
