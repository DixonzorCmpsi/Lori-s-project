import { motion } from 'framer-motion';

export function Pelmet() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Main pelmet bar — dark with gold trim */}
      <div className="relative h-7"
        style={{
          background: 'linear-gradient(180deg, hsl(25, 25%, 12%) 0%, hsl(25, 20%, 8%) 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {/* Top gold edge */}
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, hsl(38, 40%, 22%), hsl(38, 60%, 38%) 30%, hsl(38, 70%, 45%) 50%, hsl(38, 60%, 38%) 70%, hsl(38, 40%, 22%))',
          }}
        />

        {/* Decorative gold inlay */}
        <div className="absolute top-[10px] left-[5%] right-[5%] h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(38, 50%, 35%) 20%, hsl(38, 60%, 40%) 50%, hsl(38, 50%, 35%) 80%, transparent)',
          }}
        />

        {/* Bottom gold edge */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, hsl(38, 30%, 18%), hsl(38, 50%, 32%) 30%, hsl(38, 60%, 38%) 50%, hsl(38, 50%, 32%) 70%, hsl(38, 30%, 18%))',
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
              height: '10px',
              background: `linear-gradient(180deg, hsl(38, 55%, 35%) 0%, hsl(38, 45%, 22%) 100%)`,
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
      <div className="h-8"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 100%)' }}
      />
    </div>
  );
}
