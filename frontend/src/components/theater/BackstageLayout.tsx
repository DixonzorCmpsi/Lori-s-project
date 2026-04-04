import { useState, useEffect, Component, useMemo } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Joyride } from 'react-joyride';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { apiClient } from '@/services/api';
import { getMemberDetails, type MemberDetails } from '@/services/castAssignments';
import { formatTime, formatDate } from '@/utils/format';
import { useNotifications } from '@/hooks/useNotifications';
import { TheaterLayout } from './TheaterLayout';
import { Chalkboard, ChalkText } from './Chalkboard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTour, triggerPageTour } from '@/hooks/useTour';
import { directorTourSteps, staffTourSteps, castTourSteps } from '@/tours/productionTour';
import { theaterTourStyles, theaterTourLocale, theaterTourOptions } from '@/tours/tourStyles';
import type { Production, Member } from '@/types';
import { createContext, useContext } from 'react';

// ── Error boundary — catches page crashes so the theater stays intact ──

class PageErrorBoundary extends Component<
  { children: ReactNode; location: string },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crash caught by error boundary:', error, info);
  }

  componentDidUpdate(prevProps: { location: string }) {
    if (prevProps.location !== this.props.location && this.state.hasError) {
      this.setState({ hasError: false, error: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <ChalkText size="lg">Something went wrong</ChalkText>
          <p className="mt-3" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
            {this.state.error}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="mt-4 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
            style={{ background: 'rgba(255,220,100,0.1)', color: 'rgba(255,220,100,0.8)', border: '1px solid rgba(255,220,100,0.15)' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

// ── Production context ──────────────────────────────────────────────

interface ProductionContextType {
  production: Production | null;
  members: Member[];
  userRole: string | null;
  refetch: () => void;
}

const ProductionContext = createContext<ProductionContextType>({
  production: null, members: [], userRole: null, refetch: () => {},
});

export function useProduction() {
  return useContext(ProductionContext);
}

// ── Flight-case panel style ─────────────────────────────────────────

const flightCaseBase = {
  background: `linear-gradient(180deg,
    hsl(220, 6%, 11%) 0%,
    hsl(220, 5%, 8%) 50%,
    hsl(220, 4%, 6%) 100%)`,
  backdropFilter: 'blur(16px)',
};

// ── Main layout ─────────────────────────────────────────────────────

export function BackstageLayout() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isDesktop = bp === 'desktop';
  const { unreadMessages, permission, requestPermission } = useNotifications(id);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'staff' | 'cast'>('cast');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetails, setMemberDetails] = useState<MemberDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!selectedMemberId || !id) { setMemberDetails(null); return; }
    setLoadingDetails(true);
    getMemberDetails(id, selectedMemberId)
      .then(setMemberDetails)
      .catch(() => setMemberDetails(null))
      .finally(() => setLoadingDetails(false));
  }, [selectedMemberId, id]);

  const noop = () => Promise.resolve(null as any);
  const { data: production, refetch } = useApi<Production>(
    id ? () => apiClient(`/productions/${id}`) : noop, [id],
  );
  const { data: members } = useApi<Member[]>(
    id ? () => apiClient(`/productions/${id}/members`) : noop, [id],
  );

  const currentUser = members?.find(m => m.user_id === user?.id);
  const userRole = currentUser?.role || null;
  const isDirectorOrStaff = userRole === 'director' || userRole === 'staff';
  const basePath = id ? `/production/${id}` : '';

  // Tour system — different flows per role
  const tourSteps = useMemo(() => {
    if (!id) return [];
    if (userRole === 'director') return directorTourSteps;
    if (userRole === 'staff') return staffTourSteps;
    return castTourSteps;
  }, [id, userRole]);
  const tourId = id && userRole ? `production-${userRole}` : '';
  const { run: tourRun, handleEvent: tourEvent, startTour } = useTour(tourId, tourSteps, !!id);

  // Navigation config
  const directorNav = [
    { icon: '◈', label: 'Dashboard', path: basePath || '/', tourId: 'nav-dashboard' },
    { icon: '◷', label: 'Schedule', path: `${basePath}/schedule`, tourId: 'nav-schedule' },
    { icon: '◻', label: 'Bulletin', path: `${basePath}/bulletin`, tourId: 'nav-bulletin' },
    { icon: '◉', label: 'Members', path: `${basePath}/roster`, tourId: 'nav-members' },
    { icon: '◆', label: 'Chat', path: `${basePath}/chat`, tourId: 'nav-chat' },
    { icon: '◎', label: 'Settings', path: `${basePath}/settings`, tourId: 'nav-settings' },
  ];
  const castNav = [
    { icon: '◻', label: 'Bulletin', path: `${basePath}/bulletin`, tourId: 'nav-bulletin' },
    { icon: '◷', label: 'Schedule', path: `${basePath}/schedule`, tourId: 'nav-schedule' },
    { icon: '◆', label: 'Chat', path: `${basePath}/chat`, tourId: 'nav-chat' },
  ];
  const navItems = isDirectorOrStaff ? directorNav : (id ? castNav : [
    { icon: '◈', label: 'Dashboard', path: '/', tourId: 'nav-dashboard' },
  ]);

  function isActive(path: string) {
    return location.pathname === path ||
      (path !== '/' && path !== basePath && location.pathname.startsWith(path));
  }

  // ── Left Panel — Flight Case Nav ──────────────────────────────────

  const leftPanel = (
    <div
      className="h-full flex flex-col pt-14 pb-4 px-3 overflow-y-auto relative"
      style={{ ...flightCaseBase, borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Grip tape texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg,
            transparent, transparent 2px,
            rgba(255,255,255,0.12) 2px, rgba(255,255,255,0.12) 3px,
            transparent 3px, transparent 6px)`,
        }}
      />

      {/* Recessed wing shadow — stage depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset -8px 0 20px rgba(0,0,0,0.35), inset 0 8px 16px rgba(0,0,0,0.2)',
        }}
      />

      {/* Corner rivets */}
      <Rivet className="absolute top-3 left-3" />
      <Rivet className="absolute top-3 right-3" />
      <Rivet className="absolute bottom-3 left-3" />
      <Rivet className="absolute bottom-3 right-3" />

      {/* Production name plate */}
      {production && (
        <motion.div
          className="mb-6 px-2 relative z-10"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring, delay: 0.2 }}
        >
          <p
            className="text-[9px] uppercase tracking-[0.25em] mb-1"
            style={{ color: 'hsl(43, 45%, 42%)' }}
          >
            Production
          </p>
          <h3
            className="text-sm font-semibold truncate"
            style={{ fontFamily: '"Playfair Display", serif', color: 'hsl(35, 20%, 85%)' }}
          >
            {production.name}
          </h3>
        </motion.div>
      )}

      {/* Nav buttons with spotlight glow on active */}
      <nav className="flex flex-col gap-0.5 flex-1 relative z-10">
        {navItems.map((item, i) => {
          const active = isActive(item.path);
          return (
            <motion.button
              key={item.path}
              data-tour={item.tourId}
              onClick={() => navigate(item.path)}
              className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer group"
              style={{
                background: active
                  ? 'radial-gradient(ellipse at 15% 50%, rgba(212,175,55,0.14) 0%, rgba(255,180,80,0.04) 70%, transparent 100%)'
                  : 'transparent',
                color: active ? 'hsl(43, 74%, 58%)' : 'hsl(25, 8%, 48%)',
                boxShadow: active ? '0 0 20px rgba(212,175,55,0.06), inset 0 0 12px rgba(212,175,55,0.04)' : 'none',
              }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.3 + i * 0.05 }}
              whileHover={{ x: 2, background: 'rgba(255,180,80,0.06)' }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Spotlight glow behind active item */}
              {active && (
                <motion.div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at 10% 50%, rgba(212,175,55,0.08) 0%, transparent 70%)',
                  }}
                  layoutId="nav-glow"
                  transition={spring}
                />
              )}
              <span className="text-xs opacity-60">{item.icon}</span>
              <span className="text-xs font-medium tracking-wide">{item.label}</span>
              {item.label === 'Chat' && unreadMessages > 0 && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'hsl(0,70%,50%)', color: 'white', minWidth: '18px', textAlign: 'center' }}>
                  {unreadMessages}
                </span>
              )}
              {/* Gold indicator bar */}
              {active && (
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full"
                  style={{ background: 'hsl(43, 74%, 49%)' }}
                  layoutId="nav-indicator"
                  transition={spring}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="mt-auto pt-3 border-t relative z-10" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {/* Drawer toggle for tablet — show Cast & Crew drawer */}
        {!isDesktop && id && (
          <motion.button
            onClick={() => setDrawerOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors mb-1"
            style={{ color: 'hsl(43, 55%, 52%)' }}
            whileHover={{ background: 'rgba(255,180,80,0.06)' }}
          >
            <span className="text-xs opacity-60">◉</span>
            <span className="font-medium">Cast & Crew</span>
          </motion.button>
        )}
        {!id && (
          <motion.button
            onClick={() => navigate('/production/new')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
            style={{ color: 'hsl(43, 60%, 52%)' }}
            whileHover={{ background: 'rgba(255,180,80,0.06)' }}
          >
            <span>+</span>
            <span className="font-medium">New Production</span>
          </motion.button>
        )}
        <motion.button
          onClick={() => navigate('/account')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
          style={{ color: 'hsl(25, 8%, 44%)' }}
          whileHover={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <span className="text-xs opacity-60">◇</span>
          <span className="truncate">{user?.name || 'Account'}</span>
        </motion.button>
        {id && (
          <motion.button
            onClick={triggerPageTour}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
            style={{ color: 'hsl(43, 50%, 45%)' }}
            whileHover={{ background: 'rgba(255,180,80,0.06)' }}
          >
            <span className="text-xs opacity-60">?</span>
            <span className="font-medium">Take Tour</span>
          </motion.button>
        )}
        <motion.button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
          style={{ color: 'hsl(0, 40%, 52%)' }}
          whileHover={{ background: 'rgba(220,50,50,0.06)' }}
        >
          <span className="text-xs opacity-60">⏻</span>
          <span>Sign Out</span>
        </motion.button>
      </div>
    </div>
  );

  // ── Right Panel — Cast & Crew (desktop column / tablet+mobile drawer) ──

  const castPanel = (
    <div
      data-tour="cast-panel"
      className="h-full flex flex-col pt-14 pb-4 px-3 overflow-y-auto relative"
      style={{
        ...flightCaseBase,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Grip tape texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(-45deg,
            transparent, transparent 2px,
            rgba(255,255,255,0.12) 2px, rgba(255,255,255,0.12) 3px,
            transparent 3px, transparent 6px)`,
        }}
      />

      {/* Recessed wing shadow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 8px 0 20px rgba(0,0,0,0.35), inset 0 8px 16px rgba(0,0,0,0.2)',
        }}
      />

      {/* Corner rivets */}
      <Rivet className="absolute top-3 left-3" />
      <Rivet className="absolute top-3 right-3" />

      {/* Section header with on-air indicator */}
      <motion.div
        className="mb-3 px-2 flex items-center gap-2 relative z-10"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...spring, delay: 0.3 }}
      >
        <p
          className="text-[9px] uppercase tracking-[0.25em]"
          style={{ color: 'hsl(43, 45%, 42%)' }}
        >
          {id ? 'Cast & Crew' : 'Quick Actions'}
        </p>
        {/* On-Air indicator — glows red when director is present */}
        {id && isDirectorOrStaff && (
          <OnAirLight />
        )}
        {/* Drawer close button (non-desktop) */}
        {!isDesktop && (
          <button
            onClick={() => setDrawerOpen(false)}
            className="ml-auto text-sm cursor-pointer"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            ✕
          </button>
        )}
      </motion.div>

      {/* Tabs: Cast / Staff — always visible when in a production */}
      {id && (
        <div className="flex gap-0 mb-3 mx-2 relative z-10 rounded-md overflow-hidden flex-shrink-0"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['cast', 'staff'] as const).map(tab => {
            const isActive = panelTab === tab;
            const count = (members || []).filter(m => tab === 'staff' ? (m.role === 'director' || m.role === 'staff') : m.role === 'cast').length;
            return (
              <button
                key={tab}
                onClick={() => { setPanelTab(tab); setSelectedMemberId(null); }}
                className="flex-1 py-1.5 text-[9px] uppercase tracking-[0.2em] cursor-pointer transition-colors"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: isActive ? 'hsl(43,60%,58%)' : 'hsl(25,8%,42%)',
                  borderRight: tab === 'cast' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Member list or detail view */}
      {id && members && selectedMemberId ? (
        /* ── Member Detail View ── */
        <div className="relative z-10 px-2">
          <button
            onClick={() => setSelectedMemberId(null)}
            className="text-[9px] uppercase tracking-widest mb-3 cursor-pointer flex items-center gap-1"
            style={{ color: 'hsl(43,50%,50%)' }}
          >
            &larr; Back
          </button>
          {loadingDetails ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : memberDetails ? (
            <div className="space-y-3">
              {/* Name + role */}
              <div>
                <p className="text-sm font-semibold" style={{ color: 'hsl(35,15%,80%)' }}>
                  {memberDetails.display_name || memberDetails.name || 'Member'}
                </p>
                <p className="text-[10px] capitalize" style={{ color: 'hsl(43,50%,50%)' }}>
                  {memberDetails.role}
                  {memberDetails.character && ` — ${memberDetails.character}`}
                </p>
              </div>

              {/* Contact */}
              {memberDetails.email && (
                <p className="text-[10px] truncate" style={{ color: 'hsl(25,8%,45%)' }}>
                  {memberDetails.email}
                </p>
              )}

              {/* Conflicts */}
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'hsl(25,8%,40%)' }}>
                  Conflicts {memberDetails.conflicts_submitted ? `(${memberDetails.conflicts.length})` : '— not submitted'}
                </p>
                {memberDetails.conflicts.length > 0 ? (
                  <div className="max-h-[100px] overflow-y-auto space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
                    {memberDetails.conflicts.map((c, i) => (
                      <div key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,80,80,0.06)', color: 'hsl(0,50%,60%)' }}>
                        {c.date ? formatDate(c.date) : 'Unknown'}{c.reason ? ` — ${c.reason}` : ''}
                      </div>
                    ))}
                  </div>
                ) : memberDetails.conflicts_submitted ? (
                  <p className="text-[10px] italic" style={{ color: 'hsl(25,8%,35%)' }}>No conflicts</p>
                ) : null}
              </div>

              {/* Assigned dates */}
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'hsl(25,8%,40%)' }}>
                  Assigned Dates ({memberDetails.assigned_dates.length})
                </p>
                {memberDetails.assigned_dates.length > 0 ? (
                  <div className="max-h-[140px] overflow-y-auto space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
                    {memberDetails.assigned_dates.map(d => (
                      <div key={d.id} className="text-[10px] px-1.5 py-0.5 rounded flex justify-between"
                        style={{ background: 'rgba(255,220,100,0.05)', color: 'hsl(35,15%,65%)' }}>
                        <span>{formatDate(d.date)}</span>
                        <span style={{ color: 'hsl(25,8%,45%)' }}>{formatTime(d.start_time)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] italic" style={{ color: 'hsl(25,8%,35%)' }}>No dates assigned yet</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[10px] italic" style={{ color: 'hsl(25,8%,35%)' }}>Could not load details</p>
          )}
        </div>
      ) : id && members ? (
        /* ── Member List (filtered by tab) ── */
        <div className="flex flex-col gap-0.5 relative z-10">
          {members
            .filter(m => panelTab === 'staff' ? (m.role === 'director' || m.role === 'staff') : m.role === 'cast')
            .map((member, i) => (
            <motion.div
              key={member.id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg group cursor-pointer"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.4 + i * 0.03 }}
              whileHover={{ background: 'rgba(255,255,255,0.03)' }}
              onClick={() => setSelectedMemberId(member.user_id)}
            >
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background:
                    member.role === 'director'
                      ? 'linear-gradient(135deg, hsl(43,60%,35%), hsl(43,50%,25%))'
                      : member.role === 'staff'
                      ? 'linear-gradient(135deg, hsl(200,40%,30%), hsl(200,35%,22%))'
                      : 'linear-gradient(135deg, hsl(25,20%,20%), hsl(25,15%,15%))',
                  color:
                    member.role === 'director' ? 'hsl(43,70%,70%)' : 'hsl(25,10%,60%)',
                }}
              >
                {(member.name || member.user_id).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: 'hsl(35,15%,75%)' }}>
                  {member.name || 'Member'}
                </p>
                <p
                  className="text-[10px] capitalize"
                  style={{
                    color:
                      member.role === 'director'
                        ? 'hsl(43,60%,52%)'
                        : member.role === 'staff'
                        ? 'hsl(200,40%,52%)'
                        : 'hsl(25,8%,42%)',
                  }}
                >
                  {member.role}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : !id ? (
        <div className="flex flex-col gap-2 px-2 relative z-10">
          {['Add Theater', 'New Production'].map((action, i) => (
            <motion.button
              key={action}
              className="text-xs text-left px-3 py-2 rounded-lg cursor-pointer"
              style={{ color: 'hsl(25,8%,48%)' }}
              whileHover={{ background: 'rgba(255,180,80,0.06)', color: 'hsl(43,60%,58%)' }}
              onClick={() => navigate(i === 0 ? '/theater/new' : '/production/new')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              {action}
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="px-2 relative z-10">
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-6 w-5/6" />
        </div>
      )}
    </div>
  );

  // ── Top Bar — Stage Manager's strip ───────────────────────────────

  const topBar = (
    <div
      className="flex items-center justify-between px-5 py-2.5 relative"
      style={{
        background: 'rgba(10, 8, 8, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(212,175,55,0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center gap-3">
        <h2
          className="text-xs font-medium tracking-wide"
          style={{ color: 'hsl(43, 55%, 52%)', fontFamily: '"Playfair Display", serif' }}
        >
          Digital Call Board
        </h2>
        {permission === 'default' && id && (
          <button
            onClick={requestPermission}
            className="text-[9px] uppercase tracking-wider px-2 py-1 rounded cursor-pointer"
            style={{ color: 'hsl(38,70%,55%)', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.12)' }}
          >
            <span className="hidden sm:inline">Enable Notifications</span>
            <span className="sm:hidden">🔔</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Tablet/mobile drawer toggle */}
        {!isDesktop && id && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-[10px] uppercase tracking-widest cursor-pointer px-2 py-1 rounded"
            style={{ color: 'hsl(43,50%,48%)', background: 'rgba(212,175,55,0.06)' }}
          >
            Cast
          </button>
        )}
        <p
          className="hidden sm:block text-[10px] tracking-widest uppercase truncate max-w-[160px]"
          style={{ color: 'hsl(25, 8%, 36%)' }}
        >
          {production?.name || 'Backstage'}
        </p>
      </div>
    </div>
  );

  // ── Mobile Bottom Nav ─────────────────────────────────────────────

  const mobileBottomNav = (
    <div
      className="flex items-stretch"
      style={{
        background: 'linear-gradient(180deg, hsl(220,6%,10%) 0%, hsl(220,5%,7%) 100%)',
        borderTop: '1px solid rgba(212,175,55,0.08)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.slice(0, 5).map((item) => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer relative"
            style={{
              color: active ? 'hsl(43,74%,55%)' : 'hsl(25,8%,40%)',
            }}
          >
            {/* Spotlight glow above active tab */}
            {active && (
              <motion.div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full"
                style={{ background: 'hsl(43,74%,49%)' }}
                layoutId="mobile-nav-indicator"
                transition={spring}
              />
            )}
            <span className="text-sm">{item.icon}</span>
            <span className="text-[9px] tracking-wider uppercase font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <ProductionContext.Provider value={{ production, members: members || [], userRole, refetch }}>
      {id && tourSteps.length > 0 && (
        <Joyride
          steps={tourSteps}
          run={tourRun}
          onEvent={tourEvent}
          continuous
          scrollToFirstStep
          styles={theaterTourStyles}
          locale={theaterTourLocale}
          options={theaterTourOptions}
        />
      )}
      <TheaterLayout
        curtainsOpen={true}
        leftPanel={leftPanel}
        rightPanel={isDesktop ? castPanel : undefined}
        topBar={topBar}
        mobileNav={isMobile ? mobileBottomNav : undefined}
        drawerOpen={drawerOpen}
        drawerContent={castPanel}
        onDrawerClose={() => setDrawerOpen(false)}
      >
        {/* Center stage — chalkboard nailed to the stage */}
        <div
          className="w-full h-full pt-16 px-2 pb-2 overflow-y-auto"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <Chalkboard className="w-full" style={{ minHeight: 'calc(100% - 1rem)' }}>
            <div className="p-4 sm:p-6">
              <PageErrorBoundary location={location.pathname}>
                <Outlet />
              </PageErrorBoundary>
            </div>
          </Chalkboard>
        </div>
      </TheaterLayout>
    </ProductionContext.Provider>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────

/** Flight case rivet */
function Rivet({ className = '' }: { className?: string }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full z-10 ${className}`}>
      <div
        className="w-full h-full rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 35%, hsl(220,5%,30%), hsl(220,4%,16%))',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}

/** On-Air / Backstage indicator light */
function OnAirLight() {
  return (
    <motion.div
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{
        background: 'rgba(220, 40, 40, 0.08)',
        border: '1px solid rgba(220, 40, 40, 0.15)',
      }}
    >
      <motion.div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: 'hsl(0, 70%, 50%)' }}
        animate={{
          boxShadow: [
            '0 0 3px rgba(220,40,40,0.4)',
            '0 0 8px rgba(220,40,40,0.7)',
            '0 0 3px rgba(220,40,40,0.4)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span style={{ color: 'hsl(0, 55%, 55%)', fontSize: '8px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
        Backstage
      </span>
    </motion.div>
  );
}
