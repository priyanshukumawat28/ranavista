import { Link } from 'react-router-dom';

export function LotusMark({ className = 'h-9 w-9', color = '#B89B6B' }) {
  return (
    <svg viewBox="0 0 64 48" className={className} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <path d="M32 4c6.5 7 6.5 20 0 30-6.5-10-6.5-23 0-30z" />
      <path d="M32 34c-2.5-9-10-17-20-18 .5 10 8.5 18 20 18z" />
      <path d="M32 34c2.5-9 10-17 20-18-.5 10-8.5 18-20 18z" />
      <path d="M32 34C27 26 16 22 5 24c3 7 14 12 27 10z" />
      <path d="M32 34c5-8 16-12 27-10-3 7-14 12-27 10z" />
      <path d="M10 41c8 3 15 2 22-4 7 6 14 7 22 4" />
    </svg>
  );
}

export default function Logo({ light = false, tagline = true, to = '/' }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="Ranavista home">
      <LotusMark className="h-9 w-11 transition-transform group-hover:-rotate-3" color={light ? '#d4bf98' : '#B89B6B'} />
      <span className="leading-none">
        <span className={`block font-serif text-[1.55rem] tracking-[0.08em] ${light ? 'text-white' : 'text-forest'}`}>RANAVISTA</span>
        {tagline && <span className={`mt-1 block text-[8px] tracking-[0.28em] ${light ? 'text-gold-light/80' : 'text-ink-medium'}`}>SOURCING TODAY FOR A BRIGHTER TOMORROW</span>}
      </span>
    </Link>
  );
}
