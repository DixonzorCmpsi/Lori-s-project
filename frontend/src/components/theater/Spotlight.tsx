import { motion } from 'framer-motion';

export function Spotlight() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
      {/* Primary overhead spotlight — focused on center stage / chalkboard */}
      <motion.div
        className="absolute"
        style={{
          top: '-25%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '55%',
          height: '130%',
          background: `radial-gradient(ellipse at 50% 0%,
            rgba(255, 210, 130, 0.10) 0%,
            rgba(255, 195, 100, 0.06) 20%,
            rgba(255, 180, 80, 0.02) 45%,
            transparent 70%)`,
        }}
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.015, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Left wing wash — warm amber hitting the left panel */}
      <motion.div
        className="absolute"
        style={{
          top: '-15%',
          left: '2%',
          width: '22%',
          height: '90%',
          background: `radial-gradient(ellipse at 50% 0%,
            rgba(255, 160, 80, 0.04) 0%,
            transparent 65%)`,
          transform: 'rotate(-12deg)',
        }}
        animate={{ opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* Right wing wash — cooler tone for contrast */}
      <motion.div
        className="absolute"
        style={{
          top: '-15%',
          right: '2%',
          width: '22%',
          height: '90%',
          background: `radial-gradient(ellipse at 50% 0%,
            rgba(200, 180, 255, 0.025) 0%,
            transparent 65%)`,
          transform: 'rotate(12deg)',
        }}
        animate={{ opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
      />

      {/* Subtle ambient glow at stage level — makes the floor feel lit */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: `radial-gradient(ellipse 70% 100% at 50% 100%,
            rgba(255, 200, 120, 0.03) 0%,
            transparent 70%)`,
        }}
      />
    </div>
  );
}
