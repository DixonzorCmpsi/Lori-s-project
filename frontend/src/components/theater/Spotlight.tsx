import { motion } from 'framer-motion';

interface SpotlightProps {
  className?: string;
}

export function Spotlight({ className = '' }: SpotlightProps) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Main center spotlight */}
      <motion.div
        className="absolute"
        style={{
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '120%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 220, 140, 0.06) 0%, rgba(255, 200, 100, 0.03) 30%, transparent 70%)',
        }}
        animate={{
          opacity: [0.8, 1, 0.8],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Left accent light */}
      <motion.div
        className="absolute"
        style={{
          top: '-10%',
          left: '10%',
          width: '25%',
          height: '80%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 180, 100, 0.03) 0%, transparent 60%)',
          transform: 'rotate(-15deg)',
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />

      {/* Right accent light */}
      <motion.div
        className="absolute"
        style={{
          top: '-10%',
          right: '10%',
          width: '25%',
          height: '80%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 180, 100, 0.03) 0%, transparent 60%)',
          transform: 'rotate(15deg)',
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />
    </div>
  );
}
