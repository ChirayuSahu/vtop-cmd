"use client";

import { useEffect, useRef, useState } from "react";
import { B, Logo } from "@/components/mocks";

// Loops only run while the card is on screen, and not at all with reduced motion.
function useLoopActive<T extends Element>() {
  const ref = useRef<T>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, active] as const;
}

const pages = [
  { label: "Class Attendance", category: "Academics", keywords: "attendance class" },
  { label: "Digital Assignment Upload", category: "Examination", keywords: "da assignment upload digital" },
  { label: "CGPA calculator", category: "Study tools", keywords: "cgpa gpa grades calculator" },
  { label: "Grade History", category: "Examination", keywords: "grade history cgpa gpa" },
  { label: "Time Table", category: "Academics", keywords: "timetable time table class schedule" },
  { label: "Marks", category: "Examination", keywords: "marks scores" },
  { label: "Course Page", category: "Academics", keywords: "course materials" },
];

const queries = ["attendance", "DA", "cgpa", "timetable"];

function matches(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return pages.slice(0, 3);
  // Match the start of a word, so "DA" finds Digital Assignment and not "atten-da-nce".
  return pages
    .filter((page) => `${page.label} ${page.keywords}`.toLowerCase().split(/\s+/).some((word) => word.startsWith(needle)))
    .slice(0, 3);
}

// The command menu typing a search, showing live results, then clearing it for the next one.
export function TypingMenu() {
  const [ref, active] = useLoopActive<HTMLDivElement>();
  const [query, setQuery] = useState(queries[0]);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;
    let text = queries[0];
    const step = (mode: "hold" | "erase" | "type") => {
      if (mode === "hold") {
        timer = setTimeout(() => step("erase"), 1800);
      } else if (mode === "erase") {
        text = text.slice(0, -1);
        setQuery(text);
        if (text) timer = setTimeout(() => step("erase"), 45);
        else {
          index = (index + 1) % queries.length;
          timer = setTimeout(() => step("type"), 350);
        }
      } else {
        const target = queries[index];
        text = target.slice(0, text.length + 1);
        setQuery(text);
        timer = setTimeout(() => step(text === target ? "hold" : "type"), 95);
      }
    };
    timer = setTimeout(() => step("erase"), 1400);
    return () => clearTimeout(timer);
  }, [active]);

  const results = matches(query);
  // Rows re-enter whenever the result set changes rather than sliding into new positions.
  const resultKey = results.map((page) => page.label).join("|");
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-2xl border border-line bg-white text-left shadow-2xl shadow-black/10">
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
        <Logo size={18} />
        <span className="flex flex-1 items-center truncate text-sm">
          {query}
          <span className="caret ml-px inline-block h-4 w-px bg-ink" />
        </span>
        <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">⌘ K</kbd>
      </div>
      <ul className="h-[7.75rem] p-1.5">
        {results.map((page, index) => (
          <li
            key={`${resultKey}-${index}`}
            className={`row-in flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13px] ${index === 0 ? "bg-accent-soft" : ""}`}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span className="truncate">{page.label}</span>
            <span className="shrink-0 text-[11px] text-muted">{page.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const courses = [
  { name: "Data Structures", percent: 82, note: <>You can still miss <B>3 classes</B>.</>, bars: [38, 62, 48, 80, 56, 92, 70] },
  { name: "Operating Systems", percent: 71, note: <>Attend the <B>next 4 classes</B> to reach 75%.</>, bars: [70, 52, 64, 40, 58, 46, 34] },
  { name: "Computer Networks", percent: 90, note: <>You can still miss <B>6 classes</B>.</>, bars: [60, 74, 82, 70, 88, 96, 84] },
];

// Cycles through courses: the percentage counts to the new value and the bars resize.
export function AttendanceCard() {
  const [ref, active] = useLoopActive<HTMLDivElement>();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(courses[0].percent);
  const from = useRef(courses[0].percent);
  const course = courses[index];

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % courses.length), 3400);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      setShown(Math.round(begin + (course.percent - begin) * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = course.percent;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [course.percent]);

  const low = course.percent < 75;
  return (
    <div ref={ref}>
      <div className="flex items-center justify-between text-sm">
        <span key={course.name} className="row-in truncate font-medium">{course.name}</span>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">75% target</span>
      </div>
      <div className={`display mt-5 text-5xl tabular-nums transition-colors duration-500 ${low ? "text-[#d14343]" : ""}`}>
        {/* Fixed width for the digits, so the "%" doesn't move while counting. */}
        <span className="inline-block w-[2ch]">{shown}</span>%
      </div>
      <p key={course.name} className="row-in mt-1 min-h-10 text-sm text-muted">{course.note}</p>
      <div className="mt-6 flex h-24 items-end gap-1.5">
        {course.bars.map((height, bar) => (
          // Bars scale instead of resizing, so changing courses never moves the layout.
          <span
            key={bar}
            className={`h-full flex-1 origin-bottom rounded-t-md transition-[scale,background-color] duration-700 ease-out ${
              bar === 5 ? (low ? "bg-[#ff5f57]" : "bg-accent") : "bg-accent/20"
            }`}
            style={{ scale: `1 ${height / 100}`, transitionDelay: `${bar * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

const shortcuts = [
  { keys: ["⌘", "K"], caption: "on macOS" },
  { keys: ["Ctrl", "K"], caption: "on Windows and Linux" },
];

// Keycaps that press in turn, alternating between the macOS and Windows/Linux shortcut.
export function ShortcutKeys() {
  const [ref, active] = useLoopActive<HTMLDivElement>();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % shortcuts.length), 2600);
    return () => clearInterval(timer);
  }, [active]);
  const shortcut = shortcuts[index];
  return (
    <div ref={ref}>
      <div key={index} className="flex gap-2.5">
        {shortcut.keys.map((key, position) => (
          <kbd
            key={key}
            className={`keycap display flex h-16 min-w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-3xl ${active ? "pressing" : ""}`}
            style={{ animationDelay: `${300 + position * 160}ms` }}
          >
            {key}
          </kbd>
        ))}
      </div>
      <p className="mt-4 min-h-10 text-sm text-white/60">
        One shortcut to any page, <span key={shortcut.caption} className="row-in inline-block text-white">{shortcut.caption}</span>.
      </p>
    </div>
  );
}
