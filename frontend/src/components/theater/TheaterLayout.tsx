import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Curtain } from './Curtain';
import { StageFloor } from './StageFloor';
import { Spotlight } from './Spotlight';
import { Pelmet } from './Pelmet';

const CURTAIN_WIDTH = 18;
const spring = { type: 'spring' as const, stiffness: 80, damping: 18 };

interface TheaterLayoutProps {
  curtainsOpen: boolean;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
}

export function TheaterLayout({
  curtainsOpen,
  leftPanel,
  rightPanel,
  children,
  topBar,
}: TheaterLayoutProps) {
  return (
    <div
      className="relative w-screen min-h-[100dvh] overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, hsl(25, 12%, 8%) 0%, hsl(25, 10%, 4%) 100%)',
      }}
    >
      <Spotlight />
      <StageFloor />

      <Curtain side="left" isOpen={curtainsOpen} />
      <Curtain side="right" isOpen={curtainsOpen} />

      <Pelmet />

      <AnimatePresence>
        {curtainsOpen && topBar && (
          <motion.div
            className="absolute z-[55]"
            style={{ top: '45px', left: `${CURTAIN_WIDTH}%`, right: `${CURTAIN_WIDTH}%` }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ ...spring, delay: 1.2 }}
          >
            {topBar}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-[35] flex h-[100dvh]">
        <div className="flex-shrink-0" style={{ width: `${CURTAIN_WIDTH}%` }}>
          <AnimatePresence>
            {curtainsOpen && leftPanel && (
              <motion.div
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ ...spring, delay: 1.4 }}
              >
                {leftPanel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          {children}
        </div>

        <div className="flex-shrink-0" style={{ width: `${CURTAIN_WIDTH}%` }}>
          <AnimatePresence>
            {curtainsOpen && rightPanel && (
              <motion.div
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ ...spring, delay: 1.4 }}
              >
                {rightPanel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
