"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { B, CommandMenu, Logo } from "@/components/mocks";

const DURATION = 6000;

function PageSkeleton({ light = false }: { light?: boolean }) {
  const bar = light ? "bg-[#e3e8f0]" : "bg-white/8";
  const card = light ? "bg-[#f3f5f9]" : "bg-white/5";
  return (
    <div className="grid h-full grid-cols-[100px_1fr] gap-3 p-4 sm:grid-cols-[140px_1fr]">
      <div className="space-y-2.5">
        {[70, 55, 80, 45, 65, 50, 72, 40].map((width, index) => (
          <div key={index} className={`h-2.5 rounded ${bar}`} style={{ width: `${width}%` }} />
        ))}
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`h-14 rounded-lg ${card}`} />
          ))}
        </div>
        <div className={`space-y-2 rounded-lg p-3 ${card}`}>
          {[90, 75, 85, 60, 80, 70, 50].map((width, index) => (
            <div key={index} className={`h-2 rounded ${bar}`} style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommandScene() {
  return (
    <div className="relative h-full">
      <div className="absolute inset-0 opacity-60">
        <PageSkeleton />
      </div>
      <div className="absolute inset-0 bg-black/30" />
      <div className="scene-pop absolute top-10 left-1/2 w-[82%] max-w-md -translate-x-1/2">
        <CommandMenu dark rows={4} />
      </div>
    </div>
  );
}

function DarkModeScene() {
  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 bg-white">
        <PageSkeleton light />
      </div>
      <div className="wipe absolute inset-0 bg-[#0e131c]">
        <PageSkeleton />
      </div>
      <div className="wipe-edge absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-[#a9beff] to-transparent" />
      <div className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-black/60 py-1.5 pr-1.5 pl-3 text-xs text-white backdrop-blur">
        Dark mode
        <span className="relative h-5 w-9 rounded-full bg-white/20">
          <span className="toggle-knob absolute top-0.5 left-0.5 size-4 rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}

const semesters = ["Winter Semester 2025-26", "Summer Semester 2026", "Fall Semester 2026-27", "Winter Semester 2026-27"];

function SemesterScene() {
  return (
    <div className="flex h-full items-start justify-center bg-[#0e131c] p-6 pt-10">
      <div className="w-full max-w-sm rounded-2xl bg-[#171d29] p-5 text-[#edf1fa] shadow-xl">
        <div className="text-xs text-[#97a4bb]">Time Table</div>
        <div className="mt-1 font-medium">Select a semester</div>
        <div className="relative mt-4">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
            <span className="semester-value">Fall Semester 2026-27</span>
            <span className="text-[#97a4bb]">▾</span>
          </div>
          <ul className="semester-list absolute inset-x-0 top-12 z-10 rounded-lg border border-white/10 bg-[#1d2535] p-1 text-sm shadow-2xl">
            {semesters.map((semester) => (
              <li key={semester} className="relative rounded-md px-3 py-2">
                {semester === "Fall Semester 2026-27" && <span className="semester-pick absolute inset-0 rounded-md bg-[#2f5fe0]/40" />}
                <span className="relative">{semester}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="semester-badge mt-16 inline-flex items-center gap-2 rounded-full bg-[#28c840]/15 px-3 py-1.5 text-xs text-[#6ee787]">
          ✓ Default semester applied
        </div>
      </div>
    </div>
  );
}

const marks = [
  ["Quiz 1", "10", "5", "8.5"],
  ["CAT 1", "50", "15", "12.0"],
  ["Digital Assignment", "10", "10", "9.0"],
  ["CAT 2", "50", "15", "13.0"],
];

function MarksScene() {
  return (
    <div className="h-full bg-[#0e131c] p-5 text-[13px] text-[#edf1fa]">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium">Data Structures · Marks</span>
        <span className="text-xs text-[#97a4bb]">Fall 2026-27</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] bg-white/5 px-3 py-2 text-[11px] text-[#97a4bb]">
          <span>Component</span>
          <span className="text-right">Max</span>
          <span className="text-right">Weight %</span>
          <span className="text-right">Weighted</span>
        </div>
        {marks.map(([name, max, weight, scored], index) => (
          <div
            key={name}
            className="row-stagger grid grid-cols-[1.6fr_repeat(3,1fr)] border-t border-white/5 px-3 py-2.5"
            style={{ animationDelay: `${index * 140}ms` }}
          >
            <span className="truncate">{name}</span>
            <span className="text-right text-[#97a4bb]">{max}</span>
            <span className="text-right text-[#97a4bb]">{weight}</span>
            <span className="text-right">{scored}</span>
          </div>
        ))}
        <div className="total-row grid grid-cols-[1.6fr_repeat(3,1fr)] border-t border-[#a9beff]/30 bg-[#22314f] px-3 py-2.5 font-medium">
          <span>Total</span>
          <span className="text-right">120</span>
          <span className="text-right">45</span>
          <span className="text-right">42.5</span>
        </div>
      </div>
      <div className="total-row mt-3 text-right text-xs font-medium text-[#ff99a8]">2.5 marks lost</div>
    </div>
  );
}

const terms = [
  ["Fall 25", "8.62"],
  ["Winter 26", "8.91"],
  ["Summer 26", "9.10"],
];

const grades = [
  ["Data Structures", "S"],
  ["Operating Systems", "A"],
  ["Computer Networks", "S"],
];

function CgpaScene() {
  return (
    <div className="h-full bg-[#0e131c] p-5 text-[#edf1fa]">
      <div className="grid grid-cols-3 gap-2">
        {terms.map(([term, gpa], index) => (
          <div key={term} className="row-stagger rounded-xl bg-white/5 p-3" style={{ animationDelay: `${index * 120}ms` }}>
            <div className="text-[11px] text-[#97a4bb]">{term}</div>
            <div className="mt-1 text-lg font-medium">{gpa}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {grades.map(([course, grade], index) => (
          <div
            key={course}
            className="row-stagger flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-[13px]"
            style={{ animationDelay: `${360 + index * 120}ms` }}
          >
            <span>{course}</span>
            <span className="flex items-center gap-1.5 text-[#97a4bb]">
              <span className="flex size-5 items-center justify-center rounded bg-white/10">−</span>
              <span className="w-4 text-center font-medium text-[#edf1fa]">{grade}</span>
              <span className="flex size-5 items-center justify-center rounded bg-white/10">+</span>
            </span>
          </div>
        ))}
      </div>
      <div className="total-row mt-4 flex items-end justify-between rounded-xl bg-[#22314f] p-4">
        <div>
          <div className="text-[11px] text-[#a9beff]">Projected CGPA</div>
          <div className="display mt-1 text-4xl">9.08</div>
        </div>
        <div className="text-right text-xs text-[#97a4bb]">
          Semester GPA
          <div className="text-base font-medium text-[#edf1fa]">9.67</div>
        </div>
      </div>
    </div>
  );
}

function DocumentScene() {
  return (
    <div className="flex h-full flex-col bg-[#0e131c]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5 text-xs text-[#97a4bb]">
        <span className="truncate text-[#edf1fa]">Module 3 - Trees.pdf</span>
        <span className="ml-auto">1 / 12</span>
        <span className="rounded-md border border-white/10 px-2 py-0.5">− 100% +</span>
        <span className="rounded-md bg-[#2f5fe0] px-2.5 py-1 text-white">Download</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="doc-scroll absolute inset-x-0 top-0 space-y-4 px-10 pt-5">
          {[0, 1, 2].map((page) => (
            <div key={page} className="mx-auto aspect-[1/1.3] max-w-[260px] rounded bg-white p-5 shadow-xl">
              <div className="h-3 w-2/3 rounded bg-[#182438]" />
              <div className="mt-4 space-y-1.5">
                {[95, 88, 92, 70, 90, 84, 60].map((width, index) => (
                  <div key={index} className="h-1.5 rounded bg-[#d6dbe4]" style={{ width: `${width}%` }} />
                ))}
              </div>
              <div className="mt-4 h-16 rounded bg-[#e8eefc]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const features: { title: string; body: ReactNode; chip: string; scene: ReactNode }[] = [
  {
    title: "Command menu",
    body: <>Press <B>⌘K or Ctrl+K</B> and type any page: “DA”, “marks”, “timetable”. <B>Typos are fine.</B></>,
    chip: "⌘K anywhere",
    scene: <CommandScene />,
  },
  {
    title: "Dark mode",
    body: <>The <B>whole portal</B> in a calm dark theme, with <B>low-contrast text fixed</B> and status colours kept.</>,
    chip: "Easy on the eyes",
    scene: <DarkModeScene />,
  },
  {
    title: "Default semester",
    body: <><B>Pick your semester once.</B> Every page that asks for it is filled in when it first opens.</>,
    chip: "Set it once",
    scene: <SemesterScene />,
  },
  {
    title: "Attendance & marks",
    body: <>How many classes <B>you can still miss</B>, and a total row showing the <B>marks already lost</B>.</>,
    chip: "Totals included",
    scene: <MarksScene />,
  },
  {
    title: "CGPA calculator",
    body: <>Reads your grade history and current courses, then <B>projects your GPA and CGPA</B>.</>,
    chip: "Plan your grades",
    scene: <CgpaScene />,
  },
  {
    title: "Document viewer",
    body: <><B>PDFs, Word files and slides</B> open right inside VTOP instead of piling up in Downloads.</>,
    chip: "No more downloads",
    scene: <DocumentScene />,
  },
];

// One feature open at a time; it advances on its own (paused on hover) and swaps the scene on the right.
export function FeatureShowcase({ heading }: { heading: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // No auto-advance with reduced motion, or below lg where the scene sits under the list and
    // advancing would keep moving the page while you read.
    const queries = [matchMedia("(prefers-reduced-motion: reduce)"), matchMedia("(max-width: 1023px)")];
    const update = () => setStill(queries.some((query) => query.matches));
    queries.forEach((query) => query.addEventListener("change", update));
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      update();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      queries.forEach((query) => query.removeEventListener("change", update));
    };
  }, []);

  useEffect(() => {
    if (paused || !visible || still) return;
    const timer = setTimeout(() => setActive((current) => (current + 1) % features.length), DURATION);
    return () => clearTimeout(timer);
  }, [active, paused, visible, still]);

  const running = visible && !paused && !still;
  return (
    <div ref={ref} className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {heading}
        <div className="mt-8 space-y-2.5">
          {features.map((feature, index) => {
            const open = index === active;
            return (
              <button
                key={feature.title}
                type="button"
                aria-expanded={open}
                onClick={() => setActive(index)}
                className={`block w-full rounded-2xl border bg-white px-5 py-4 text-left transition-colors duration-300 ${
                  open ? "border-ink/15 shadow-sm" : "border-line hover:border-ink/15"
                }`}
              >
                <span className="flex items-center justify-between text-[15px] font-medium">
                  {feature.title}
                  <span className={`text-xl font-light text-muted transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
                </span>
                <span
                  className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <span className="overflow-hidden">
                    <span className="block min-h-[4.25rem] pt-2 text-sm text-muted sm:min-h-[2.75rem]">{feature.body}</span>
                    <span className={`mt-3 h-0.5 overflow-hidden rounded-full bg-line ${still ? "hidden" : "block"}`}>
                      {open && (
                        <span
                          key={active}
                          className="progress block h-full bg-accent"
                          style={{
                            animationDuration: `${DURATION}ms`,
                            animationPlayState: running ? "running" : "paused",
                          }}
                        />
                      )}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative lg:sticky lg:top-28">
        <div className="overflow-hidden rounded-2xl border border-line bg-[#0e131c] shadow-2xl shadow-black/15">
          <div className="flex items-center gap-1.5 bg-[#171d29] px-4 py-3">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 flex flex-1 items-center gap-2 truncate rounded-md bg-white/5 px-3 py-1 text-[11px] text-[#97a4bb]">
              <Logo size={12} />
              vtop.vit.ac.in/vtop/content
            </span>
          </div>
          <div className="relative h-[380px] sm:h-[420px]">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                aria-hidden={index !== active}
                className={`scene absolute inset-0 transition-[opacity,filter,transform] duration-500 ${
                  index === active ? "is-active opacity-100" : "pointer-events-none scale-[0.98] opacity-0 blur-sm"
                }`}
              >
                {feature.scene}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -top-5 -right-3 hidden sm:block">
          <div key={active} className="chip-in rounded-2xl bg-sun px-4 py-2.5 text-sm font-medium shadow-lg">
            {features[active].chip}
          </div>
        </div>
      </div>
    </div>
  );
}
