import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { useApi } from '@/hooks/useApi';
import { apiClient } from '@/services/api';
import { getMembers, promoteMember, demoteMember } from '@/services/members';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ROLES } from '@/utils/constants';
import type { Member } from '@/types';

export function ProductionSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { production, userRole } = useProduction();
  const { toast } = useToast();
  const isDirector = userRole === ROLES.DIRECTOR;

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [roleAction, setRoleAction] = useState<{ type: 'promote' | 'demote'; member: Member } | null>(null);

  const { data: members, refetch: refetchMembers } = useApi(
    () => (isDirector && id ? getMembers(id) : Promise.resolve([])),
    [id, isDirector],
  );

  const isArchived = production?.is_archived ?? false;

  const staffMembers = (members || []).filter(m => m.role === 'staff');
  const castMembers = (members || []).filter(m => m.role === 'cast');

  async function handleArchive() {
    if (!id) return;
    setBusy(true);
    try {
      await apiClient(`/productions/${id}/archive`, { method: 'POST' });
      toast('Production archived');
      setArchiveOpen(false);
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Failed to archive', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnarchive() {
    if (!id) return;
    setBusy(true);
    try {
      await apiClient(`/productions/${id}/unarchive`, { method: 'POST' });
      toast('Production unarchived');
      window.location.reload();
    } catch (err: any) {
      toast(err.message || 'Failed to unarchive', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setBusy(true);
    try {
      await apiClient(`/productions/${id}`, { method: 'DELETE' });
      toast('Production deleted');
      setDeleteOpen(false);
      navigate('/');
    } catch (err: any) {
      toast(err.message || 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange() {
    if (!roleAction || !id) return;
    setBusy(true);
    try {
      if (roleAction.type === 'promote') {
        await promoteMember(id, roleAction.member.user_id);
        toast(`${roleAction.member.name || 'Member'} promoted to staff`);
      } else {
        await demoteMember(id, roleAction.member.user_id);
        toast(`${roleAction.member.name || 'Member'} demoted to cast`);
      }
      setRoleAction(null);
      refetchMembers();
    } catch (err: any) {
      toast(err.message || 'Failed to change role', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Production Settings</h1>

      <section className="bg-surface-raised border border-border rounded-lg p-5 mb-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Name</dt>
            <dd className="text-foreground">{production?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">First Rehearsal</dt>
            <dd className="text-foreground">{production?.first_rehearsal ? formatDate(production.first_rehearsal) : '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Opening Night</dt>
            <dd className="text-foreground">{production?.opening_night ? formatDate(production.opening_night) : '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Closing Night</dt>
            <dd className="text-foreground">{production?.closing_night ? formatDate(production.closing_night) : '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Status</dt>
            <dd className="text-foreground">{isArchived ? 'Archived' : 'Active'}</dd>
          </div>
        </dl>
      </section>

      {/* Member Role Management — director only */}
      {isDirector && (
        <section className="bg-surface-raised border border-border rounded-lg p-5 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Member Roles</h2>
          <p className="text-xs text-muted">Promote cast to staff or demote staff back to cast.</p>

          <div className="max-h-[400px] overflow-y-auto pr-1 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          {/* Staff members */}
          {staffMembers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Staff</h3>
              <div className="space-y-2">
                {staffMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-md"
                    style={{ background: 'rgba(100,180,255,0.06)', border: '1px solid rgba(100,180,255,0.1)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ background: 'rgba(100,180,255,0.15)', color: 'hsl(210,60%,60%)' }}>
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-foreground">{m.name || m.email || 'Member'}</p>
                        <p className="text-[10px] text-muted">{m.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRoleAction({ type: 'demote', member: m })}
                      className="text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                      style={{ background: 'rgba(255,180,50,0.1)', color: 'hsl(38,70%,55%)', border: '1px solid rgba(255,180,50,0.15)' }}
                    >
                      Demote to Cast
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cast members */}
          {castMembers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Cast</h3>
              <div className="space-y-2">
                {castMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-foreground">{m.name || m.email || 'Member'}</p>
                        <p className="text-[10px] text-muted">{m.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRoleAction({ type: 'promote', member: m })}
                      className="text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                      style={{ background: 'rgba(100,180,255,0.1)', color: 'hsl(210,60%,60%)', border: '1px solid rgba(100,180,255,0.15)' }}
                    >
                      Promote to Staff
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!members || (staffMembers.length === 0 && castMembers.length === 0)) && (
            <p className="text-sm text-muted italic">No members to manage.</p>
          )}
          </div>
        </section>
      )}

      <section className="border border-destructive/30 rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>

        {isArchived ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">Unarchive Production</p>
              <p className="text-xs text-muted">Restore this production to active status.</p>
            </div>
            <Button variant="secondary" onClick={handleUnarchive} isLoading={busy}>Unarchive</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">Archive Production</p>
              <p className="text-xs text-muted">Archive hides the production from the dashboard.</p>
            </div>
            <Button variant="secondary" onClick={() => setArchiveOpen(true)}>Archive</Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground font-medium">Delete Production</p>
            <p className="text-xs text-muted">Permanently delete this production and all data.</p>
          </div>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </section>

      <Dialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive Production"
        confirmLabel="Archive"
        onConfirm={handleArchive}
        isLoading={busy}
      >
        <p>Are you sure you want to archive "{production?.name}"? It will be hidden from the dashboard.</p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Production"
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        isLoading={busy}
      >
        <p>This will permanently delete "{production?.name}" and all associated data. This action cannot be undone.</p>
      </Dialog>

      {/* Role change confirmation */}
      <Dialog
        open={!!roleAction}
        onClose={() => setRoleAction(null)}
        title={roleAction?.type === 'promote' ? 'Promote to Staff' : 'Demote to Cast'}
        confirmLabel={roleAction?.type === 'promote' ? 'Promote' : 'Demote'}
        confirmVariant={roleAction?.type === 'demote' ? 'destructive' : 'primary'}
        onConfirm={handleRoleChange}
        isLoading={busy}
      >
        <p>
          {roleAction?.type === 'promote'
            ? `Promote ${roleAction.member.name || 'this member'} to staff? They will gain access to staff-level features like schedule management and bulletin editing.`
            : `Demote ${roleAction?.member.name || 'this member'} back to cast? They will lose staff privileges.`}
        </p>
      </Dialog>
    </div>
  );
}
