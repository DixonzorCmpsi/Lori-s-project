import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule } from '@/services/schedule';
import { getPosts } from '@/services/bulletin';
import { getInvite } from '@/services/invite';
import { getConflictStatus } from '@/services/conflicts';
import { apiClient } from '@/services/api';
import { formatDate, formatTime, formatRelativeTime } from '@/utils/format';
import { ROLES } from '@/utils/constants';
import { StickyNote, ChalkText } from '@/components/theater/Chalkboard';
import type { RehearsalDate, ConflictStatus } from '@/types';
import { PageTour } from '@/tours/PageTour';
import { dashboardTourSteps } from '@/tours/pageTours';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};
const fadeIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: spring },
};

const typeLabels: Record<string, string> = {
  regular: 'Rehearsal',
  tech: 'Tech',
  dress: 'Dress',
  performance: 'Show',
  blocked: 'Off',
};
const typeDots: Record<string, string> = {
  regular: '#b8860b',
  tech: '#4682b4',
  dress: '#8b5cf6',
  performance: '#dc2626',
  blocked: '#888',
};

export function ProductionDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { production, members, userRole } = useProduction();
  const { toast } = useToast();

  const { data: dates } = useApi(() => getSchedule(id!), [id]);
  const { data: posts } = useApi(() => getPosts(id!), [id]);
  const { data: invite } = useApi(() => getInvite(id!).catch(() => null), [id]);

  const isDirector = userRole === ROLES.DIRECTOR;
  const isDirectorOrStaff = isDirector || userRole === ROLES.STAFF;
  const isCast = userRole === 'cast';

  const { data: conflictStatus } = useApi<ConflictStatus>(
    () => isCast ? getConflictStatus(id!) : Promise.resolve(null as any), [id, isCast],
  );
  const inviteUrl = invite?.token ? `${window.location.origin}/join?token=${invite.token}` : null;

  // Production expiry detection
  const isExpired = production?.closing_night ? new Date(production.closing_night + 'T23:59:59') < new Date() : false;
  const [extendDate, setExtendDate] = useState('');
  const [extending, setExtending] = useState(false);

  async function handleExtend() {
    if (!id || !extendDate) return;
    setExtending(true);
    try {
      await apiClient(`/productions/${id}`, { method: 'PATCH', body: JSON.stringify({ closing_night: extendDate }) });
      toast('Production extended');
      setExtendDate('');
      window.location.reload();
    } catch (err: any) {
      toast(err.message || 'Failed to extend', 'error');
    } finally {
      setExtending(false);
    }
  }

  async function handleArchiveNow() {
    if (!id) return;
    try {
      await apiClient(`/productions/${id}/archive`, { method: 'POST' });
      toast('Production archived');
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Failed', 'error');
    }
  }

  const copyInvite = useCallback(() => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      toast('Invite link copied!');
    }
  }, [inviteUrl, toast]);

  const upcoming = useMemo(() => {
    if (!Array.isArray(dates)) return [];
    const today = new Date().toISOString().split('T')[0];
    return dates
      .filter((d: RehearsalDate) => !d.is_deleted && !d.is_cancelled && d.date >= today)
      .sort((a: RehearsalDate, b: RehearsalDate) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 6);
  }, [dates]);

  const recentPosts = useMemo(() => (posts || []).slice(0, 3), [posts]);
  const castMembers = members.filter(m => m.role === 'cast');
  const conflictsIn = castMembers.filter(m => m.conflicts_submitted).length;

  // This week's schedule — actual events per day
  const thisWeekEvents = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    // Find Monday of this week
    const monday = new Date(now);
    const dow = now.getDay();
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);

    const week: { day: string; date: string; isToday: boolean; event: RehearsalDate | null }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = dateStr === now.toISOString().split('T')[0];
      const dayName = days[d.getDay()];
      const dayNum = d.getDate();
      const label = `${dayName} ${dayNum}`;

      // Find matching event
      let event: RehearsalDate | null = null;
      if (dates) {
        event = dates.find((e: RehearsalDate) =>
          e.date === dateStr && !e.is_deleted && !e.is_cancelled
        ) || null;
      }
      week.push({ day: label, date: dateStr, isToday, event });
    }
    return week;
  }, [dates]);

  // Quick action items — filtered by role
  const quickActions = useMemo(() => {
    const actions = [
      { label: 'View Full Schedule', path: `${id}/schedule` },
      { label: 'Bulletin Board', path: `${id}/bulletin` },
    ];
    if (isDirectorOrStaff) {
      actions.push({ label: 'Manage Members', path: `${id}/roster` });
    }
    actions.push({ label: 'Open Chat', path: `${id}/chat` });
    if (isCast) {
      actions.push({ label: 'Submit Conflicts', path: `${id}/conflicts` });
    }
    return actions;
  }, [id, isDirectorOrStaff, isCast]);

  // ── Cards ──

  const scheduleCard = (
    <motion.div data-tour="dashboard-schedule-card" variants={fadeIn} className="cursor-pointer" onClick={() => navigate(`/production/${id}/schedule`)}>
      <StickyNote color="yellow" rotate={-1.5}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">Rehearsal Schedule</p>
        {upcoming.length === 0 ? (
          <p className="text-xs italic opacity-50">No dates scheduled yet</p>
        ) : (
          <div className="space-y-1.5">
            {upcoming.slice(0, 4).map((d: RehearsalDate) => (
              <div key={d.id} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono font-bold w-16">{formatDate(d.date)}</span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: typeDots[d.type] || '#b8860b' }} />
                <span className="font-mono text-[10px] opacity-70">{formatTime(d.start_time)}</span>
              </div>
            ))}
            {upcoming.length > 4 && (
              <p className="text-[10px] opacity-50 italic">+{upcoming.length - 4} more...</p>
            )}
          </div>
        )}
      </StickyNote>
    </motion.div>
  );

  const announcementsCard = (
    <motion.div data-tour="dashboard-announcements-card" variants={fadeIn} className="cursor-pointer" onClick={() => navigate(`/production/${id}/bulletin`)}>
      <StickyNote color="pink" rotate={isCast ? -0.8 : 1.2}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">Announcements</p>
        {recentPosts.length === 0 ? (
          <p className="text-xs italic opacity-50">Nothing posted yet</p>
        ) : (
          <div className="space-y-2">
            {recentPosts.map(post => (
              <div key={post.id}>
                <p className="text-[11px] font-semibold leading-tight">{post.title}</p>
                <p className="text-[10px] opacity-50">{formatRelativeTime(post.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </StickyNote>
    </motion.div>
  );

  const weekCard = (
    <motion.div data-tour="dashboard-week-card" variants={fadeIn} className="cursor-pointer" onClick={() => navigate(`/production/${id}/schedule`)}>
      <StickyNote color="blue" rotate={isCast ? 0 : 0.5}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">This Week</p>
        <div className="space-y-1">
          {thisWeekEvents.map(({ day, isToday, event }) => (
            <div
              key={day}
              className="flex items-center gap-2 py-0.5 rounded-sm px-1"
              style={{
                background: isToday ? 'rgba(0,0,0,0.06)' : 'transparent',
              }}
            >
              <span className="text-[10px] font-bold w-12 flex-shrink-0" style={{ opacity: isToday ? 1 : 0.6 }}>
                {day}
              </span>
              {event ? (
                <>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: typeDots[event.type] || '#b8860b' }}
                  />
                  <span className="text-[10px] font-semibold" style={{ opacity: 0.8 }}>
                    {typeLabels[event.type] || event.type}
                  </span>
                  <span className="text-[9px] font-mono ml-auto" style={{ opacity: 0.5 }}>
                    {formatTime(event.start_time)}
                  </span>
                </>
              ) : (
                <span className="text-[10px] italic" style={{ opacity: 0.3 }}>No call</span>
              )}
            </div>
          ))}
        </div>
      </StickyNote>
    </motion.div>
  );

  const quickActionsCard = (
    <motion.div data-tour="dashboard-quickactions-card" variants={fadeIn}>
      <StickyNote color="white" rotate={isCast ? 0.8 : -0.5}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">Quick Actions</p>
        <div className="space-y-1.5">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => navigate(`/production/${action.path}`)}
              className="block w-full text-left text-[11px] px-2 py-1 rounded cursor-pointer transition-colors hover:bg-black/[0.04]"
            >
              {action.label}
            </button>
          ))}
        </div>
      </StickyNote>
    </motion.div>
  );

  const statusCard = (
    <motion.div data-tour="dashboard-status-card" variants={fadeIn}>
      <StickyNote color="white" rotate={0.8}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">Production Status</p>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px]">Cast Joined</span>
            <span className="font-mono text-sm font-bold">{castMembers.length}{production?.estimated_cast_size ? `/${production.estimated_cast_size}` : ''}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px]">Conflicts In</span>
            <span className="font-mono text-sm font-bold">{conflictsIn}/{castMembers.length}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px]">Next Call</span>
            <span className="font-mono text-xs font-bold">{upcoming[0] ? formatDate(upcoming[0].date) : 'TBD'}</span>
          </div>
          {production?.opening_night && (
            <div className="flex justify-between items-baseline pt-1 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <span className="text-[11px]">Opening Night</span>
              <span className="font-mono text-xs font-bold">{formatDate(production.opening_night)}</span>
            </div>
          )}
        </div>
      </StickyNote>
    </motion.div>
  );

  const inviteCard = (
    <motion.div data-tour="dashboard-invite-card" variants={fadeIn}>
      <StickyNote color="green" rotate={-0.8}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">Cast Invite</p>
        {inviteUrl ? (
          <div>
            <p className="text-[10px] font-mono break-all leading-relaxed opacity-70 mb-2">
              {inviteUrl.replace(`${window.location.origin}/`, '')}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); copyInvite(); }}
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.08)' }}
            >
              Copy Link
            </button>
          </div>
        ) : (
          <p className="text-xs italic opacity-50">No invite generated</p>
        )}
      </StickyNote>
    </motion.div>
  );

  // Cast-specific: "My Info" card replacing the status card
  const myInfoCard = (
    <motion.div data-tour="dashboard-status-card" variants={fadeIn}>
      <StickyNote color="white" rotate={0.8}>
        <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">My Info</p>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px]">Next Call</span>
            <span className="font-mono text-xs font-bold">{upcoming[0] ? formatDate(upcoming[0].date) : 'TBD'}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[11px]">Upcoming Calls</span>
            <span className="font-mono text-sm font-bold">{upcoming.length}</span>
          </div>
          {conflictStatus && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px]">Conflict Windows</span>
              <span className="font-mono text-xs font-bold">
                {conflictStatus.remaining_windows} / {conflictStatus.total_windows}
              </span>
            </div>
          )}
          {production?.opening_night && (
            <div className="flex justify-between items-baseline pt-1 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <span className="text-[11px]">Opening Night</span>
              <span className="font-mono text-xs font-bold">{formatDate(production.opening_night)}</span>
            </div>
          )}
          {(() => {
            const remaining = conflictStatus?.remaining_windows ?? 0;
            const hasSubmitted = conflictStatus?.has_initial_submission ?? false;
            const disabled = hasSubmitted && remaining === 0;
            return (
              <button
                onClick={() => !disabled && navigate(`/production/${id}/conflicts`)}
                className="w-full text-[10px] uppercase tracking-widest font-bold mt-2 px-3 py-1.5 rounded cursor-pointer flex items-center justify-center gap-2"
                style={{
                  background: disabled ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.06)',
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? 'default' : 'pointer',
                }}
              >
                {!hasSubmitted ? 'Submit Conflicts' : remaining > 0 ? 'Submit New Conflicts' : 'Conflicts Submitted'}
                {hasSubmitted && remaining > 0 && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(220,60,60,0.12)', color: 'rgba(220,80,80,0.9)' }}>
                    {remaining}
                  </span>
                )}
              </button>
            );
          })()}
        </div>
      </StickyNote>
    </motion.div>
  );

  return (
    <>
      <PageTour tourId="page-dashboard" steps={dashboardTourSteps} />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Board title */}
        <motion.div variants={fadeIn} className="text-center mb-6">
          <ChalkText size="lg">{production?.name || 'Call Board'}</ChalkText>
          <div className="w-24 h-[1px] mx-auto mt-2 opacity-20" style={{ background: 'rgba(255,255,255,0.4)' }} />
        </motion.div>

        {/* Production expired banner — director only */}
        {isExpired && isDirector && (
          <motion.div variants={fadeIn} className="mb-6 rounded-sm p-4"
            style={{ background: 'rgba(255,180,50,0.08)', border: '1px solid rgba(255,180,50,0.2)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,220,100,0.9)' }}>
              Production has ended
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--t-subtle-text-bright)' }}>
              The closing night has passed. Would you like to extend the production or archive it?
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--t-subtle-text)' }}>New closing:</label>
                <input
                  type="date"
                  value={extendDate}
                  onChange={e => setExtendDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-2 py-1 rounded-sm text-xs outline-none"
                  style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)', color: 'var(--t-subtle-text-bright)' }}
                />
                <button
                  onClick={handleExtend}
                  disabled={extending || !extendDate}
                  className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-sm cursor-pointer"
                  style={{
                    background: extendDate ? 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)' : 'var(--t-subtle-bg)',
                    color: extendDate ? 'hsl(220, 6%, 9%)' : 'var(--t-subtle-text)',
                    opacity: extending ? 0.5 : 1,
                  }}
                >
                  {extending ? '...' : 'Extend'}
                </button>
              </div>
              <button
                onClick={handleArchiveNow}
                className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-sm cursor-pointer"
                style={{ color: 'rgba(255,150,150,0.7)', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.12)' }}
              >
                Archive Production
              </button>
            </div>
          </motion.div>
        )}

        {/* Production expired notice — cast/staff */}
        {isExpired && !isDirector && (
          <motion.div variants={fadeIn} className="mb-6 rounded-sm p-4"
            style={{ background: 'rgba(255,180,50,0.06)', border: '1px solid rgba(255,180,50,0.12)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,220,100,0.7)' }}>
              This production's closing night has passed. Your director will decide whether to extend or archive it.
            </p>
          </motion.div>
        )}

        {isCast ? (
          /* ── Cast layout: clean 2x2 grid ── */
          <div data-tour="dashboard-cards" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {weekCard}
            {myInfoCard}
            {announcementsCard}
            {scheduleCard}
          </div>
        ) : (
          /* ── Director / Staff layout: 3-column grid ── */
          <div data-tour="dashboard-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scheduleCard}
            {statusCard}
            {announcementsCard}
            {isDirectorOrStaff && inviteCard}
            {weekCard}
            {quickActionsCard}
          </div>
        )}

        {/* Chalk note at bottom */}
        <motion.div variants={fadeIn} className="text-center mt-8">
          <ChalkText size="sm">
            {isDirector ? 'Click any card to manage that section' : 'Check the board for updates'}
          </ChalkText>
        </motion.div>
      </motion.div>
    </>
  );
}
