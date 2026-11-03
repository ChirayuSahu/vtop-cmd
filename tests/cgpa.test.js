const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const { courses, totals, official, previous } = require('../build/cgpa');
const table = (history = false) => `<table><tr><th>Course Code</th><th>Course Title</th><th>Course Type</th><th>Credits</th>${history ? '<th>Grade</th><th>Semester</th>' : ''}</tr>
<tr><td>MAT1001</td><td>Calculus</td><td>Theory</td><td>4</td>${history ? '<td>A</td><td>Fall 2025</td>' : ''}</tr>
<tr><td>PHY1001</td><td>Physics</td><td>Theory</td><td>3</td>${history ? '<td>F</td><td>Winter 2025</td>' : ''}</tr></table>`;
test('parses semester groups and weights failed courses; unknown grades are excluded', () => {
  const dom = new JSDOM(table(true));
  const data = courses(dom.window.document, true);
  assert.equal(data.length, 2); assert.equal(data[1].semester, 'Winter 2025');
  assert.deepEqual(totals([...data, { credits: 9, grade: 'P' }]), { credits: 7, points: 36 });
  dom.window.close();
});
test('calculator navigates history then timetable, updates projection, and returns to search', async () => {
  const dom = new JSDOM(`<a class="systemBtnMenu" data-url="history">Grade History</a><a class="systemBtnMenu" data-url="time">Time Table</a><main></main>`, { runScripts: 'outside-only' });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  const visited = [];
  for (const link of w.document.querySelectorAll('a')) link.addEventListener('click', event => {
    event.preventDefault(); visited.push(link.dataset.url);
    w.document.querySelector('main').innerHTML = table(link.dataset.url === 'history');
  });
  for (const file of ['brand.js', 'combobox.js', 'navigation.js', 'semesters.js', 'page-actions.js', 'cgpa.js', 'content.js', 'cgpa-ui.js']) w.eval(fs.readFileSync(`${__dirname}/../build/${file}`, 'utf8'));
  const shadow = w.document.querySelector('#vtop-command-root').shadowRoot;
  shadow.querySelector('.launcher').click();
  [...shadow.querySelectorAll('.option')].find(row => row.textContent.includes('CGPA calculator')).click();
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.deepEqual(visited, ['history', 'time']);
  assert.equal(shadow.querySelectorAll('.cgpa-bubble').length, 2);
  const grades = shadow.querySelectorAll('.cgpa-grade'); assert.equal(grades.length, 2);
  assert.ok([...grades].every(control => control.querySelector('output').textContent === 'S'));
  assert.match(shadow.querySelector('.cgpa-summary').textContent, /Selected-course GPA10.00/);
  assert.match(shadow.querySelector('.cgpa-summary').textContent, /Projected CGPA7.57/);
  const [minus, plus] = grades[0].querySelectorAll('button');
  assert.equal(minus.textContent, '−'); assert.equal(plus.textContent, '+');
  assert.equal(plus.disabled, true);
  minus.click(); assert.equal(grades[0].querySelector('output').textContent, 'A');
  assert.match(shadow.querySelector('.cgpa-summary').textContent, /Projected CGPA7.29/);
  plus.click(); assert.equal(grades[0].querySelector('output').textContent, 'S');
  for (let i = 0; i < 6; i++) minus.click();
  assert.equal(grades[0].querySelector('output').textContent, 'F');
  assert.equal(minus.disabled, true);
  shadow.querySelector('.cgpa-back').click();
  assert.equal(shadow.querySelector('.cgpa').hidden, true);
  assert.equal(shadow.querySelector('.search').hidden, false);
  dom.window.close();
});
test('calculator has no semester selector and opens the current semester, not the default', async () => {
  const dom = new JSDOM(`<a class="systemBtnMenu" data-url="history">Grade History</a><a class="systemBtnMenu" data-url="time">Time Table</a><main></main>`, { runScripts: 'outside-only' });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  // The saved default is a far-future term; the calculator must ignore it.
  w.chrome = { storage: { local: { get: async () => ({ defaultSemester: { value: 'future', label: 'Fall Semester 2099-00' } }) }, onChanged: { addListener() {} } } };
  w.document.querySelector('[data-url="history"]').addEventListener('click', event => {
    event.preventDefault(); w.document.querySelector('main').innerHTML = table(true);
  });
  const picks = [];
  w.document.querySelector('[data-url="time"]').addEventListener('click', event => {
    event.preventDefault();
    w.document.querySelector('main').innerHTML = '<select id="semester"><option value="">Select semester</option><option value="future">Fall Semester 2099-00</option><option value="winter">Winter Semester 2025-26</option></select><div id="courses"></div>';
    const select = w.document.querySelector('#semester');
    select.addEventListener('change', () => {
      picks.push(select.value);
      const data = select.value === 'winter' ? table().replaceAll('Calculus', 'Winter Calculus') : table();
      w.document.querySelector('#courses').innerHTML = data;
    });
  });
  for (const file of ['brand.js', 'combobox.js', 'navigation.js', 'semesters.js', 'page-actions.js', 'cgpa.js', 'content.js', 'cgpa-ui.js']) w.eval(fs.readFileSync(`${__dirname}/../build/${file}`, 'utf8'));
  const shadow = w.document.querySelector('#vtop-command-root').shadowRoot;
  await new Promise(resolve => setTimeout(resolve, 50));
  shadow.querySelector('.launcher').click();
  [...shadow.querySelectorAll('.option')].find(row => row.textContent.includes('CGPA calculator')).click();
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(shadow.querySelector('.cgpa-term'), null, 'no semester selector');
  assert.equal(shadow.querySelector('.cgpa .cb'), null);
  assert.equal(w.document.querySelector('#semester').value, 'winter');
  assert.deepEqual(picks, ['winter'], 'the default semester never touched this Time Table');
  assert.match(shadow.querySelector('.cgpa-courses').textContent, /Winter Calculus/);
  assert.match(shadow.querySelector('.cgpa-status').textContent, /Winter Semester 2025-26/);
  dom.window.close();
});
test('currentTerm picks the semester in progress, never a future one', () => {
  const { currentTerm } = require('../build/cgpa');
  const offered = ['Winter Semester 2026-27', 'Fall Semester 2026-27 - VLR', 'Summer Semester 2025-26', 'Winter Semester 2025-26'].map((label, i) => ({ value: String(i), label }));
  const at = (date, choices = offered) => currentTerm(choices, new Date(date)).label;
  assert.equal(at('2026-11-02'), 'Fall Semester 2026-27 - VLR', 'November: Fall, although Winter is already listed');
  assert.equal(at('2026-12-15'), 'Winter Semester 2026-27');
  assert.equal(at('2027-03-01'), 'Winter Semester 2026-27');
  assert.equal(at('2026-06-10'), 'Summer Semester 2025-26');
  assert.equal(at('2026-08-01', offered.slice(2)), 'Summer Semester 2025-26', 'latest started term when the current one is not offered');
  assert.equal(at('2026-11-02', [{ value: 'x', label: 'Inter Semester' }, { value: 'y', label: 'Special' }]), 'Inter Semester', 'unrecognised labels fall back to VTOP order');
  assert.equal(currentTerm([]), null);
});
test('reads the live VTOP combined Course and L T P J C timetable layout', () => {
  const dom = new JSDOM(`<table><tr><th>Sl.No</th><th>Class Group</th><th>Course</th><th>L T P J C</th><th>Category</th></tr>
    <tr><td>1</td><td>General (Semester)</td><td><span>BCSE355L - Cloud Architecture Design</span><br><span>( Theory Only )</span></td><td><span>3</span><span>0</span><span>0</span><span>0</span><span>3.0</span></td><td>Open Elective</td></tr>
    <tr><td>2</td><td>General (Semester)</td><td>BITE303P - Operating Systems Lab<br>( Lab Only )</td><td>0 0 2 0 1.0</td><td>Discipline Core</td></tr>
    <tr><td>3</td><td>General (Semester)</td><td>BSTS301P - Advanced Competitive Coding - I<br>( Soft Skill )</td><td>0 0 3 0 1.5</td><td>Open Elective</td></tr>
    <tr><td colspan="5">Total Number Of Credits: 5.5</td></tr></table>`);
  const data = courses(dom.window.document);
  assert.deepEqual(data.map(course => [course.code, course.name, course.credits, course.type]), [
    ['BCSE355L', 'Cloud Architecture Design', 3, 'Theory Only'],
    ['BITE303P', 'Operating Systems Lab', 1, 'Lab Only'],
    ['BSTS301P', 'Advanced Competitive Coding - I', 1.5, 'Soft Skill']
  ]);
  assert.deepEqual(courses(dom.window.document, true), []);
  dom.window.close();
});
const { validatePredictions } = require('../build/cgpa');
test('NGCR categories override grades; F remains in the denominator', () => {
  const dom = new JSDOM(`<table><tr><th>Course Code</th><th>Credits</th><th>Grade</th><th>Course Category</th></tr><tr><td>TEST100N</td><td>2</td><td>S</td><td>NGCR</td></tr><tr><td>TEST200N</td><td>1</td><td>P</td><td>Non-graded Core Requirement</td></tr></table>`);
  const data = courses(dom.window.document, true);
  assert.ok(data.every(c => c.nonGraded));
  assert.deepEqual(totals(data), { credits: 0, points: 0 });
  assert.deepEqual(totals([...data, { credits: 4, grade: 'F' }, { credits: 3, grade: 'S' }]), { credits: 7, points: 30 });
  dom.window.close();
});
test('saved predictions retain only valid grades and discard retired features', () => {
  const result = validatePredictions({
    'term:fall': [{ code: 'TEST100L', type: 'TH', grade: 'A', credits: 99, corrected: true, included: false }, { code: 'BAD', grade: 'P' }],
    'future:test': { label: 'Retired plan', credits: 20, gpa: 10 }
  });
  assert.deepEqual(result['term:fall'], [{ code: 'TEST100L', type: 'TH', grade: 'A' }]);
  assert.equal(result['future:test'], undefined);
  assert.equal(Object.keys(validatePredictions(null)).length, 0);
});
async function calculatorSetup() {
  const dom = new JSDOM(`<a class="systemBtnMenu" data-url="history">Grade History</a><a class="systemBtnMenu" data-url="time">Time Table</a><main></main>`, { runScripts: 'outside-only' });
  const w = dom.window, saved = {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.chrome = { storage: { local: { get: async key => typeof key === 'string' ? { [key]: saved[key] } : { defaultSemester: null }, set: async values => Object.assign(saved, JSON.parse(JSON.stringify(values))) }, onChanged: { addListener() {} } } };
  const current = `<table><tr><th>Course</th><th>L T P J C</th><th>Category</th></tr><tr><td>TEST100L - Mathematics ( Theory Only )</td><td>3 1 0 0 4</td><td>Discipline Core</td></tr><tr><td>TEST200L - Computing ( Theory Only )</td><td>3 0 0 0 3</td><td>Discipline Core</td></tr><tr><td>TEST300N - Constitution ( Online Course )</td><td>0 0 0 0 2</td><td>Non-graded Core Requirement</td></tr></table>`;
  for (const link of w.document.querySelectorAll('a')) link.addEventListener('click', event => { event.preventDefault(); w.document.querySelector('main').innerHTML = link.dataset.url === 'history' ? table(true) : current; });
  for (const file of ['brand.js', 'combobox.js', 'navigation.js', 'semesters.js', 'page-actions.js', 'cgpa.js', 'content.js', 'cgpa-ui.js']) w.eval(fs.readFileSync(`${__dirname}/../build/${file}`, 'utf8'));
  const shadow = w.document.querySelector('#vtop-command-root').shadowRoot;
  shadow.querySelector('.launcher').click();
  [...shadow.querySelectorAll('.option')].find(row => row.textContent.includes('CGPA calculator')).click();
  await new Promise(resolve => setTimeout(resolve, 450));
  return { dom, w, shadow, saved };
}
test('simple calculator keeps NGCR exclusion and saved grades without advanced controls', async () => {
  const { dom, shadow, saved } = await calculatorSetup();
  assert.equal(shadow.querySelectorAll('.cgpa-row').length, 3);
  assert.equal(shadow.querySelectorAll('.cgpa-grade').length, 2);
  assert.match(shadow.querySelector('.cgpa-summary').textContent, /Selected credits7/);
  assert.match(shadow.querySelector('.cgpa-row:last-child').textContent, /Non-graded/);
  assert.equal(shadow.querySelector('.cgpa-future-add,.cgpa-import,.cgpa-target,.cgpa-row input'), null);
  assert.equal(shadow.querySelector('.cgpa-bubble').tagName, 'DIV');
  shadow.querySelector('.cgpa-grade button:first-child').click();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(saved['cgpaScenarios:local']['term:current'][0].grade, 'A');
  shadow.querySelector('.cgpa-reload').click();
  await new Promise(resolve => setTimeout(resolve, 450));
  assert.equal(shadow.querySelector('.cgpa-grade output').textContent, 'A');
  assert.match(shadow.querySelector('.cgpa-summary').textContent, /Selected credits7/);
  dom.window.close();
});
// Mirrors VTOP's real Grade History layout: an "Effective Grades" table with a Course Distribution column,
// nested per-component detail tables, and the CGPA Details summary. Course values are synthetic.
const gradeHistory = (cgpa = '9.25') => `<table><tr><td>Reg.No.</td><td>Name</td></tr><tr><td>X</td><td>Y</td></tr></table>
<table><tr><td colspan="11">Effective Grades Download History</td></tr>
<tr><td>Sl.No.</td><td>Course Code</td><td>Course Title</td><td>Course Type</td><td>Credits</td><td>Grade</td><td>Exam Month</td><td>Result Declared</td><td>Course Distribution</td><td>Detail View</td></tr>
<tr><td>1</td><td>BCSE101E</td><td>Programming</td><td>ETL</td><td>3.0</td><td>S</td><td>Nov-2024</td><td>02-Jan-2025</td><td>FC</td><td></td></tr>
<tr><td colspan="11"><table><tr><td>Course Code</td><td>Course Title</td><td>Course Type</td><td>Credits</td><td>Grade</td><td>Exam Month</td><td>Result Declared</td></tr>
<tr><td>BCSE101E</td><td>Programming</td><td>ETL</td><td>3.0</td><td>S</td><td>Nov-2024</td><td>02-Jan-2025</td></tr><tr><td>BCSE101E</td><td>Programming</td><td>ETH</td><td></td><td>-</td><td>Nov-2024</td><td>02-Jan-2025</td></tr></table></td></tr>
<tr><td>2</td><td>MAT2001</td><td>Statistics</td><td>TH</td><td>4.0</td><td>A</td><td>Nov-2024</td><td>02-Jan-2025</td><td>FC</td><td></td></tr>
<tr><td>3</td><td>BITE101N</td><td>Project</td><td>PJT</td><td>1.0</td><td>P</td><td>Aug-2025</td><td>01-Sep-2025</td><td>NGCR</td><td></td></tr>
<tr><td>4</td><td>BHUM101N</td><td>Ethics</td><td>OC</td><td>2.0</td><td>A</td><td>Apr-2025</td><td>30-May-2025</td><td>NGCR</td><td></td></tr>
<tr><td>5</td><td>BCSE103E</td><td>Java</td><td>ETL</td><td>3.0</td><td>B</td><td>Apr-2025</td><td>30-May-2025</td><td>PC</td><td></td></tr></table>
<table><tr><td>Credits Registered</td><td>Credits Earned</td><td>CGPA</td><td>S Grades</td></tr><tr><td>13.0</td><td>13.0</td><td>${cgpa}</td><td>1</td></tr></table>`;
test('real Grade History layout: NGCR via Course Distribution, P grades and component rows are excluded; VTOP CGPA is read', () => {
  const dom = new JSDOM(gradeHistory('9.00'));const data = courses(dom.window.document, true);
  assert.deepEqual(data.map(course => course.code), ['BCSE101E', 'MAT2001', 'BITE101N', 'BHUM101N', 'BCSE103E'], 'one row per course, components skipped');
  assert.equal(data.find(course => course.code === 'BHUM101N').nonGraded, true, 'NGCR from Course Distribution');
  assert.deepEqual(totals(data), { credits: 10, points: 90 }, 'S·3 + A·4 + B·3; NGCR and P excluded');
  assert.deepEqual(official(dom.window.document), { cgpa: 9, creditsEarned: 13 });
  dom.window.close();
});
test('projection uses exact recomputed points when they agree with VTOP, and VTOP\'s CGPA when they do not', () => {
  // Verified against a real account: 92 graded credits, 851 points → VTOP CGPA 9.25; 23.5 new credits at S → 9.40.
  const history = [{ credits: 92, grade: 'S' }], scaled = previous(history, { cgpa: 10 });
  assert.deepEqual(scaled, { credits: 92, points: 920 });
  const real = { credits: 92, points: 851 }, agree = previous([{ credits: 46, grade: 'A' }, { credits: 46, grade: 'A' }], { cgpa: 9.25 });
  assert.equal(agree.points, 92 * 9.25, 'disagreeing recomputation (9.00) falls back to VTOP 9.25');
  assert.equal(((real.points + 23.5 * 10) / (real.credits + 23.5)).toFixed(2), '9.40');
  assert.deepEqual(previous([{ credits: 4, grade: 'A' }], { cgpa: 9.004 }), { credits: 4, points: 36 }, 'within rounding: keep exact points');
  assert.deepEqual(previous([{ credits: 4, grade: 'A' }], null), { credits: 4, points: 36 });
});
test('calculator hides pass/fail-only terms and shows VTOP\'s CGPA as the previous CGPA', async () => {
  const dom = new JSDOM(`<a class="systemBtnMenu" data-url="history">Grade History</a><a class="systemBtnMenu" data-url="time">Time Table</a><main></main>`, { runScripts: 'outside-only' });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  for (const link of w.document.querySelectorAll('a')) link.addEventListener('click', event => {
    event.preventDefault(); w.document.querySelector('main').innerHTML = link.dataset.url === 'history' ? gradeHistory('9.40') : table(false);
  });
  for (const file of ['brand.js', 'combobox.js', 'navigation.js', 'semesters.js', 'page-actions.js', 'cgpa.js', 'content.js', 'cgpa-ui.js']) w.eval(fs.readFileSync(`${__dirname}/../build/${file}`, 'utf8'));
  const shadow = w.document.querySelector('#vtop-command-root').shadowRoot;
  shadow.querySelector('.launcher').click();
  [...shadow.querySelectorAll('.option')].find(row => row.textContent.includes('CGPA calculator')).click();
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.deepEqual([...shadow.querySelectorAll('.cgpa-bubble span:first-child')].map(span => span.textContent), ['Nov-2024', 'Apr-2025'], 'Aug-2025 had only a P grade');
  assert.match(shadow.querySelector('.cgpa-summary').textContent, /Previous CGPA9\.40/, 'recomputed 9.00 disagrees, so VTOP\'s 9.40 is used');
  dom.window.close();
});
