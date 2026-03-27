import { ReactNode } from 'react';

/**
 * A colored "gaffer tape" strip — iconic backstage accent.
 * Use instead of pill-shaped badges for rehearsal types, tags, etc.
 */

type TapeColor = 'yellow' | 'blue' | 'red' | 'green' | 'purple' | 'pink' | 'white' | 'black';

const tapeColors: Record<TapeColor, { bg: string; text: string; edge: string }> = {
  yellow: { bg: 'hsl(48, 85%, 62%)',  text: 'hsl(35, 50%, 15%)',  edge: 'hsl(48, 70%, 52%)' },
  blue:   { bg: 'hsl(210, 55%, 55%)', text: 'hsl(210, 80%, 95%)', edge: 'hsl(210, 50%, 45%)' },
  red:    { bg: 'hsl(0, 60%, 48%)',   text: 'hsl(0, 90%, 95%)',   edge: 'hsl(0, 55%, 38%)' },
  pink:   { bg: 'hsl(340, 65%, 58%)', text: 'hsl(340, 90%, 97%)', edge: 'hsl(340, 55%, 48%)' },
  green:  { bg: 'hsl(140, 45%, 42%)', text: 'hsl(140, 80%, 95%)', edge: 'hsl(140, 40%, 32%)' },
  purple: { bg: 'hsl(270, 45%, 52%)', text: 'hsl(270, 80%, 95%)', edge: 'hsl(270, 40%, 42%)' },
  white:  { bg: 'hsl(0, 0%, 88%)',    text: 'hsl(0, 0%, 15%)',    edge: 'hsl(0, 0%, 78%)' },
  black:  { bg: 'hsl(0, 0%, 15%)',    text: 'hsl(0, 0%, 85%)',    edge: 'hsl(0, 0%, 8%)' },
};

interface GafferTapeProps {
  color?: TapeColor;
  children: ReactNode;
  className?: string;
  /** Slight random rotation for organic feel (degrees) */
  rotate?: number;
}

export function GafferTape({ color = 'yellow', children, className = '', rotate = 0 }: GafferTapeProps) {
  const c = tapeColors[color];
  return (
    <span
      className={`inline-block px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider relative ${className}`}
      style={{
        background: c.bg,
        color: c.text,
        transform: `rotate(${rotate}deg)`,
        /* Torn / rough edges via clip-path */
        clipPath: `polygon(
          0% 8%, 2% 0%, 6% 5%, 10% 0%, 15% 3%, 20% 0%, 25% 4%,
          30% 0%, 35% 2%, 40% 0%, 45% 5%, 50% 0%, 55% 3%, 60% 0%,
          65% 4%, 70% 0%, 75% 2%, 80% 0%, 85% 5%, 90% 0%, 95% 3%, 98% 0%, 100% 6%,
          100% 92%, 98% 100%, 95% 96%, 90% 100%, 85% 97%, 80% 100%, 75% 95%,
          70% 100%, 65% 98%, 60% 100%, 55% 96%, 50% 100%, 45% 97%, 40% 100%,
          35% 95%, 30% 100%, 25% 98%, 20% 100%, 15% 96%, 10% 100%, 6% 97%, 2% 100%, 0% 94%
        )`,
        /* Cloth-like texture via subtle noise overlay */
        backgroundImage: `
          ${c.bg ? `linear-gradient(0deg, ${c.bg}, ${c.bg})` : ''},
          repeating-linear-gradient(90deg, transparent 0px, transparent 1px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 2px)
        `,
        boxShadow: `0 1px 3px rgba(0,0,0,0.2)`,
        fontFamily: '"Outfit", system-ui, sans-serif',
        lineHeight: '1.6',
      }}
    >
      {children}
    </span>
  );
}
