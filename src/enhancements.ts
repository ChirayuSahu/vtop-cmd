// Attendance and assignment-deadline parsing, read by page-enhancements.ts as `VtopEnhancements`.
interface VtopAttendance {
  /** Attended share in percent, or null when no classes have been held. */
  percentage: number | null;
  /** Consecutive classes to attend to reach the target (Infinity for an unreachable 100%). */
  needed: number;
  /** Classes that can be missed while staying at or above the target. */
  missable: number;
}
interface VtopAttendanceRow { label: string; attended: number; total: number }
/** A deadline as a UTC timestamp (portal times are IST); date-only deadlines mean 23:59:59 IST. */
interface VtopDeadlineTime { time: number; dateOnly: boolean }
/** The fields needed to describe how soon something is due. */
interface VtopDueRecord { time: number; submitted: boolean }
/** One assignment row from a course's Digital Assignment dashboard. */
interface VtopAssignmentRow extends VtopDeadlineTime, VtopDueRecord {
  label: string;
  title: string;
  /** Whether the page shows a status or upload column at all. */
  statusKnown: boolean;
  row: HTMLTableRowElement;
  dueCell: HTMLTableCellElement | undefined;
}
interface VtopDueState { tone: 'done' | 'overdue' | 'soon' | 'pending'; text: string }
/** A course on Digital Assignment Upload, with the cells its dashboard button lives in. */
interface VtopAssignmentCourse {
  classId: string;
  row: HTMLTableRowElement;
  table: HTMLTableElement;
  headerRow: HTMLTableRowElement;
  dashboardCell: HTMLTableCellElement;
}
interface VtopEnhancementsApi {
  /** Attendance arithmetic for a target percentage (default 75); null for invalid counts. */
  attendance(attended: number, total: number, target?: number): VtopAttendance | null;
  attendanceRows(doc: Document): VtopAttendanceRow[];
  parseDeadline(value: string | null | undefined): VtopDeadlineTime | null;
  assignmentRows(doc: Document): VtopAssignmentRow[];
  /** Unsubmitted records sorted by due time, the next upcoming one and the overdue count. */
  dueSummary<T extends VtopDueRecord>(records: readonly T[], now?: number): { next: T | null; overdue: number; pending: T[] };
  countdown(time: number, now?: number): string;
  /** A short badge line for one record, e.g. "Due in 2d 3h". */
  dueState(record: VtopDueRecord, now?: number): VtopDueState;
  assignmentCourses(doc: Document): VtopAssignmentCourse[];
}
declare var VtopEnhancements: VtopEnhancementsApi;

(function (root: typeof globalThis) {
  'use strict';
  const clean = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();
  function attendance(attended: number, total: number, target = 75): VtopAttendance | null {
    if (![attended, total, target].every(Number.isFinite) || !Number.isInteger(attended) || !Number.isInteger(total) || attended < 0 || total < attended || target <= 0 || target > 100) return null;
    const ratio = target / 100;
    const needed = attended >= ratio * total ? 0 : target === 100 ? Infinity : Math.max(0, Math.ceil((ratio * total - attended) / (1 - ratio) - 1e-9));
    const missable = total ? Math.max(0, Math.floor(attended / ratio - total + 1e-9)) : 0;
    return { percentage: total ? attended / total * 100 : null, needed, missable };
  }
  // Header rows may use rowspan/colspan (VTOP's assignment dashboard has a two-row header);
  // expand them into one name per data column.
  function tableRows(doc: Document) {
    const result: { headers: string[]; cells: string[]; row: HTMLTableRowElement }[] = [];
    for (const table of doc.querySelectorAll('table')) {
      const rows = [...table.rows].filter(row => row.closest('table') === table);
      const start = rows.findIndex(row => [...row.cells].some(cell => /attended|due date|last date|deadline/i.test(clean(cell.textContent))));
      if (start < 0) continue;
      const headers: string[] = [], carry: number[] = [];
      let index = start;
      for (; index < rows.length; index++) {
        const row = rows[index];
        if (index > start && !carry.some(count => count > 0) && !row.classList.contains('tableHeader') && ![...row.cells].every(cell => cell.tagName === 'TH')) break;
        let column = 0;
        for (const cell of row.cells) {
          while (carry[column] > 0) column++;
          const span = Math.max(1, cell.colSpan || 1), down = Math.max(1, cell.rowSpan || 1), text = clean(cell.textContent);
          for (let k = 0; k < span; k++) { headers[column + k] = headers[column + k] ? `${headers[column + k]} ${text}` : text; if (down > 1) carry[column + k] = down; }
          column += span;
        }
        for (let k = 0; k < carry.length; k++) if (carry[k] > 0) carry[k]--;
      }
      for (const row of rows.slice(index)) {
        const cells = [...row.cells].map(cell => clean(cell.textContent));
        if (cells.length === headers.length) result.push({ headers, cells, row });
      }
    }
    return result;
  }
  function attendanceRows(doc: Document) {
    const records: VtopAttendanceRow[] = [];
    for (const {headers, cells} of tableRows(doc)) {
      const a = headers.findIndex(h => /attended/i.test(h));
      const t = headers.findIndex(h => /total (?:classes|days)|conducted/i.test(h));
      const c = headers.findIndex(h => /course detail|course title|course name/i.test(h));
      if (a < 0 || t < 0 || !/^\d+$/.test(cells[a]) || !/^\d+$/.test(cells[t])) continue;
      const attended = Number(cells[a]), total = Number(cells[t]);
      if (attendance(attended, total)) records.push({ label: cells[c] || `Course ${records.length + 1}`, attended, total });
    }
    return records;
  }
  // Portal deadlines are campus time (IST), independent of the computer's timezone.
  function parseDeadline(value: string | null | undefined): VtopDeadlineTime | null {
    const text = clean(value).replace(/\bIST\b/ig, '').trim();
    const match = text.match(/^(?:(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(\d{1,2})[-/ ]([A-Za-z]{3,9}|\d{1,2})[-/ ](\d{4}))(?:[T ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (!match) return null;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const year = Number(match[1] || match[6]);
    const month = match[1] ? Number(match[2]) : /^\d+$/.test(match[5]) ? Number(match[5]) : months.indexOf(match[5].slice(0,3).toLowerCase()) + 1;
    const day = Number(match[1] ? match[3] : match[4]);
    const dateOnly = match[7] === undefined;
    let hour = dateOnly ? 23 : Number(match[7]);
    const minute = dateOnly ? 59 : Number(match[8]);
    const second = dateOnly ? 59 : Number(match[9] || 0);
    if (match[10]) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (/pm/i.test(match[10]) ? 12 : 0); }
    if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
    const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
    return { time: utc.getTime() - 330 * 60000, dateOnly };
  }
  function assignmentRows(doc: Document) {
    const records: VtopAssignmentRow[] = [];
    for (const {headers, cells, row} of tableRows(doc)) {
      const d = headers.findIndex(h => /due date|last date|deadline/i.test(h));
      if (d < 0) continue;
      const deadline = parseDeadline(cells[d]); if (!deadline) continue;
      const s = headers.findIndex(h => /uploaded|submission status|^status$/i.test(h));
      // The dashboard has no status column; a "Last Updated On" timestamp means a file was uploaded.
      const u = s < 0 ? headers.findIndex(h => /last updated/i.test(h)) : -1;
      const status = s < 0 ? '' : cells[s];
      const submitted = u >= 0 ? !!cells[u] && !/^[-–—\s]*$/.test(cells[u]) :
        !/not|pending|no\b|yet|unsubmitted/i.test(status) && /^(yes|submitted|uploaded|completed)(?:\b|$)/i.test(status);
      const title = headers.findIndex(h => /assignment title|^title$|assignment name/i.test(h));
      const course = headers.findIndex(h => /course name|course title|course detail/i.test(h));
      records.push({ label: [cells[course], cells[title]].filter(Boolean).join(' · ') || `Assignment ${records.length + 1}`, title: cells[title] || '',
        ...deadline, submitted, statusKnown: s >= 0 || u >= 0, row, dueCell: row?.cells[d] });
    }
    return records;
  }
  function dueSummary<T extends VtopDueRecord>(records: readonly T[], now = Date.now()) {
    const pending = records.filter(record => !record.submitted).sort((a,b) => a.time - b.time);
    return { next: pending.find(record => record.time >= now) || null, overdue: pending.filter(record => record.time < now).length, pending };
  }
  function countdown(time: number, now = Date.now()) {
    const difference = time - now;
    const minutes = Math.ceil(Math.abs(difference) / 60000);
    const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
    return `${difference < 0 ? 'Overdue by' : 'Due in'} ${days ? `${days}d ` : ''}${hours}h ${mins}m`;
  }
  // One short line per assignment, for inline display next to a course or due date.
  function dueState(record: VtopDueRecord, now = Date.now()): VtopDueState {
    if (record.submitted) return { tone: 'done', text: 'Submitted' };
    const left = record.time - now, minutes = Math.ceil(Math.abs(left) / 60000);
    const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
    // Two largest units are enough for a badge; overdue work only needs days once it is a day late.
    const span = days ? (left < 0 ? `${days}d` : `${days}d ${hours}h`) : hours ? `${hours}h ${mins}m` : `${mins}m`;
    return { tone: left < 0 ? 'overdue' : left < 2 * 86400000 ? 'soon' : 'pending', text: `${left < 0 ? 'Overdue by' : 'Due in'} ${span}` };
  }
  // Courses on Digital Assignment Upload: each row opens its dashboard via myFunction('<classId>').
  function assignmentCourses(doc: Document) {
    const courses: VtopAssignmentCourse[] = [];
    for (const table of doc.querySelectorAll('table')) {
      const rows = [...table.rows].filter(row => row.closest('table') === table);
      const headers = rows[0] ? [...rows[0].cells].map(cell => clean(cell.textContent)) : [];
      if (!headers.some(h => /course title/i.test(h)) || !headers.some(h => /dashboard/i.test(h))) continue;
      for (const row of rows.slice(1)) {
        const button = row.querySelector('[onclick*="myFunction"]');
        const classId = button?.getAttribute('onclick')!.match(/myFunction\(\s*['"]([A-Za-z0-9]+)['"]/)?.[1];
        const dashboardCell = button?.closest('td,th') as HTMLTableCellElement | null | undefined;
        if (classId && dashboardCell?.parentElement === row) courses.push({ classId, row, table, headerRow: rows[0], dashboardCell });
      }
    }
    return courses;
  }
  const api: VtopEnhancementsApi = { attendance, attendanceRows, parseDeadline, assignmentRows, dueSummary, countdown, dueState, assignmentCourses };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VtopEnhancements = api;
})(globalThis);
