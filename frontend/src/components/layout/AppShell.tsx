import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AvatarDisplay } from '@/components/ui/AvatarPicker';
import { MoreSheet } from './MoreSheet';

export interface ShellNavItem {
  label: string;
  path: string;
  tourId: string;
  icon: string;
  /** Sidebar section heading (Default style). Items without one sit at the top. */
  group?: string;
}

interface AppShellProps {
  productionId?: string;
  productionName?: string;
  userName?: string;
  userAvatar?: string | null;
  userRole: string | null;
  navItems: ShellNavItem[];
  unreadMessages: number;
  isMobile: boolean;
  isDark: boolean;
  /** Calendar style: navigation runs across the top instead of down the side (desktop only). */
  calendar?: boolean;
  isActive: (path: string) => boolean;
  notificationsPending: boolean;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onTour: () => void;
  onEnableNotifications: () => void;
  onOpenPeople: () => void;
  children: ReactNode;
  /** Rendered once at the root (e.g. the Cast & crew slide-over). */
  overlay?: ReactNode;
}

const ICONS: Record<string, ReactNode> = {
  Dashboard: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  Schedule: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
  Bulletin: <path d="M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1zM17 8a5 5 0 010 8" />,
  Members: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" /></>,
  Chat: <path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.4A8 8 0 1121 12z" />,
  Settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  'Call Sheet': <><path d="M9 11l2 2 4-4" /><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 17h8" /></>,
  Scenes: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4" /></>,
  Reports: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 12h6M10 16h6" /></>,
  'Sign-ups': <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M18 8v6M15 11h6" /></>,
  Documents: <><path d="M4 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></>,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none"
    >
      {ICONS[name] ?? ICONS.Dashboard}
    </svg>
  );
}

function initials(name?: string) {
  if (!name) return 'P';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Breadcrumb trail derived from the route and nav labels. */
function useCrumbs(props: AppShellProps): string[] {
  const { pathname } = useLocation();
  const { productionId, productionName, navItems } = props;
  if (!productionId) {
    if (pathname.startsWith('/account')) return ['Productions', 'Account'];
    if (pathname.startsWith('/theater/new')) return ['Productions', 'New theater'];
    if (pathname.startsWith('/production/new')) return ['Productions', 'New production'];
    return ['Productions'];
  }
  const base = `/production/${productionId}`;
  const crumbs = ['Productions', productionName || 'Production'];
  const rest = pathname.slice(base.length).replace(/^\//, '');
  if (!rest) return [...crumbs, 'Dashboard'];
  const hit = navItems.find(n => n.path !== base && pathname.startsWith(n.path));
  if (hit) {
    crumbs.push(hit.label);
    if (hit.label === 'Chat' && rest.startsWith('chat/')) crumbs.push('Conversation');
    return crumbs;
  }
  const seg = rest.split('/')[0];
  const names: Record<string, string> = { account: 'Account', conflicts: 'Conflicts', profile: 'My profile', 'call-sheet': 'Call sheet', signups: 'Sign-ups', help: 'How it works' };
  crumbs.push(names[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1));
  return crumbs;
}

const footerBtn =
  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] cursor-pointer text-left hover:bg-[var(--t-nav-hover)]';

export function AppShell(props: AppShellProps) {
  const {
    productionId, productionName, userName, userAvatar, userRole, navItems, unreadMessages, isMobile, isDark, calendar,
    isActive, notificationsPending, onNavigate, onToggleTheme, onLogout, onTour, onEnableNotifications, onOpenPeople, children, overlay,
  } = props;
  const crumbs = useCrumbs(props);
  const [moreOpen, setMoreOpen] = useState(false);

  const sidebar = (
    <aside
      className="w-60 flex-none h-full flex flex-col gap-1 p-3 overflow-y-auto"
      style={{ background: 'var(--t-panel-bg)', borderRight: '1px solid var(--t-panel-border)' }}
      aria-label="Production navigation"
    >
      {productionId ? (
        <>
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer w-fit hover:bg-[var(--t-nav-hover)]"
            style={{ color: 'var(--t-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            All productions
          </button>
          <div
            className="flex items-center gap-2.5 p-2.5 mt-1 mb-3 rounded-xl"
            style={{ background: 'var(--t-surface-raised)', border: '1px solid var(--t-border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-none"
              style={{ background: 'var(--color-accent)', color: 'var(--t-background)' }}
            >
              {initials(productionName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--t-foreground)' }}>
                {productionName || 'Production'}
              </p>
              <p className="text-xs capitalize" style={{ color: 'var(--t-muted)' }} title={userRole === 'director' ? 'You can do everything in this production.' : userRole === 'staff' ? 'You run rehearsals. Only the director manages people and settings.' : 'You can see your calls, check in and sign up. Staff run the schedule.'}>{userRole || 'Member'}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="px-2 pt-1 pb-3 text-sm font-semibold" style={{ color: 'var(--t-foreground)' }}>
          Digital Call Board
        </p>
      )}

      <nav className="flex flex-col gap-0.5" aria-label="Primary">
        {navItems.map((item, i) => {
          const active = isActive(item.path);
          const heading = item.group && item.group !== navItems[i - 1]?.group ? item.group : null;
          return (
            <div key={item.path} className="contents">
              {heading && (
                <p className="px-2.5 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--t-production-label)' }}>
                  {heading}
                </p>
              )}
            <button
              data-tour={item.tourId}
              onClick={() => onNavigate(item.path)}
              aria-current={active ? 'page' : undefined}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium cursor-pointer text-left hover:bg-[var(--t-nav-hover)]"
              style={{
                background: active ? 'var(--t-nav-active-bg)' : undefined,
                color: active ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)',
              }}
            >
              <Icon name={item.label} />
              <span>{item.label}</span>
              {item.label === 'Chat' && unreadMessages > 0 && (
                <span
                  className="ml-auto text-[11px] font-semibold px-1.5 rounded-full leading-[18px] min-w-[18px] text-center"
                  style={{ background: 'var(--color-accent)', color: 'var(--t-background)' }}
                >
                  {unreadMessages}
                </span>
              )}
            </button>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-3 flex flex-col gap-0.5" style={{ borderTop: '1px solid var(--t-border)' }}>
        {!productionId && (
          <button onClick={() => onNavigate('/production/new')} className={footerBtn} style={{ color: 'var(--color-accent)' }}>
            <span className="w-[18px] text-center">+</span>New production
          </button>
        )}
        {productionId && (
          <button data-tour="nav-help" onClick={() => onNavigate(`/production/${productionId}/help`)} className={footerBtn} style={{ color: 'var(--t-nav-inactive-text)' }}>
            <span className="w-[18px] text-center">i</span>How it works
          </button>
        )}
        {productionId && (
          <button onClick={onTour} className={footerBtn} style={{ color: 'var(--t-nav-inactive-text)' }}>
            <span className="w-[18px] text-center">?</span>Take tour
          </button>
        )}
        <button onClick={onToggleTheme} className={footerBtn} style={{ color: 'var(--t-nav-inactive-text)' }}>
          <span className="w-[18px] text-center">{isDark ? '☀' : '☽'}</span>{isDark ? 'Light mode' : 'Dark mode'}
        </button>
        <button onClick={onLogout} className={footerBtn} style={{ color: 'var(--color-destructive)' }}>
          <span className="w-[18px] text-center">⏻</span>Sign out
        </button>
        <button
          onClick={() => onNavigate(productionId ? `/production/${productionId}/account` : '/account')}
          className="flex items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg cursor-pointer text-left hover:bg-[var(--t-nav-hover)]"
          aria-label="Account"
        >
          <AvatarDisplay avatarId={userAvatar ?? undefined} name={userName || 'Account'} size="sm" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--t-foreground)' }}>{userName || 'Account'}</span>
            <span className="block text-xs" style={{ color: 'var(--t-muted)' }}>Account settings</span>
          </span>
        </button>
      </div>
    </aside>
  );

  const topBar = (
    <header
      className="flex items-center gap-3 px-4 sm:px-6 min-h-14 flex-none"
      style={{ background: 'var(--t-topbar-bg)', borderBottom: '1px solid var(--t-topbar-border)' }}
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] min-w-0 flex-wrap" style={{ color: 'var(--t-muted)' }}>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const hideOnPhone = i < crumbs.length - 2;
          return (
            <span key={`${c}-${i}`} className={`${hideOnPhone ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 min-w-0`}>
              {i > 0 && <span className={i === crumbs.length - 2 ? 'sm:inline hidden' : ''} style={{ opacity: 0.5 }} aria-hidden="true">/</span>}
              {i === 0 ? (
                <button onClick={() => onNavigate('/')} className="cursor-pointer hover:underline">{c}</button>
              ) : (
                <span className="truncate" style={last ? { color: 'var(--t-foreground)', fontWeight: 600 } : undefined}>{c}</span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {productionId && (
          <button
            onClick={onOpenPeople}
            data-tour="cast-panel"
            aria-label="Cast and crew"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--t-nav-hover)]"
            style={{ border: '1px solid var(--t-border)', color: 'var(--t-foreground)' }}
          >
            <Icon name="Members" size={15} /><span className="hidden lg:inline whitespace-nowrap">Cast &amp; crew</span>
          </button>
        )}
        {notificationsPending && productionId && (
          <button
            onClick={onEnableNotifications}
            className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer"
            style={{ background: 'var(--t-tab-active-bg)', color: 'var(--t-tab-active-text)' }}
          >
            <span className="hidden lg:inline whitespace-nowrap">Enable notifications</span>
            <svg className="lg:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Enable notifications"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0" /></svg>
          </button>
        )}
        {isMobile && (
          <button
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center"
            style={{ border: '1px solid var(--t-border)', color: 'var(--t-nav-inactive-text)' }}
          >
            {isDark ? '☀' : '☽'}
          </button>
        )}
      </div>
    </header>
  );

  // ── Calendar style: navigation across the top ─────────────────────
  const groups: { name: string; items: ShellNavItem[] }[] = [];
  navItems.forEach(item => {
    const name = item.group ?? '';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(item);
    else groups.push({ name, items: [item] });
  });
  // Items with no group (Dashboard, or every item for cast) are single tabs.
  const tabs: { key: string; label: string; items: ShellNavItem[] }[] = [];
  groups.forEach(g => {
    if (!g.name) g.items.forEach(i => tabs.push({ key: i.path, label: i.label, items: [i] }));
    else tabs.push({ key: g.name, label: g.name, items: g.items });
  });
  const activeTab = tabs.find(t => t.items.some(i => isActive(i.path)));
  const subItems = activeTab && activeTab.items.length > 1 ? activeTab.items : null;
  const iconBtn = 'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--t-nav-hover)] whitespace-nowrap';
  const roleHint = userRole === 'director' ? 'You can do everything in this production.' : userRole === 'staff' ? 'You run rehearsals. Only the director manages people and settings.' : 'You can see your calls, check in and sign up. Staff run the schedule.';

  const calendarHeader = (
    <header style={{ background: 'var(--t-topbar-bg)', borderBottom: '1px solid var(--t-topbar-border)' }} className="flex-none">
      <div className="flex items-center gap-5 px-6 min-h-[60px]">
        <div className="flex items-center gap-2.5 min-w-0 flex-none">
          {productionId && (
            <button onClick={() => onNavigate('/')} aria-label="All productions" title="All productions" className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[var(--t-nav-hover)]" style={{ color: 'var(--t-muted)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          <span className="font-extrabold text-lg tracking-tight truncate max-w-[190px]" style={{ color: 'var(--t-foreground)' }} title={productionName}>
            {productionId ? (productionName || 'Production') : 'Digital Call Board'}
          </span>
        </div>
        <nav className="flex items-stretch gap-5 self-stretch min-w-0 flex-1" aria-label="Primary">
          {tabs.map(t => {
            const on = activeTab?.key === t.key;
            const single = t.items.length === 1;
            return (
              <button
                key={t.key}
                data-tour={single ? t.items[0].tourId : undefined}
                onClick={() => onNavigate(t.items[0].path)}
                aria-current={on ? 'page' : undefined}
                className="flex items-center gap-1.5 text-[15px] font-semibold cursor-pointer whitespace-nowrap border-b-[3px] -mb-px"
                style={{ color: on ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)', borderColor: on ? 'var(--t-nav-indicator)' : 'transparent' }}
              >
                {t.label}
                {single && t.items[0].label === 'Chat' && unreadMessages > 0 && (
                  <span className="text-[11px] font-semibold px-1.5 rounded-full leading-[18px]" style={{ background: 'var(--color-accent)', color: 'var(--t-background)' }}>{unreadMessages}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1 flex-none">
          {productionId && (
            <button onClick={onOpenPeople} data-tour="cast-panel" aria-label="Cast and crew" className={iconBtn} style={{ border: '1px solid var(--t-border)', color: 'var(--t-foreground)' }}>
              <Icon name="Members" size={15} />Cast &amp; crew
            </button>
          )}
          {notificationsPending && productionId && (
            <button onClick={onEnableNotifications} className={iconBtn} style={{ background: 'var(--t-tab-active-bg)', color: 'var(--t-tab-active-text)' }}>Enable notifications</button>
          )}
          {productionId && <button data-tour="nav-help" onClick={() => onNavigate(`/production/${productionId}/help`)} title="How it works" className={iconBtn} style={{ color: 'var(--t-nav-inactive-text)' }}>Help</button>}
          {productionId && <button onClick={onTour} title="Take the guided tour" className={iconBtn} style={{ color: 'var(--t-nav-inactive-text)' }}>Tour</button>}
          <button onClick={onToggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className={iconBtn} style={{ color: 'var(--t-nav-inactive-text)' }}>{isDark ? '☀' : '☽'}</button>
          <button onClick={() => onNavigate(productionId ? `/production/${productionId}/account` : '/account')} aria-label="Account" className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg cursor-pointer hover:bg-[var(--t-nav-hover)]">
            <span className="text-right leading-tight hidden xl:block">
              <span className="block text-[13px] font-semibold" style={{ color: 'var(--t-foreground)' }}>{userName || 'Account'}</span>
              <span className="block text-[11px] capitalize" style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-mono)' }} title={roleHint}>{userRole || 'Member'}</span>
            </span>
            <AvatarDisplay avatarId={userAvatar ?? undefined} name={userName || 'Account'} size="sm" />
          </button>
          <button onClick={onLogout} aria-label="Sign out" title="Sign out" className={iconBtn} style={{ color: 'var(--color-destructive)' }}>⏻</button>
        </div>
      </div>
      {subItems && (
        <div className="flex items-center gap-1 px-6 py-2 overflow-x-auto" style={{ borderTop: '1px solid var(--t-border)', background: 'var(--t-surface-raised)' }} aria-label={`${activeTab!.label} pages`}>
          <span className="text-[11px] uppercase tracking-[0.12em] mr-2" style={{ color: 'var(--t-muted)', fontFamily: 'var(--font-mono)' }}>{activeTab!.label}</span>
          {subItems.map(item => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                data-tour={item.tourId}
                onClick={() => onNavigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer whitespace-nowrap"
                style={{ background: active ? 'var(--t-nav-active-bg)' : 'transparent', color: active ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)' }}
              >
                <Icon name={item.label} size={15} />{item.label}
                {item.label === 'Chat' && unreadMessages > 0 && (
                  <span className="text-[11px] font-semibold px-1.5 rounded-full leading-[18px]" style={{ background: 'var(--color-accent)', color: 'var(--t-background)' }}>{unreadMessages}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );

  const mobileNav = (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex"
      style={{
        background: 'var(--t-mobile-nav-bg)', borderTop: '1px solid var(--t-border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Primary"
    >
      {navItems.slice(0, navItems.length > 5 ? 4 : 5).map(item => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            data-tour={item.tourId}
            onClick={() => onNavigate(item.path)}
            aria-current={active ? 'page' : undefined}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium cursor-pointer"
            style={{ color: active ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)' }}
          >
            <Icon name={item.label} size={20} />
            {item.label}
          </button>
        );
      })}
      <button
        onClick={() => setMoreOpen(true)}
        aria-haspopup="dialog"
        className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium cursor-pointer"
        style={{ color: navItems.slice(4).some(i => isActive(i.path)) ? 'var(--t-nav-active-text)' : 'var(--t-nav-inactive-text)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>
        More
      </button>
    </nav>
  );

  return (
    <div className="h-[100dvh] w-full flex" style={{ background: 'var(--t-background)', color: 'var(--t-foreground)' }}>
      {!isMobile && !calendar && sidebar}
      <div className="flex-1 min-w-0 flex flex-col">
        {calendar && !isMobile ? calendarHeader : topBar}
        <main data-app-panel className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isMobile ? 'pb-24' : ''}`}>
          <div className="app-page mx-auto w-full max-w-[1560px] min-h-full flex flex-col">{children}</div>
        </main>
      </div>
      {isMobile && mobileNav}
      {isMobile && (
        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          items={navItems}
          isActive={isActive}
          onNavigate={onNavigate}
          extra={[
            { label: 'Account settings', onClick: () => onNavigate(productionId ? `/production/${productionId}/account` : '/account') },
            { label: isDark ? 'Switch to light mode' : 'Switch to dark mode', onClick: onToggleTheme },
            ...(productionId ? [{ label: 'How it works', onClick: () => onNavigate(`/production/${productionId}/help`) }, { label: 'Take the tour', onClick: onTour }] : []),
            { label: 'Sign out', onClick: onLogout },
          ]}
        />
      )}
      {overlay}
    </div>
  );
}
