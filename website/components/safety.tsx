// Minimal animated illustrations for the safety cards. Pure CSS/SVG, so they stop with reduced motion.

// A filled form whose Submit button waits for you.
export function YouSubmit() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-6">
      {["Reason", "Venue"].map((label) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-12 text-[11px] text-muted">{label}</span>
          <span className="flex h-7 flex-1 items-center rounded-md border border-line px-2">
            <span className="h-2 w-2/3 rounded bg-[#e3e8f0]" />
          </span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-end gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="waiting-dot size-1.5 rounded-full bg-accent" />
          Waiting for you
        </span>
        <span className="submit-wait rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white">Submit</span>
      </div>
    </div>
  );
}

const queue = ["Time Table", "Marks", "Dashboard"];

// Requests finish one after another on a single timeline.
export function RequestQueue() {
  return (
    <ul className="flex h-full flex-col justify-center gap-3.5 px-6">
      {queue.map((page, index) => (
        <li key={page} className={`queue-step-${index} flex items-center justify-between text-sm`}>
          <span className="queue-label">{page}</span>
          <span className="relative flex size-4 items-center justify-center">
            <span className="queue-pending absolute size-1.5 rounded-full bg-[#c8ccd4]" />
            <svg viewBox="0 0 16 16" className="queue-check absolute size-4 text-accent" aria-hidden>
              <path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Your browser talks to VTOP only; other destinations stay disconnected.
export function OnDevice() {
  return (
    <svg viewBox="0 0 320 150" className="h-full w-full" role="img" aria-label="Your browser connects only to VTOP">
      <g transform="translate(24 46)">
        <rect width="78" height="52" rx="9" fill="#fff" stroke="#e3e3e0" />
        <rect x="10" y="12" width="40" height="4" rx="2" fill="#d6dbe4" />
        <rect x="10" y="22" width="56" height="4" rx="2" fill="#e3e8f0" />
        <rect x="10" y="32" width="30" height="4" rx="2" fill="#e3e8f0" />
        <text x="39" y="68" textAnchor="middle" fontSize="9" fill="#8a8f98">Your browser</text>
      </g>

      <path d="M102 66 C150 66 168 40 212 40" fill="none" stroke="#2f5fe0" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle r="3" fill="#2f5fe0" className="packet" />
      <g transform="translate(212 26)">
        <rect width="88" height="28" rx="14" fill="#e8eefc" />
        <text x="44" y="18" textAnchor="middle" fontSize="10" fontWeight="600" fill="#2f5fe0">vtop.vit.ac.in</text>
      </g>

      {[
        { y: 92, label: "analytics" },
        { y: 122, label: "trackers" },
      ].map(({ y, label }, index) => (
        <g key={label} opacity="0.5">
          <path d={`M102 ${80 + index * 6} C140 ${80 + index * 6} 150 ${y} 176 ${y}`} fill="none" stroke="#d4d4d8" strokeWidth="1.2" strokeDasharray="3 4" />
          <g transform={`translate(212 ${y - 12})`}>
            <rect width="88" height="24" rx="12" fill="#f2f2f0" />
            <text x="44" y="16" textAnchor="middle" fontSize="10" fill="#8a8f98" textDecoration="line-through">
              {label}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
