import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/layout/ProductionLayout';
import { useToast } from '@/components/ui/Toast';
import { getMembers, promoteMember, demoteMember, removeMember, resetConflicts } from '@/services/members';
import { getInvite, regenerateInvite, createInvite } from '@/services/invite';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { ROLES } from '@/utils/constants';
import { formatRelativeTime } from '@/utils/format';
import type { Member } from '@/types';

const ROLE_BADGE: Record<string, 'default' | 'success' | 'warning'> = {
  director: 'warning', staff: 'success', cast: 'default',
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
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      toast('Invite link copied');
    }
  }, [inviteUrl, toast]);

  async function handleRegenerate() {
    if (!id) return;
    setBusy(true);
    try {
      await regenerateInvite(id);
      toast('Invite link regenerated');
      refetchInvite();
    } catch { toast('Failed to regenerate', 'error'); }
    finally { setBusy(false); }
  }

  async function handleCreateInvite() {
    if (!id) return;
    setBusy(true);
    try {
      await createInvite(id);
      toast('Invite created');
      refetchInvite();
    } catch { toast('Failed to create invite', 'error'); }
    finally { setBusy(false); }
  }

  async function handleConfirm() {
    if (!confirmAction || !id) return;
    const { type, member } = confirmAction;
    setBusy(true);
    try {
      if (type === 'promote') await promoteMember(id, member.user_id);
      else if (type === 'demote') await demoteMember(id, member.user_id);
      else if (type === 'remove') await removeMember(id, member.user_id);
      else if (type === 'reset') await resetConflicts(id, member.user_id);
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} successful`);
      setConfirmAction(null);
      refetch();
    } catch (err: any) {
      toast(err.message || `Failed to ${type}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  const dialogTitle: Record<string, string> = {
    promote: 'Promote Member', demote: 'Demote Member', remove: 'Remove Member', reset: 'Reset Conflicts',
  };
  const dialogDesc: Record<string, string> = {
    promote: 'Promote this member to staff?',
    demote: 'Demote this member to cast?',
    remove: 'Remove this member from the production? This cannot be undone.',
    reset: 'Reset conflict submissions for this member? They will need to resubmit.',
  };

  return (
    <div>
      {isDirector && (
        <div className="bg-surface-raised border border-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Invite Link</h2>
          {inviteUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-muted bg-surface px-2 py-1 rounded border border-border truncate">{inviteUrl}</code>
                <Button size="sm" onClick={copyInvite}>Copy</Button>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>Expires: {formatRelativeTime(invite!.expires_at)}</span>
                <span>Uses: {invite!.use_count}/{invite!.max_uses}</span>
              </div>
              <Button size="sm" variant="secondary" onClick={handleRegenerate} isLoading={busy}>Regenerate</Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleCreateInvite} isLoading={busy}>Create Invite Link</Button>
          )}
        </div>
      )}

      <h1 className="text-2xl font-bold text-foreground mb-6">Members</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-sm text-muted">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Conflicts</th>
              {isDirector && <th className="pb-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(members || []).map((m: Member) => (
              <tr key={m.id} className="border-b border-border">
                <td className="py-3 pr-4 text-foreground">{m.name || m.email || 'Unknown'}</td>
                <td className="py-3 pr-4">
                  <Badge variant={ROLE_BADGE[m.role] || 'default'}>{m.role}</Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge variant={m.conflicts_submitted ? 'success' : 'warning'}>
                    {m.conflicts_submitted ? 'Submitted' : 'Pending'}
                  </Badge>
                </td>
                {isDirector && m.role !== ROLES.DIRECTOR && (
                  <td className="py-3">
                    <div className="flex gap-1">
                      {m.role === ROLES.CAST && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'promote', member: m })}>Promote</Button>
                      )}
                      {m.role === ROLES.STAFF && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'demote', member: m })}>Demote</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'remove', member: m })}>Remove</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmAction({ type: 'reset', member: m })}>Reset</Button>
                    </div>
                  </td>
                )}
                {isDirector && m.role === ROLES.DIRECTOR && <td className="py-3" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
