import { motion } from 'framer-motion';

export function Pelmet() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Main pelmet bar — rich dark wood with gold trim */}
      <div
        className="relative h-8"
        style={{
          background: 'linear-gradient(180deg, hsl(25, 30%, 14%) 0%, hsl(22, 25%, 10%) 60%, hsl(20, 22%, 8%) 100%)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
        }}
      >
        {/* Stage wood grain texture */}
        <div
          className="absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage: `repeating-linear-gradient(92deg,
              transparent 0px, rgba(180,130,70,0.25) 1px, transparent 3px, transparent 12px,
              rgba(160,110,50,0.15) 12px, transparent 14px, transparent 22px)`,
          }}
        />

        {/* Top gold rail */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg,
              hsl(38, 35%, 18%), hsl(43, 65%, 42%) 25%, hsl(43, 74%, 49%) 50%, hsl(43, 65%, 42%) 75%, hsl(38, 35%, 18%))`,
          }}
        />

        {/* Decorative center inlay */}
        <div
          className="absolute top-[12px] left-[8%] right-[8%] h-[1px]"
          style={{
            background: `linear-gradient(90deg,
              transparent, hsl(43, 55%, 35%) 15%, hsl(43, 65%, 42%) 50%, hsl(43, 55%, 35%) 85%, transparent)`,
          }}
        />

        {/* Bottom gold rail */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg,
              hsl(38, 25%, 15%), hsl(43, 55%, 34%) 25%, hsl(43, 65%, 40%) 50%, hsl(43, 55%, 34%) 75%, hsl(38, 25%, 15%))`,
          }}
        />
      </div>

      {/* Fringe tassels */}
      <div className="flex">
        {Array.from({ length: 50 }, (_, i) => (
          <motion.div
            key={i}
            className="flex-1"
            style={{
              height: '11px',
              background: `linear-gradient(180deg, hsl(43, 60%, 38%) 0%, hsl(38, 50%, 24%) 100%)`,
              clipPath: 'polygon(15% 0%, 85% 0%, 50% 100%)',
            }}
            animate={{ y: [0, 0.5, 0] }}
            transition={{
              duration: 2.5 + (i % 5) * 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: (i % 7) * 0.1,
            }}
          />
        ))}
      </div>

      {/* Shadow below */}
      <div
        className="h-10"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}
