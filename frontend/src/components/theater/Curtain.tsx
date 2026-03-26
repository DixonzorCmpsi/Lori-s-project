import { motion } from 'framer-motion';

interface CurtainProps {
  side: 'left' | 'right';
  isOpen: boolean;
}

export function Curtain({ side, isOpen }: CurtainProps) {
  const folds = Array.from({ length: 6 }, (_, i) => i);

  return (
    <motion.div
      className="absolute top-0 bottom-0 z-30 overflow-hidden pointer-events-none"
      style={{
        [side]: 0,
        width: '18%',
      }}
      animate={{
        x: isOpen ? (side === 'left' ? '-100%' : '100%') : 0,
      }}
      transition={{
        duration: 1.8,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <div className="relative w-full h-full">
        {/* Base curtain — deep theater red */}
        <div className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              hsl(350, 50%, 20%) 0%,
              hsl(350, 48%, 18%) 30%,
              hsl(350, 45%, 16%) 70%,
              hsl(350, 42%, 12%) 100%)`,
          }}
        />

        {/* Vertical folds */}
        {folds.map((i) => {
          const offset = (i / folds.length) * 100;
          const isEven = i % 2 === 0;
          return (
            <motion.div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: `${offset}%`,
                width: `${100 / folds.length}%`,
                background: isEven
                  ? 'linear-gradient(90deg, rgba(0,0,0,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(0,0,0,0.12) 100%)'
                  : 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.18) 50%, rgba(255,255,255,0.02) 100%)',
              }}
              animate={{ scaleX: [1, isEven ? 1.015 : 0.985, 1] }}
              transition={{
                duration: 5 + i * 0.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          );
        })}

        {/* Subtle sway */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 10%, transparent 90%, rgba(0,0,0,0.25) 100%)',
          }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Inner edge shadow for depth */}
        <div className="absolute top-0 bottom-0"
          style={{
            [side === 'left' ? 'right' : 'left']: 0,
            width: '35%',
            background: side === 'left'
              ? 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 100%)'
              : 'linear-gradient(270deg, transparent 0%, rgba(0,0,0,0.35) 100%)',
          }}
        />

        {/* Subtle velvet sheen */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            background: `radial-gradient(ellipse at ${side === 'left' ? '30%' : '70%'} 40%, rgba(255,200,150,1) 0%, transparent 60%)`,
          }}
        />
      </div>
    </motion.div>
  );
}
