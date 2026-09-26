export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg-core" x1="4" y1="4" x2="28" y2="28">
          <stop stopColor="#9b8cff" />
          <stop offset="1" stopColor="#4fe3d1" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" stroke="url(#lg-core)" strokeOpacity="0.35" />
      <path d="M11 12.5h7.5a4 4 0 0 1 0 8H13" stroke="url(#lg-core)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M15.5 17.8 12.6 20.5l2.9 2.7" stroke="url(#lg-core)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <g style={{ transformOrigin: "16px 16px", animation: "spin 6s linear infinite" }}>
        <circle cx="16" cy="1.5" r="1.8" fill="#d4ff4f" />
      </g>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion: reduce){g{animation:none!important}}`}</style>
    </svg>
  );
}
