import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Curtain } from './Curtain';
import { StageFloor } from './StageFloor';
import { Spotlight } from './Spotlight';
import { Pelmet } from './Pelmet';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const PANEL_WIDTH = 18; // percentage for desktop side columns
const spring = { type: 'spring' as const, stiffness: 80, damping: 18 };

interface TheaterLayoutProps {
  curtainsOpen: boolean;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
  /** Mobile bottom navigation bar */
  mobileNav?: ReactNode;
  /** Slide-over drawer (tablet cast list, mobile menus) */
  drawerOpen?: boolean;
  drawerContent?: ReactNode;
  onDrawerClose?: () => void;
}

export function TheaterLayout({
  curtainsOpen,
  leftPanel,
  rightPanel,
  children,
  topBar,
  mobileNav,
  drawerOpen,
  drawerContent,
  onDrawerClose,
}: TheaterLayoutProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isDesktop = bp === 'desktop';

  return (
    <div
      className="relative w-screen min-h-[100dvh] overflow-hidden"
      style={{
        /* Deep Stage Burgundy → Midnight Charcoal gradient */
        background: `radial-gradient(ellipse at 50% 30%,
          hsl(350, 10%, 8%) 0%,
          hsl(350, 7%, 5%) 40%,
          hsl(240, 6%, 3%) 100%)`,
      }}
    >
      <Spotlight />
      <StageFloor />

      {/* Curtains — desktop & tablet only */}
      {!isMobile && (
        <>
          <Curtain side="left" isOpen={curtainsOpen} />
          <Curtain side="right" isOpen={curtainsOpen} />
        </>
      )}

      <Pelmet />

      {/* Top bar */}
      <AnimatePresence>
        {curtainsOpen && topBar && (
          <motion.div
            className="absolute z-[55]"
            style={{
              top: isMobile ? '40px' : '46px',
              left: isMobile ? '0' : `${PANEL_WIDTH}%`,
              right: isMobile ? '0' : `${PANEL_WIDTH}%`,
            }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ ...spring, delay: isMobile ? 0.3 : 1.2 }}
          >
            {topBar}
          </motion.div>
        )}
      </AnimatePresence>

      {/* === 3-column / 2-column / 1-column layout === */}
      <div className="relative z-[35] flex h-[100dvh]">
        {/* Left panel column — hidden on mobile */}
        {!isMobile && (
          <div className="flex-shrink-0" style={{ width: `${PANEL_WIDTH}%` }}>
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
        )}

        {/* Center stage */}
        <div className="flex-1 flex items-center justify-center relative">
          {children}
        </div>

        {/* Right panel column — desktop only */}
        {isDesktop && (
          <div className="flex-shrink-0" style={{ width: `${PANEL_WIDTH}%` }}>
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
        )}
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && mobileNav && (
        <div className="fixed bottom-0 left-0 right-0 z-[60]">{mobileNav}</div>
      )}

      {/* Slide-over drawer (tablet cast panel / mobile menus) */}
      <AnimatePresence>
        {drawerOpen && drawerContent && (
          <>
            {/* Scrim */}
            <motion.div
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onDrawerClose}
            />
            {/* Curtain-wipe drawer from right */}
            <motion.div
              className="fixed top-0 right-0 bottom-0 z-[75] w-80 max-w-[85vw] overflow-hidden"
              initial={{ x: '100%', clipPath: 'inset(0 0 0 100%)' }}
              animate={{ x: 0, clipPath: 'inset(0 0 0 0%)' }}
              exit={{ x: '100%', clipPath: 'inset(0 0 0 100%)' }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              {drawerContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
