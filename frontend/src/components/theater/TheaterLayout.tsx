import { ReactNode, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Curtain } from './Curtain';
import { StageFloor } from './StageFloor';
import { Spotlight } from './Spotlight';
import { Pelmet } from './Pelmet';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const DEFAULT_PANEL_PX = 240;
const SNAP_CLOSE_PX = 80;   // below this, snap shut
const MIN_OPEN_PX = 140;    // smallest usable open width
const MAX_PANEL_PX = 400;
const spring = { type: 'spring' as const, stiffness: 80, damping: 18 };

interface TheaterLayoutProps {
  curtainsOpen: boolean;
  leftPanel?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  topBar?: ReactNode;
  mobileNav?: ReactNode;
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

  const [leftW, setLeftW] = useState(DEFAULT_PANEL_PX);
  const [rightW, setRightW] = useState(DEFAULT_PANEL_PX);
  const dragging = useRef<'left' | 'right' | null>(null);

  const onMouseDown = useCallback((side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = side;
    const startX = e.clientX;
    const startW = side === 'left' ? leftW : rightW;

    const onMove = (ev: MouseEvent) => {
      const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      const raw = startW + delta;
      // Snap closed if dragged below threshold, otherwise clamp to usable range
      const next = raw < SNAP_CLOSE_PX ? 0 : Math.min(MAX_PANEL_PX, Math.max(MIN_OPEN_PX, raw));
      if (side === 'left') setLeftW(next);
      else setRightW(next);
    };
    const onUp = () => {
      dragging.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [leftW, rightW]);

  return (
    <div
      className="relative w-screen min-h-[100dvh] overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 30%,
          hsl(350, 10%, 8%) 0%,
          hsl(350, 7%, 5%) 40%,
          hsl(240, 6%, 3%) 100%)`,
      }}
    >
      <Spotlight />
      <StageFloor />

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
              left: isMobile ? '0' : `${leftW}px`,
              right: isMobile ? '0' : (isDesktop ? `${rightW}px` : '0'),
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

      {/* 3-column layout */}
      <div className="relative z-[35] flex h-[100dvh]">
        {/* Left panel */}
        {!isMobile && (
          <div className="flex-shrink-0 relative overflow-hidden" style={{ width: `${leftW}px`, transition: dragging.current ? 'none' : 'width 0.2s ease' }}>
            {leftW > 0 && (
              <AnimatePresence>
                {curtainsOpen && leftPanel && (
                  <motion.div
                    className="h-full"
                    style={{ minWidth: `${MIN_OPEN_PX}px` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ ...spring, delay: 1.4 }}
                  >
                    {leftPanel}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            {/* Drag handle — right edge */}
            <div
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-10 hover:bg-[rgba(212,175,55,0.2)] transition-colors"
              onMouseDown={onMouseDown('left')}
            />
          </div>
        )}

        {/* Center stage */}
        <div className="flex-1 flex items-center justify-center relative">
          {children}
        </div>

        {/* Right panel — desktop only */}
        {isDesktop && (
          <div className="flex-shrink-0 relative overflow-hidden" style={{ width: `${rightW}px`, transition: dragging.current ? 'none' : 'width 0.2s ease' }}>
            {/* Drag handle — left edge */}
            <div
              className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize z-10 hover:bg-[rgba(212,175,55,0.2)] transition-colors"
              onMouseDown={onMouseDown('right')}
            />
            {rightW > 0 && (
              <AnimatePresence>
                {curtainsOpen && rightPanel && (
                  <motion.div
                    className="h-full"
                    style={{ minWidth: `${MIN_OPEN_PX}px` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ ...spring, delay: 1.4 }}
                  >
                    {rightPanel}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && mobileNav && (
        <div className="fixed bottom-0 left-0 right-0 z-[60]">{mobileNav}</div>
      )}

      {/* Slide-over drawer */}
      <AnimatePresence>
        {drawerOpen && drawerContent && (
          <>
            <motion.div
              className="fixed inset-0 z-[70]"
              style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onDrawerClose}
            />
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
