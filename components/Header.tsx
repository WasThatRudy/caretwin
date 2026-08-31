const NAV = [
  ["Monitor", "#monitor"],
  ["Dataset", "#dataset"],
  ["Analysis", "#analysis"],
  ["Models", "#models"],
  ["Method", "#method"],
];

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)]" style={{ background: "rgba(11,14,19,.75)", backdropFilter: "blur(12px)" }}>
      <div className="max-w-[1120px] mx-auto px-5 md:px-8 h-14 flex items-center gap-6">
        <a href="#top" className="flex items-baseline gap-2 no-underline">
          <span className="text-[16px] font-semibold tracking-tight text-[var(--ink)]">CareTwin</span>
          <span className="hidden sm:inline mono text-[11px] text-[var(--faint)]">elderly digital twin</span>
        </a>
        <nav className="ml-auto hidden md:flex items-center gap-5">
          {NAV.map(([label, href]) => (
            <a key={href} href={href} className="text-[13px] text-[var(--mute)] hover:text-[var(--ink)] no-underline transition">{label}</a>
          ))}
        </nav>
        <a href="https://github.com/WasThatRudy/caretwin" target="_blank" rel="noreferrer"
           className="text-[12.5px] mono px-2.5 py-1 rounded-md border border-[var(--line)] text-[var(--mute)] hover:text-[var(--ink)] hover:border-[var(--accent)] no-underline transition">
          GitHub ↗
        </a>
      </div>
    </header>
  );
}
