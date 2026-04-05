import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/services/api';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ChalkText } from '@/components/theater/Chalkboard';
import { ROLES } from '@/utils/constants';
import { PageTour } from '@/tours/PageTour';
import { settingsTourSteps } from '@/tours/pageTours';

export function ProductionSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { production, userRole, refetch: refetchProduction } = useProduction();
  const { toast } = useToast();
  const isDirector = userRole === ROLES.DIRECTOR;

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflictWindows, setConflictWindows] = useState<number | null>(null);
  const [savingWindows, setSavingWindows] = useState(false);

  const isArchived = production?.is_archived ?? false;

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

  return (
    <div>
      {isDirector && <PageTour tourId="page-settings" steps={settingsTourSteps} />}
      <ChalkText size="lg">Production Settings</ChalkText>
      <div className="h-4" />

      {/* Details */}
      <section
        className="rounded-sm p-5 mb-6 space-y-3"
        style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}
      >
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Details</p>
        <dl className="space-y-2 text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--t-subtle-text)' }}>Name</dt>
            <dd style={{ color: 'var(--t-subtle-text-bright)' }}>{production?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--t-subtle-text)' }}>First Rehearsal</dt>
            <dd style={{ color: 'var(--t-subtle-text-bright)' }}>{production?.first_rehearsal ? formatDate(production.first_rehearsal) : '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--t-subtle-text)' }}>Opening Night</dt>
            <dd style={{ color: 'var(--t-subtle-text-bright)' }}>{production?.opening_night ? formatDate(production.opening_night) : '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--t-subtle-text)' }}>Closing Night</dt>
            <dd style={{ color: 'var(--t-subtle-text-bright)' }}>{production?.closing_night ? formatDate(production.closing_night) : '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--t-subtle-text)' }}>Status</dt>
            <dd style={{ color: 'var(--t-subtle-text-bright)' }}>{isArchived ? 'Archived' : 'Active'}</dd>
          </div>
        </dl>
      </section>

      {/* Conflict Windows — director only */}
      {isDirector && (
        <section
          data-tour="settings-conflict-windows"
          className="rounded-sm p-5 mb-6 space-y-3"
          style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}
        >
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>Conflict Windows</p>
          <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>
            Every cast member gets 1 initial conflict submission. Set additional windows so they can submit more conflicts later.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>Extra windows per cast member:</label>
            <input
              type="number"
              min={0}
              max={50}
              value={conflictWindows ?? production?.extra_conflict_windows ?? 0}
              onChange={e => setConflictWindows(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1.5 rounded-sm text-sm outline-none"
              style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)', color: 'var(--t-subtle-text-bright)' }}
            />
            <Button
              size="sm"
              isLoading={savingWindows}
              onClick={async () => {
                if (!id) return;
                setSavingWindows(true);
                try {
                  await apiClient(`/productions/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ extra_conflict_windows: conflictWindows ?? production?.extra_conflict_windows ?? 0 }),
                  });
                  toast('Conflict windows updated');
                  setConflictWindows(null);
                  refetchProduction();
                } catch (err: any) {
                  toast(err.message || 'Failed', 'error');
                } finally {
                  setSavingWindows(false);
                }
              }}
            >
              Save
            </Button>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--t-subtle-text)' }}>
            Current: {production?.extra_conflict_windows ?? 0} extra window{(production?.extra_conflict_windows ?? 0) !== 1 ? 's' : ''} (total: {1 + (production?.extra_conflict_windows ?? 0)} per cast member).
            You can also set per-member overrides on the Members page.
          </p>
        </section>
      )}

      {/* Danger Zone */}
      <section
        data-tour="settings-danger"
        className="rounded-sm p-5 space-y-4"
        style={{ background: 'rgba(255,80,80,0.04)', border: '1px solid rgba(255,80,80,0.2)' }}
      >
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'rgba(255,120,120,0.8)' }}>Danger Zone</p>

        {isArchived ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>Unarchive Production</p>
              <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>Restore this production to active status.</p>
            </div>
            <Button variant="secondary" onClick={handleUnarchive} isLoading={busy}>Unarchive</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>Archive Production</p>
              <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>Archive hides the production from the dashboard.</p>
            </div>
            <Button variant="secondary" onClick={() => setArchiveOpen(true)}>Archive</Button>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>Delete Production</p>
            <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>Permanently delete this production and all data.</p>
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
    </div>
  );
}
