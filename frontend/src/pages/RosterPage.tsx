import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getMembers, promoteMember, demoteMember, removeMember, resetConflicts } from '@/services/members';
import { getInvite, regenerateInvite, createInvite } from '@/services/invite';
import { Dialog } from '@/components/ui/Dialog';
import { StickyNote, ChalkText } from '@/components/theater/Chalkboard';
import { ROLES } from '@/utils/constants';
import { formatRelativeTime } from '@/utils/format';
import type { Member } from '@/types';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } } };
const fadeIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: spring } };

const roleColors: Record<string, { bg: string; text: string; label: string }> = {
  director: { bg: 'rgba(255,180,50,0.15)', text: 'hsl(38,70%,55%)', label: 'Director' },
  staff:    { bg: 'rgba(100,180,255,0.12)', text: 'hsl(210,60%,60%)', label: 'Staff' },
  cast:     { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', label: 'Cast' },
};

export function RosterPage() {
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const { toast } = useToast();
  const isDirector = userRole === ROLES.DIRECTOR;

  const { data: members, isLoading, refetch } = useApi(() => getMembers(id!), [id]);
  const { data: invite, refetch: refetchInvite } = useApi(() => getInvite(id!).catch(() => null), [id]);

  const [confirmAction, setConfirmAction] = useState<{ type: string; member: Member } | null>(null);
  const [busy, setBusy] = useState(false);

  const inviteUrl = invite?.token ? `${window.location.origin}/join?token=${invite.token}` : null;

  const copyInvite = useCallback(() => {
    if (inviteUrl) { navigator.clipboard.writeText(inviteUrl); toast('Invite link copied'); }
  }, [inviteUrl, toast]);

  async function handleRegenerate() {
    if (!id) return; setBusy(true);
    try { await regenerateInvite(id); toast('Link regenerated'); refetchInvite(); }
    catch { toast('Failed', 'error'); } finally { setBusy(false); }
  }

  async function handleCreateInvite() {
    if (!id) return; setBusy(true);
    try { await createInvite(id); toast('Invite created'); refetchInvite(); }
    catch { toast('Failed', 'error'); } finally { setBusy(false); }
  }

  async function handleConfirm() {
    if (!confirmAction || !id) return;
    const { type, member } = confirmAction; setBusy(true);
    try {
      if (type === 'promote') await promoteMember(id, member.user_id);
      else if (type === 'demote') await demoteMember(id, member.user_id);
      else if (type === 'remove') await removeMember(id, member.user_id);
      else if (type === 'reset') await resetConflicts(id, member.user_id);
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} done`);
      setConfirmAction(null); refetch();
    } catch (err: any) { toast(err.message || `Failed`, 'error'); }
    finally { setBusy(false); }
  }

  const dialogTitle: Record<string, string> = { promote: 'Promote', demote: 'Demote', remove: 'Remove', reset: 'Reset Conflicts' };
  const dialogDesc: Record<string, string> = {
    promote: 'Promote to staff?', demote: 'Demote to cast?',
    remove: 'Remove from production? Cannot be undone.', reset: 'Reset conflicts? They must resubmit.',
  };

  const directors = (members || []).filter(m => m.role === 'director');
  const staff = (members || []).filter(m => m.role === 'staff');
  const cast = (members || []).filter(m => m.role === 'cast');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <ChalkText size="lg">Company Roster</ChalkText>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>
          {(members || []).length} members
        </span>
      </div>

      {/* Invite link section */}
      {isDirector && (
        <div className="mb-6">
          <StickyNote color="green" rotate={-0.5}>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-2 opacity-60">Cast Invite</p>
            {inviteUrl ? (
              <div>
                <p className="text-[10px] font-mono break-all leading-relaxed opacity-60 mb-2">{inviteUrl}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={copyInvite} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded cursor-pointer" style={{ background: 'rgba(0,0,0,0.08)' }}>Copy</button>
                  <button onClick={handleRegenerate} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded cursor-pointer opacity-60" disabled={busy}>Regen</button>
                  <span className="text-[9px] opacity-40">
                    {invite!.use_count}/{invite!.max_uses} used · expires {formatRelativeTime(invite!.expires_at)}
                  </span>
                </div>
              </div>
            ) : (
              <button onClick={handleCreateInvite} disabled={busy}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.08)' }}>
                {busy ? 'Creating...' : 'Generate Invite Link'}
              </button>
            )}
          </StickyNote>
        </div>
      )}

      {/* Members by role group */}
      {[
        { label: 'Direction', list: directors },
        { label: 'Staff', list: staff },
        { label: 'Cast', list: cast },
      ].filter(g => g.list.length > 0).map(group => (
        <div key={group.label} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ChalkText size="sm">{group.label}</ChalkText>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>({group.list.length})</span>
          </div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            variants={stagger} initial="hidden" animate="show"
          >
            {group.list.map((m: Member) => {
              const rc = roleColors[m.role] || roleColors.cast;
              return (
                <motion.div key={m.id} variants={fadeIn}
                  className="rounded-sm px-4 py-3 flex items-center gap-3"
                  style={{ background: rc.bg, border: `1px solid ${rc.bg}` }}
                >
                  {/* Avatar circle */}
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                    style={{ background: 'rgba(0,0,0,0.15)', color: rc.text }}>
                    {(m.name || m.email || '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{m.name || m.email || 'Member'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] capitalize" style={{ color: rc.text }}>{rc.label}</span>
                      {m.role === 'cast' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-sm" style={{
                          background: m.conflicts_submitted ? 'rgba(80,200,80,0.1)' : 'rgba(255,180,50,0.1)',
                          color: m.conflicts_submitted ? 'rgba(100,220,100,0.8)' : 'rgba(255,200,80,0.8)',
                        }}>
                          {m.conflicts_submitted ? 'Conflicts in' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Director actions */}
                  {isDirector && m.role !== ROLES.DIRECTOR && (
                    <div className="flex gap-1 flex-shrink-0">
                      {m.role === ROLES.CAST && (
                        <button onClick={() => setConfirmAction({ type: 'promote', member: m })}
                          className="text-[9px] px-1.5 py-1 rounded cursor-pointer" style={{ color: 'rgba(100,180,255,0.7)' }}>Up</button>
                      )}
                      {m.role === ROLES.STAFF && (
                        <button onClick={() => setConfirmAction({ type: 'demote', member: m })}
                          className="text-[9px] px-1.5 py-1 rounded cursor-pointer" style={{ color: 'rgba(255,200,80,0.7)' }}>Down</button>
                      )}
                      <button onClick={() => setConfirmAction({ type: 'remove', member: m })}
                        className="text-[9px] px-1.5 py-1 rounded cursor-pointer" style={{ color: 'rgba(255,120,120,0.6)' }}>x</button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      ))}

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}
        </div>
      )}

      <Dialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction ? dialogTitle[confirmAction.type] : ''}
        confirmLabel="Confirm"
        confirmVariant={confirmAction?.type === 'remove' ? 'destructive' : 'primary'}
        onConfirm={handleConfirm}
        isLoading={busy}
      >
        <p>{confirmAction ? `${dialogDesc[confirmAction.type]} (${confirmAction.member.name || confirmAction.member.email})` : ''}</p>
      </Dialog>
    </div>
  );
}
