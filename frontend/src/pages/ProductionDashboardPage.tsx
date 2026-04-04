import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule } from '@/services/schedule';
import { getPosts } from '@/services/bulletin';
import { getInvite } from '@/services/invite';
import { formatDate, formatTime, formatRelativeTime } from '@/utils/format';
import { ROLES } from '@/utils/constants';
import { StickyNote, ChalkText } from '@/components/theater/Chalkboard';
import type { RehearsalDate } from '@/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};
const fadeIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: spring },
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
  const inviteUrl = invite?.token ? `${window.location.origin}/join?token=${invite.token}` : null;

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

  // Days of the week for mini calendar — only this actual week
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const thisWeekDates = useMemo(() => {
    const set = new Set<string>();
    if (!dates) return set;
    const now = new Date();
    // Find Monday of this week
    const monday = new Date(now);
    const dow = now.getDay();
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    for (const d of dates) {
      if (d.is_deleted || d.is_cancelled) continue;
      const dt = new Date(d.date + 'T00:00:00');
      if (dt >= monday && dt <= sunday) {
        const dayIdx = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
        set.add(days[dayIdx]);
      }
    }
    return set;
  }, [dates]);

  return (
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* Board title — chalk text */}
        <motion.div variants={fadeIn} className="text-center mb-6">
          <ChalkText size="lg">{production?.name || 'Call Board'}</ChalkText>
          <div className="w-24 h-[1px] mx-auto mt-2 opacity-20" style={{ background: 'rgba(255,255,255,0.4)' }} />
        </motion.div>

        {/* Pinned items grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Schedule card — yellow sticky */}
          <motion.div variants={fadeIn} className="cursor-pointer" onClick={() => navigate(`/production/${id}/schedule`)}>
            <StickyNote color="yellow" rotate={-1.5}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">Rehearsal Schedule</p>
              {upcoming.length === 0 ? (
                <p className="text-xs italic opacity-50">No dates scheduled yet</p>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.slice(0, 4).map((d: RehearsalDate) => (
                    <div key={d.id} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono font-bold w-16">{formatDate(d.date)}</span>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                        background: d.type === 'regular' ? '#b8860b' : d.type === 'tech' ? '#4682b4' : d.type === 'dress' ? '#8b5cf6' : '#dc2626',
                      }} />
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

          {/* Stats card — white index card */}
          <motion.div variants={fadeIn}>
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

          {/* Announcements — pink sticky */}
          <motion.div variants={fadeIn} className="cursor-pointer" onClick={() => navigate(`/production/${id}/bulletin`)}>
            <StickyNote color="pink" rotate={1.2}>
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

          {/* Invite link — green sticky (director only) */}
          {isDirectorOrStaff && (
            <motion.div variants={fadeIn}>
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
          )}

          {/* Mini week view — blue sticky */}
          <motion.div variants={fadeIn} className="cursor-pointer" onClick={() => navigate(`/production/${id}/schedule`)}>
            <StickyNote color="blue" rotate={0.5}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">This Week</p>
              <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                  const hasEvent = thisWeekDates.has(day);
                  return (
                    <div key={day} className="text-center">
                      <p className="text-[8px] font-bold uppercase opacity-50">{day}</p>
                      <div className="w-5 h-5 mx-auto mt-0.5 rounded-full flex items-center justify-center text-[9px]"
                        style={{
                          background: hasEvent ? 'rgba(0,120,60,0.15)' : 'rgba(0,0,0,0.04)',
                          color: hasEvent ? '#2d6a4f' : 'rgba(0,0,0,0.2)',
                        }}
                      >
                        {hasEvent ? '\u2713' : '\u2014'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </StickyNote>
          </motion.div>

          {/* Quick nav — white card */}
          <motion.div variants={fadeIn}>
            <StickyNote color="white" rotate={-0.5}>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">Quick Actions</p>
              <div className="space-y-1.5">
                {[
                  { label: 'View Full Schedule', path: `${id}/schedule` },
                  { label: 'Bulletin Board', path: `${id}/bulletin` },
                  { label: 'Manage Members', path: `${id}/roster` },
                  { label: 'Open Chat', path: `${id}/chat` },
                ].map(action => (
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
        </div>

        {/* Chalk note at bottom */}
        <motion.div variants={fadeIn} className="text-center mt-8">
          <ChalkText size="sm">
            {isDirector ? 'Click any card to manage that section' : 'Check the board for updates'}
          </ChalkText>
        </motion.div>
      </motion.div>
  );
}
