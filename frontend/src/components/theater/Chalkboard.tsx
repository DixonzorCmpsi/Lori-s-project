import { ReactNode } from 'react';

interface ChalkboardProps {
  children: ReactNode;
  className?: string;
}

/** A realistic chalkboard with wooden frame, nailed to the stage wall */
export function Chalkboard({ children, className = '' }: ChalkboardProps) {
  return (
    <div
      className={`rounded-lg flex flex-col ${className}`}
      style={{
        /* Wooden frame as border + padding */
        background: 'linear-gradient(145deg, hsl(28, 40%, 25%) 0%, hsl(25, 35%, 20%) 40%, hsl(22, 30%, 16%) 100%)',
        padding: '10px',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,200,120,0.1)',
        position: 'relative',
      }}
    >
      {/* Wood grain texture on frame */}
      <div className="absolute inset-0 rounded-lg pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage: `repeating-linear-gradient(92deg, transparent 0px, rgba(180,130,70,0.3) 1px, transparent 3px, transparent 20px)`,
        }}
      />

      {/* Mounting nails */}
      <Nail style={{ position: 'absolute', top: '-2px', left: '14px', zIndex: 20 }} />
      <Nail style={{ position: 'absolute', top: '-2px', right: '14px', zIndex: 20 }} />

      {/* Green chalk surface */}
      <div
        className="rounded-sm relative overflow-hidden flex-1 min-h-0 flex flex-col"
        style={{
          background: 'linear-gradient(155deg, hsl(155, 20%, 24%) 0%, hsl(158, 16%, 20%) 30%, hsl(150, 13%, 18%) 70%, hsl(155, 18%, 22%) 100%)',
          boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.4), inset -1px -1px 4px rgba(0,0,0,0.2)',
        }}
      >
        {/* Chalk dust smudges */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80px 25px at 15% 20%, rgba(255,255,255,0.5) 0%, transparent 100%),
              radial-gradient(ellipse 100px 20px at 60% 45%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(ellipse 60px 30px at 35% 75%, rgba(255,255,255,0.45) 0%, transparent 100%),
              radial-gradient(ellipse 90px 22px at 80% 85%, rgba(255,255,255,0.3) 0%, transparent 100%)
            `,
          }}
        />

        {/* Fine scratches */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(12deg, transparent 0px, transparent 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 6px, transparent 6px, transparent 25px),
              repeating-linear-gradient(-18deg, transparent 0px, transparent 7px, rgba(255,255,255,0.15) 7px, rgba(255,255,255,0.15) 8px, transparent 8px, transparent 35px)
            `,
          }}
        />

        {/* Content on the board */}
        <div className="relative z-10 flex-1 min-h-0">
          {children}
        </div>
      </div>

      {/* Chalk tray */}
      <div className="relative h-2 mt-[-1px] mx-1 rounded-b-sm"
        style={{
          background: 'linear-gradient(180deg, hsl(25, 30%, 18%) 0%, hsl(25, 26%, 14%) 100%)',
          boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
        }}
      >
        <div className="absolute top-[-2px] left-[15%] w-5 h-[2px] rounded-full" style={{ background: 'rgba(255,255,255,0.55)' }} />
        <div className="absolute top-[-2px] left-[40%] w-4 h-[2px] rounded-full" style={{ background: 'rgba(255,220,100,0.5)' }} />
        <div className="absolute top-[-2px] right-[20%] w-3 h-[2px] rounded-full" style={{ background: 'rgba(255,150,150,0.45)' }} />
      </div>
    </div>
  );
}

function Nail({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ ...style, width: '16px', height: '16px' }}>
      <div className="w-full h-full rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, hsl(38, 30%, 50%), hsl(30, 25%, 28%) 60%, hsl(25, 20%, 18%))',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,220,150,0.15)',
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
        style={{ background: 'radial-gradient(circle, hsl(30, 20%, 35%), hsl(25, 15%, 20%))' }}
      />
    </div>
  );
}

interface StickyNoteProps {
  children: ReactNode;
  color?: 'yellow' | 'pink' | 'blue' | 'green' | 'white';
  rotate?: number;
  className?: string;
}

const noteColors = {
  yellow: { bg: 'hsl(48, 90%, 85%)', text: 'hsl(35, 40%, 20%)', shadow: 'rgba(180, 150, 50, 0.2)' },
  pink:   { bg: 'hsl(340, 80%, 88%)', text: 'hsl(340, 30%, 25%)', shadow: 'rgba(180, 80, 100, 0.2)' },
  blue:   { bg: 'hsl(210, 70%, 88%)', text: 'hsl(210, 30%, 22%)', shadow: 'rgba(80, 120, 180, 0.2)' },
  green:  { bg: 'hsl(140, 50%, 85%)', text: 'hsl(140, 30%, 20%)', shadow: 'rgba(80, 150, 80, 0.2)' },
  white:  { bg: 'hsl(40, 30%, 95%)',  text: 'hsl(25, 20%, 18%)', shadow: 'rgba(100, 80, 60, 0.15)' },
};

export function StickyNote({ children, color = 'yellow', rotate = 0, className = '' }: StickyNoteProps) {
  const c = noteColors[color];
  return (
    <div className={`relative ${className}`} style={{ transform: `rotate(${rotate}deg)` }}>
      {/* Pushpin */}
      <div className="absolute top-[-5px] left-1/2 -translate-x-1/2 z-10">
        <div className="w-3.5 h-3.5 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 35%, hsl(0, 65%, 58%), hsl(0, 55%, 38%))',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      <div className="p-3.5 rounded-sm mt-1" style={{ background: c.bg, color: c.text, boxShadow: `3px 4px 10px ${c.shadow}, 0 1px 3px rgba(0,0,0,0.12)` }}>
        <div className="absolute top-1 right-0 w-5 h-5" style={{ background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.03) 50%)` }} />
        {children}
      </div>
    </div>
  );
}

export function ChalkText({ children, className = '', size = 'md' }: { children: ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-xl' };
  return (
    <span className={`${sizes[size]} ${className}`}
      style={{
        color: 'rgba(255, 255, 255, 0.72)',
        textShadow: '0 0 6px rgba(255,255,255,0.08)',
        fontFamily: '"Playfair Display", serif',
        fontWeight: 400,
      }}
    >
      {children}
    </span>
  );
}
