import { useState, useEffect, Component, useMemo } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Joyride } from 'react-joyride';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/contexts/ThemeContext';
import { apiClient } from '@/services/api';
import { getMemberDetails, type MemberDetails } from '@/services/castAssignments';
import { getMyTeam } from '@/services/teams';
import { formatTime, formatDate } from '@/utils/format';
import { AvatarDisplay } from '@/components/ui/AvatarPicker';
import { useNotifications } from '@/hooks/useNotifications';
import { TheaterLayout } from './TheaterLayout';
import { Chalkboard, ChalkText } from './Chalkboard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTour, triggerPageTour } from '@/hooks/useTour';
import { directorTourSteps, staffTourSteps, castTourSteps } from '@/tours/productionTour';
import { getTheaterTourStyles, theaterTourLocale, theaterTourOptions } from '@/tours/tourStyles';
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
  production: null, members: [], userRole: null, refetch: () => { },
});

export function useProduction() {
  return useContext(ProductionContext);
}

// ── Flight-case panel style ─────────────────────────────────────────

const flightCaseBase = {
  background: 'var(--t-panel-bg)',
  backdropFilter: 'blur(16px)',
};

// ── Main layout ─────────────────────────────────────────────────────

export function BackstageLayout() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, theme } = useTheme();
  const tourStyles = useMemo(() => getTheaterTourStyles(), [theme]);
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isDesktop = bp === 'desktop';
  const { unreadMessages, permission, requestPermission } = useNotifications(id);

  // Auto-prompt for notification permission on first production entry
  useEffect(() => {
    if (id && permission === 'default' && 'Notification' in window) {
      const key = 'dcb-notif-prompted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        const timer = setTimeout(() => requestPermission(), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [id, permission, requestPermission]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [panelTab, setPanelTab] = useState<'cast' | 'staff' | 'team'>('cast');
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
  const isCast = userRole === 'cast';
  const isDirectorOrStaff = userRole === 'director' || userRole === 'staff';
  const basePath = id ? `/production/${id}` : '';

  useEffect(() => {
    if (!id) return;
    try {
      const raw = window.localStorage.getItem('callboard.productionRecents');
      const recents = raw ? JSON.parse(raw) : {};
      recents[id] = Date.now();
      window.localStorage.setItem('callboard.productionRecents', JSON.stringify(recents));
      window.localStorage.setItem('callboard.lastProductionId', id);
    } catch {
      // ignore storage errors
    }
  }, [id]);

  // Fetch team data for cast users
  const { data: myTeamData } = useApi(
    id && isCast ? () => getMyTeam(id) : () => Promise.resolve(null),
    [id, isCast],
  );
  const teammateIds = useMemo(() => new Set(myTeamData?.teammate_user_ids || []), [myTeamData]);

  // Tour system — different flows per role
  const tourSteps = useMemo(() => {
    if (!id) return [];
    if (userRole === 'director') return directorTourSteps;
    if (userRole === 'staff') return staffTourSteps;
    return castTourSteps;
  }, [id, userRole]);
  const tourId = id && userRole ? `production-${userRole}` : '';
  const { run: tourRun, handleEvent: tourEvent } = useTour(tourId, tourSteps, !!id);

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
    { icon: '◈', label: 'Dashboard', path: basePath || '/', tourId: 'nav-dashboard' },
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
      style={{ ...flightCaseBase, borderRight: `1px solid var(--t-panel-border)` }}
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
            style={{ color: 'var(--t-production-label)' }}
          >
            Production
          </p>
          <h3
            className="text-sm font-semibold truncate"
            style={{ fontFamily: '"Playfair Display", serif', color: 'var(--t-production-name)' }}
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
                background: active ? 'var(--t-nav-active-bg)' : 'transparent',
                color: active ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)',
                boxShadow: active ? '0 0 20px rgba(212,175,55,0.06), inset 0 0 12px rgba(212,175,55,0.04)' : 'none',
              }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.3 + i * 0.05 }}
              whileHover={{ x: 2, background: 'var(--t-nav-hover)' }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Spotlight glow behind active item */}
              {active && (
                <motion.div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    background: 'var(--t-nav-glow)',
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
                  style={{ background: 'var(--t-nav-indicator)' }}
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
        {/* Back to productions list */}
        {id && (
          <motion.button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer mb-1"
            style={{ color: 'hsl(43, 55%, 52%)' }}
            whileHover={{ background: 'rgba(255,180,80,0.06)' }}
          >
            <span className="text-xs opacity-60">&larr;</span>
            <span className="font-medium">Productions</span>
          </motion.button>
        )}
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
        {!id && (() => {
          const isOnDashboard = location.pathname === '/';
          const label = isOnDashboard ? 'New Production' : 'See Productions';
          const icon = isOnDashboard ? '+' : '←';
          const target = isOnDashboard ? '/production/new' : '/';
          return (
            <motion.button
              onClick={() => navigate(target)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
              style={{ color: 'hsl(43, 60%, 52%)' }}
              whileHover={{ background: 'rgba(255,180,80,0.06)' }}
            >
              <span>{icon}</span>
              <span className="font-medium">{label}</span>
            </motion.button>
          );
        })()}
        <motion.button
          onClick={() => navigate(id ? `/production/${id}/account` : '/account')}
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
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
          style={{ color: 'var(--t-nav-inactive-text)' }}
          whileHover={{ background: 'var(--t-nav-hover)' }}
        >
          <span className="text-xs opacity-60">{isDark ? '☀' : '☽'}</span>
          <span className="font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </motion.button>
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
        borderLeft: `1px solid var(--t-panel-border)`,
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

      {/* Tabs — scrollable horizontally */}
      {id && (() => {
        const tabs: { key: typeof panelTab; label: string; count: number }[] = [];
        tabs.push({ key: 'cast', label: 'Cast', count: (members || []).filter(m => m.role === 'cast').length });
        if (isCast && myTeamData && myTeamData.teams.length > 0) {
          tabs.push({ key: 'team', label: 'Team', count: teammateIds.size });
        }
        tabs.push({ key: 'staff', label: 'Staff', count: (members || []).filter(m => m.role === 'director' || m.role === 'staff').length });
        return (
          <div className="mb-3 mx-2 relative z-10 rounded-md overflow-hidden flex-shrink-0"
            style={{ border: `1px solid var(--t-tab-border)` }}>
            <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {tabs.map((tab, i) => {
                const isActive = panelTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setPanelTab(tab.key); setSelectedMemberId(null); }}
                    className="flex-1 min-w-0 py-1.5 text-[9px] uppercase tracking-[0.2em] cursor-pointer transition-colors whitespace-nowrap"
                    style={{
                      background: isActive ? 'var(--t-tab-active-bg)' : 'transparent',
                      color: isActive ? 'var(--t-tab-active-text)' : 'var(--t-tab-inactive-text)',
                      borderRight: i < tabs.length - 1 ? `1px solid var(--t-tab-border)` : 'none',
                    }}
                  >
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

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

              {/* Contact info */}
              {memberDetails.email && (
                <p className="text-[10px] truncate" style={{ color: 'hsl(25,8%,45%)' }}>
                  {memberDetails.email}
                </p>
              )}

              {/* Message button */}
              {memberDetails.user_id !== user?.id && (
                <button
                  onClick={() => {
                    setSelectedMemberId(null);
                    navigate(`/production/${id}/chat`);
                    // Small delay then trigger new message to this person
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('open-chat-to', { detail: { id: memberDetails.user_id, name: memberDetails.display_name || memberDetails.name || 'Member', role: memberDetails.role } }));
                    }, 300);
                  }}
                  className="w-full text-[10px] uppercase tracking-widest font-bold py-1.5 rounded cursor-pointer"
                  style={{ background: 'rgba(212,175,55,0.12)', color: 'hsl(43,60%,55%)', border: '1px solid rgba(212,175,55,0.15)' }}
                >
                  Message
                </button>
              )}

              {!memberDetails.profile_complete && (
                <span className="text-[9px] px-1.5 py-0.5 rounded inline-block"
                  style={{ background: 'rgba(255,80,80,0.1)', color: 'rgba(255,120,120,0.8)' }}>
                  Incomplete profile
                </span>
              )}

              {/* Emergency Contacts */}
              {memberDetails.emergency_contacts && memberDetails.emergency_contacts.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'hsl(25,8%,40%)' }}>
                    Emergency Contacts
                  </p>
                  <div className="space-y-1.5">
                    {memberDetails.emergency_contacts.map((ec, i) => (
                      <div key={i} className="text-[10px] px-1.5 py-1 rounded"
                        style={{ background: 'rgba(255,220,100,0.04)', border: '1px solid rgba(255,220,100,0.08)' }}>
                        <div className="flex items-center gap-1.5">
                          <span style={{ color: 'hsl(35,15%,65%)' }}>{ec.name}</span>
                          <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'hsl(25,8%,50%)' }}>
                            {ec.relationship}
                          </span>
                        </div>
                        {ec.phone && <p style={{ color: 'hsl(25,8%,45%)' }}>{ec.phone}</p>}
                        {ec.email && <p className="truncate" style={{ color: 'hsl(25,8%,45%)' }}>{ec.email}</p>}
                      </div>
                    ))}
                  </div>
                </div>
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
            .filter(m => {
              if (panelTab === 'staff') return m.role === 'director' || m.role === 'staff';
              if (panelTab === 'team') return teammateIds.has(m.user_id);
              return m.role === 'cast';
            })
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
                <AvatarDisplay avatarId={member.avatar_url} name={member.name || member.user_id} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: 'var(--t-member-name)' }}>
                    {member.name || 'Member'}
                  </p>
                  <p
                    className="text-[10px] capitalize"
                    style={{
                      color:
                        member.role === 'director'
                          ? 'var(--t-member-role-director)'
                          : member.role === 'staff'
                            ? 'var(--t-member-role-staff)'
                            : 'var(--t-member-role-cast)',
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
        background: 'var(--t-topbar-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid var(--t-topbar-border)`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div className="flex items-center gap-3">
        <h2
          className="text-xs font-medium tracking-wide"
          style={{ color: 'var(--t-topbar-text)', fontFamily: '"Playfair Display", serif' }}
        >
          Digital Call Board
        </h2>
        {permission === 'default' && id && (
          <button
            onClick={requestPermission}
            className="text-[9px] uppercase tracking-wider px-2.5 py-1 rounded cursor-pointer font-bold bg-accent/15 text-accent border border-accent/25"
          >
            <span className="hidden sm:inline">Enable Notifications</span>
            <span className="sm:hidden">🔔</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Focus mode toggle — tablet + desktop, inside production */}
        {!isMobile && id && (
          <button
            onClick={() => setFocusMode(f => !f)}
            className="text-[10px] uppercase tracking-widest cursor-pointer px-3 py-1 rounded font-semibold flex items-center gap-1.5"
            style={{
              color: focusMode ? 'var(--color-accent)' : 'var(--t-topbar-subtitle)',
              background: focusMode ? 'rgba(212,175,55,0.1)' : 'rgba(0,0,0,0.03)',
              border: focusMode ? '1px solid rgba(212,175,55,0.15)' : '1px solid rgba(0,0,0,0.06)',
            }}
            title={focusMode ? 'Exit focus mode' : 'Focus mode — expand the board'}
          >
            <span style={{ fontSize: '12px' }}>{focusMode ? '⊟' : '⊞'}</span>
            <span className="hidden lg:inline">{focusMode ? 'Exit Focus' : 'Focus'}</span>
          </button>
        )}
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
          style={{ color: 'var(--t-topbar-subtitle)' }}
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
        background: 'var(--t-mobile-nav-bg)',
        borderTop: `1px solid var(--t-topbar-border)`,
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
              color: active ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)',
            }}
          >
            {/* Spotlight glow above active tab */}
            {active && (
              <motion.div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full"
                style={{ background: 'var(--t-nav-indicator)' }}
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
      {id && tourSteps.length > 0 && tourRun && (
        <Joyride
          steps={tourSteps}
          run={tourRun}
          onEvent={tourEvent}
          continuous
          scrollToFirstStep={false}
          styles={tourStyles as any}
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
        focusMode={focusMode}
      >
        {/* Center stage — chalkboard nailed to the stage */}
        <div
          className={`w-full h-full pt-[78px] sm:pt-[88px] px-1 sm:px-2 overflow-y-auto ${isMobile ? 'pb-20' : 'pb-2'}`}
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
