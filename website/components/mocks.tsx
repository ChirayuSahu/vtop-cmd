// Small illustrations of the extension's UI, drawn with HTML so no real student data can appear.

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    // A tiny SVG needs no image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`rounded-[24%] select-none ${className}`}
    />
  );
}

// The key phrase in a muted description.
export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}

export function IconPill({ tone, children }: { tone: "accent" | "sun" | "ink"; children: React.ReactNode }) {
  const tones = {
    accent: "bg-accent text-white",
    sun: "bg-sun text-ink",
    ink: "bg-ink text-white",
  };
  // Sized in the surrounding headline's em, with its content scaled down inside.
  return (
    <span
      data-unit
      className={`inline-flex size-[0.78em] -translate-y-[0.06em] items-center justify-center rounded-full align-middle shadow-lg shadow-black/10 ${tones[tone]}`}
    >
      <span className="text-[0.3em] leading-none font-semibold tracking-normal">{children}</span>
    </span>
  );
}

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`size-4 ${className}`} aria-hidden>
      <path d="M4 12 12 4M5.5 4H12v6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const menuRows = [
  { label: "Class Attendance", category: "Academics" },
  { label: "Marks", category: "Examination" },
  { label: "Digital Assignment Upload", category: "Examination" },
  { label: "CGPA calculator", category: "Study tools" },
];

export function CommandMenu({ dark = false, rows = 4 }: { dark?: boolean; rows?: number }) {
  const surface = dark ? "bg-[#171d29] text-[#edf1fa] border-white/10" : "bg-white text-ink border-line";
  const muted = dark ? "text-[#97a4bb]" : "text-muted";
  const active = dark ? "bg-[#242f46]" : "bg-accent-soft";
  return (
    <div className={`w-full overflow-hidden rounded-2xl border text-left shadow-2xl shadow-black/10 ${surface}`}>
      <div className={`flex items-center gap-2.5 border-b px-3.5 py-3 ${dark ? "border-white/10" : "border-line"}`}>
        <Logo size={18} />
        <span className="flex-1 truncate text-sm">attendance</span>
        <kbd className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${muted} ${dark ? "border-white/15" : "border-line"}`}>
          ⌘ K
        </kbd>
      </div>
      <ul className="p-1.5">
        {menuRows.slice(0, rows).map((row, index) => (
          <li
            key={row.label}
            className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[13px] ${index === 0 ? active : ""}`}
          >
            <span className="truncate">{row.label}</span>
            <span className={`shrink-0 text-[11px] ${muted}`}>{row.category}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
