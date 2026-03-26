import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/services/api';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export function ProductionSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { production } = useProduction();
  const { toast } = useToast();

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    <div className="max-w-lg">
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
    </div>
  );
}
