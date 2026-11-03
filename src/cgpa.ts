// Course scraping and grade arithmetic for the CGPA calculator, read by cgpa-ui.ts as `VtopCgpa`.
type VtopGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
/** A course row from Grade History (graded) or Time Table (current semester, no grade). */
interface VtopCourse {
  code: string;
  name: string;
  credits: number;
  /** The raw grade cell ('' when not graded yet); only keys of `points` count towards a GPA. */
  grade: string;
  /** Exam/term label, or 'Previous semesters' when the table has none. */
  semester: string;
  type: string;
  category: string;
  /** NGCR (non-graded credit requirement): never counts towards the GPA. */
  nonGraded: boolean;
}
/** Raw credit and grade-point sums; GPA is points / credits. */
interface VtopGradeTotals { credits: number; points: number }
/** VTOP's own published CGPA from the Grade History details table. */
interface VtopOfficialCgpa { cgpa: number; creditsEarned: number | null }
/** A saved grade choice for one course; `grade` is a key of `points`. */
interface VtopPrediction { code: string; type: string; grade: string }
interface VtopCgpaApi {
  /** Grade points per letter grade, best to worst. */
  points: Record<VtopGrade, number>;
  /** Course rows from every matching table; `history` keeps only tables with a grade column. */
  courses(doc: Document, history?: boolean): VtopCourse[];
  totals(courses: readonly VtopCourse[]): VtopGradeTotals;
  official(doc: Document): VtopOfficialCgpa | null;
  /** Past totals, rescaled to VTOP's published CGPA when the recomputed one disagrees. */
  previous(history: readonly VtopCourse[], reference: VtopOfficialCgpa | null): VtopGradeTotals;
  /** Saved predictions from storage, keyed by 'term:<semester key>'; anything malformed is dropped. */
  validatePredictions(value: unknown): Record<string, VtopPrediction[]>;
  /** The semester in progress among the offered choices, else the first choice. */
  currentTerm<T extends { label: string }>(choices: readonly T[], now?: Date): T | null;
}
declare var VtopCgpa: VtopCgpaApi;

(function (root: typeof globalThis) {
  'use strict';
  const points: Record<VtopGrade, number> = { S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0 };
  const clean = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();
  const heading = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  // VTOP wraps course names and L/T/P/J/C values in separate text nodes.
  // Join them with spaces so adjacent spans do not merge numbers or words.
  function cellText(cell: HTMLTableCellElement | undefined) {
    if (!cell) return '';
    const walker = cell.ownerDocument.createTreeWalker(cell, 4), parts: (string | null)[] = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent);
    return clean(parts.join(' '));
  }
  function courses(doc: Document, history = false) {
    const result: VtopCourse[] = [], seen = new Set<string>();
    for (const table of doc.querySelectorAll('table')) {
      const rows = [...table.rows];
      const header = rows.find(row => {
        const labels = [...row.cells].map(cell => heading(cellText(cell)));
        return (labels.includes('coursecode') || labels.includes('course')) && labels.some(label => /^(credits?|c|ltpj?c)$/.test(label));
      });
      if (!header) continue;
      const labels = [...header.cells].map(cell => heading(cellText(cell)));
      const index = (pattern: RegExp) => labels.findIndex(label => pattern.test(label));
      const code = index(/^(coursecode|course)$/), name = index(/^(coursetitle|coursename)$/), credit = index(/^(credits?|c|ltpj?c)$/);
      const grade = index(/^(grade|lettergrade)$/), semester = index(/^(semester|sem|term|exammonth|exammonthyear|monthyear)$/), type = index(/^(coursetype|type)$/), category = index(/^(category|coursecategory|coursedistribution|distribution)$/);
      if (history && grade < 0) continue;
      for (const row of rows.slice(rows.indexOf(header) + 1)) {
        const cells = [...row.cells].map(cellText);
        // History has separate code/title columns; Time Table combines them
        // with a trailing course type, e.g. CODE - Title ( Theory Only ).
        const combined = labels[code] === 'course';
        const match = combined ? cells[code]?.match(/^([A-Z]{2,}\d+[A-Z]*)\s*[-–—]\s*(.*?)(?:\s*\(\s*([^()]+)\s*\))?$/i) : null;
        const courseCode = combined ? match?.[1] : cells[code];
        const courseType = combined ? clean(match?.[3]) : cells[type] || '';
        const numbers = cells[credit]?.match(/\d+(?:\.\d+)?/g) || [];
        // C is the last value in the combined L T P J C cell, including fractional credits.
        const creditText = /^ltpj?c$/.test(labels[credit]) ? numbers.at(-1) : cells[credit];
        const credits = Number(creditText);
        if (!courseCode || !/^[A-Z]{2,}\d/i.test(courseCode) || !creditText || !Number.isFinite(credits) || credits < 0) continue;
        const term = semester >= 0 ? cells[semester] : '';
        const key = [term, courseCode, courseType].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ code: courseCode, name: combined ? clean(match![2]) : cells[name] || courseCode, credits, grade: cells[grade] || '', semester: term || 'Previous semesters', type: courseType, category: cells[category] || '', nonGraded: /\bNGCR\b|non[ -]?graded/i.test(cells[category] || '') });
      }
    }
    return result;
  }
  // NGCR is excluded regardless of the chosen grade. F still adds credits
  // with zero points; keep raw totals so rounding happens only for display.
  function totals(courses: readonly VtopCourse[]) {
    return courses.reduce((sum, course) => {
      if (course.nonGraded || !Object.hasOwn(points, course.grade) || !Number.isFinite(course.credits) || course.credits <= 0) return sum;
      sum.credits += course.credits; sum.points += course.credits * points[course.grade as VtopGrade];
      return sum;
    }, { credits: 0, points: 0 });
  }
  // Grade History's CGPA Details table: VTOP's own CGPA, the reference the projection must agree with.
  function official(doc: Document) {
    for (const table of doc.querySelectorAll('table')) {
      const rows = [...table.rows], header = rows.findIndex(row => [...row.cells].some(cell => heading(cellText(cell)) === 'cgpa'));
      if (header < 0 || !rows[header + 1]) continue;
      const labels = [...rows[header].cells].map(cell => heading(cellText(cell))), cells = [...rows[header + 1].cells].map(cellText);
      const cgpa = Number(cells[labels.indexOf('cgpa')]), earned = Number(cells[labels.indexOf('creditsearned')]);
      if (Number.isFinite(cgpa) && cgpa > 0 && cgpa <= 10) return { cgpa, creditsEarned: Number.isFinite(earned) ? earned : null };
    }
    return null;
  }
  // Past grade points for the projection. The recomputed total is exact; if it disagrees with VTOP's
  // published CGPA beyond rounding (a grading rule we cannot see), VTOP's figure wins.
  function previous(history: readonly VtopCourse[], reference: VtopOfficialCgpa | null) {
    const past = totals(history);
    if (!reference || !past.credits || Math.abs(past.points / past.credits - reference.cgpa) < 0.005) return past;
    return { credits: past.credits, points: reference.cgpa * past.credits };
  }
  // Only grade choices survive reloads. Ignore retired scenario fields and plans.
  function validatePredictions(value: unknown) {
    // Storage data is untrusted: each entry is checked field by field below.
    const result: Record<string, VtopPrediction[]> = Object.create(null);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const [term, list] of Object.entries(value).slice(0, 100)) {
      if (!term.startsWith('term:') || term.length > 300 || !Array.isArray(list)) continue;
      result[term] = list.slice(0, 200).filter(course => course && typeof course.code === 'string' && course.code.length <= 100 && Object.hasOwn(points, course.grade))
        .map(course => ({ code: course.code, type: typeof course.type === 'string' ? course.type.slice(0, 100) : '', grade: course.grade }));
    }
    return result;
  }
  // VIT's academic year runs Fall (Jul–Nov), Winter (Dec–Apr), then Summer (May–Jun).
  function termOrder(label: string) {
    const term = clean(label).toLowerCase().replace(/[–—]/g, '-').match(/\b(fall|winter|summer)\b.*?\b(\d{4})\s*[-/]\s*\d{2,4}\b/);
    return term ? Number(term[2]) * 3 + { fall: 0, winter: 1, summer: 2 }[term[1] as 'fall' | 'winter' | 'summer'] : null;
  }
  // The semester in progress: the latest offered term that has already started, so a newly listed future
  // term isn't picked. Unrecognised labels fall back to VTOP's own first choice.
  function currentTerm<T extends { label: string }>(choices: readonly T[], now = new Date()) {
    const month = now.getMonth() + 1, start = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const today = start * 3 + (month >= 7 && month <= 11 ? 0 : month === 12 || month <= 4 ? 1 : 2);
    const started = choices.map((choice, index) => ({ choice, index, order: termOrder(choice.label) }))
      .filter(item => item.order !== null && item.order <= today).sort((a, b) => b.order! - a.order! || a.index - b.index);
    return started[0]?.choice || choices[0] || null;
  }
  const api: VtopCgpaApi = { points, courses, totals, official, previous, validatePredictions, currentTerm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VtopCgpa = api;
})(globalThis);
