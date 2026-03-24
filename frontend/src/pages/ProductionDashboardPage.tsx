import { useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/layout/ProductionLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule } from '@/services/schedule';
import { getPosts } from '@/services/bulletin';
import { getInvite } from '@/services/invite';
import { formatDate, formatTime, formatRelativeTime } from '@/utils/format';
import { SCHEDULE_COLORS, ROLES } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { RehearsalDate } from '@/types';

export function ProductionDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { production, members, userRole } = useProduction();
  const { toast } = useToast();

  const { data: dates, isLoading: datesLoading } = useApi(() => getSchedule(id!), [id]);
  const { data: posts, isLoading: postsLoading } = useApi(() => getPosts(id!), [id]);
  const { data: invite } = useApi(() => getInvite(id!).catch(() => null), [id]);

  const isDirector = userRole === ROLES.DIRECTOR;
  const inviteUrl = invite?.token ? `${window.location.origin}/join?token=${invite.token}` : null;

  const copyInvite = useCallback(() => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      toast('Invite link copied');
    }
  }, [inviteUrl, toast]);

  const upcoming = useMemo(() => {
    if (!dates) return [];
    const today = new Date().toISOString().split('T')[0];
    return dates
      .filter((d: RehearsalDate) => !d.is_deleted && !d.is_cancelled && d.date >= today)
      .sort((a: RehearsalDate, b: RehearsalDate) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [dates]);

  const nextRehearsal = upcoming[0] || null;
  const recentPosts = useMemo(() => (posts || []).slice(0, 3), [posts]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{production?.name || 'Dashboard'}</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface-raised border border-border rounded-lg p-4">
          <p className="text-sm text-muted mb-1">Members</p>
          <p className="text-2xl font-bold text-foreground">{members.length}</p>
        </div>
        <div className="bg-surface-raised border border-border rounded-lg p-4">
          <p className="text-sm text-muted mb-1">Next Rehearsal</p>
          {datesLoading ? (
            <Skeleton className="h-7 w-32" />
          ) : nextRehearsal ? (
            <p className="text-lg font-bold text-foreground">
              {formatDate(nextRehearsal.date)}
            </p>
          ) : (
            <p className="text-lg text-muted">None scheduled</p>
          )}
        </div>
      </div>

      {/* Invite Link */}
      {isDirector && inviteUrl && (
        <div className="bg-surface-raised border border-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Invite Link</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-muted bg-surface px-2 py-1 rounded border border-border truncate">
              {inviteUrl}
            </code>
            <Button size="sm" onClick={copyInvite}>Copy</Button>
          </div>
        </div>
      )}

      {/* Upcoming Schedule */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Upcoming Schedule</h2>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/production/${id}/schedule`)}>
            View All
          </Button>
        </div>
        {datesLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : upcoming.length === 0 ? (
          <p className="text-muted text-sm">No upcoming dates.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((d: RehearsalDate) => {
              const color = SCHEDULE_COLORS[d.type];
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-md bg-surface border border-border">
                  <span className="font-medium text-foreground min-w-[90px]">{formatDate(d.date)}</span>
                  <span className="text-muted text-sm">{formatTime(d.start_time)} - {formatTime(d.end_time)}</span>
                  <Badge className={`${color.bg} ${color.text}`}>{color.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Bulletin Posts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Recent Announcements</h2>
          <Button size="sm" variant="ghost" onClick={() => navigate(`/production/${id}/bulletin`)}>
            View All
          </Button>
        </div>
        {postsLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : recentPosts.length === 0 ? (
          <p className="text-muted text-sm">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {recentPosts.map(post => (
              <div key={post.id} className="p-3 rounded-md bg-surface border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-foreground">{post.title}</h3>
                  {post.is_pinned && <Badge variant="warning">Pinned</Badge>}
                </div>
                <p className="text-sm text-muted line-clamp-2">{post.body}</p>
                <p className="text-xs text-muted mt-1">{formatRelativeTime(post.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
