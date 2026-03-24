import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { getSchedule } from '@/services/schedule';
import { getConflicts, submitConflicts } from '@/services/conflicts';
import { formatDate, formatTime } from '@/utils/format';
import { MAX_LENGTHS, SCHEDULE_COLORS } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';

interface SelectedConflict {
  rehearsal_date_id: string;
  reason: string;
}

export function ConflictsPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: dates, isLoading: datesLoading } = useApi(() => getSchedule(id!), [id]);
  const { data: existing, isLoading: conflictsLoading, refetch } = useApi(() => getConflicts(id!), [id]);

  const [selected, setSelected] = useState<Record<string, SelectedConflict>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isSubmitted = existing && existing.length > 0;

  const toggleDate = useCallback((dateId: string) => {
    setSelected(prev => {
      if (prev[dateId]) {
        const next = { ...prev };
        delete next[dateId];
        return next;
      }
      return { ...prev, [dateId]: { rehearsal_date_id: dateId, reason: '' } };
    });
  }, []);

  const setReason = useCallback((dateId: string, reason: string) => {
    setSelected(prev => ({
      ...prev,
      [dateId]: { ...prev[dateId], reason: reason.slice(0, MAX_LENGTHS.conflict_reason) },
    }));
  }, []);

  async function handleSubmit() {
    if (!id) return;
    setSubmitting(true);
    try {
      const conflictDates = Object.values(selected).map(c => ({
        rehearsal_date_id: c.rehearsal_date_id,
        reason: c.reason.trim() || undefined,
      }));
      await submitConflicts(id, conflictDates);
      toast('Conflicts submitted');
      setConfirmOpen(false);
      refetch();
    } catch (err: any) {
      toast(err.message || 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (datesLoading || conflictsLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  const activeDates = (dates || []).filter(d => !d.is_deleted && !d.is_cancelled);

  if (isSubmitted) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Conflicts</h1>
        <p className="text-muted mb-6">Your conflicts have been submitted.</p>
        <div className="space-y-2">
          {existing!.map((c: any) => {
            const d = activeDates.find(dt => dt.id === c.rehearsal_date_id);
            if (!d) return null;
            return (
              <div key={c.id} className="p-3 rounded-md bg-surface border border-border flex items-center gap-3">
                <span className="text-foreground font-medium min-w-[90px]">{formatDate(d.date)}</span>
                <span className="text-muted text-sm">{formatTime(d.start_time)} - {formatTime(d.end_time)}</span>
                {c.reason && <span className="text-muted text-sm truncate max-w-[250px]">{c.reason}</span>}
              </div>
            );
          })}
          {existing!.length === 0 && <p className="text-muted">No conflicts reported. You are available for all dates.</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Submit Conflicts</h1>
      <p className="text-muted mb-6">Select dates you are unavailable. Click a row to toggle it.</p>

      <div className="space-y-2 mb-6">
        {activeDates.map(d => {
          const isSelected = !!selected[d.id];
          const color = SCHEDULE_COLORS[d.type];
          return (
            <div key={d.id}>
              <button
                type="button"
                onClick={() => toggleDate(d.id)}
                className={`w-full text-left p-3 rounded-md border transition-colors flex items-center gap-3 ${
                  isSelected ? 'bg-destructive/10 border-destructive' : 'bg-surface border-border hover:bg-surface-raised'
                }`}
              >
                <span className="font-medium text-foreground min-w-[90px]">{formatDate(d.date)}</span>
                <span className="text-muted text-sm">{formatTime(d.start_time)} - {formatTime(d.end_time)}</span>
                <Badge className={`${color.bg} ${color.text}`}>{color.label}</Badge>
                {isSelected && <Badge variant="destructive" className="ml-auto">Conflict</Badge>}
              </button>
              {isSelected && (
                <div className="ml-4 mt-1 mb-2">
                  <Textarea
                    placeholder="Reason (optional)"
                    value={selected[d.id].reason}
                    onChange={e => setReason(d.id, e.target.value)}
                    maxLength={MAX_LENGTHS.conflict_reason}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={() => setConfirmOpen(true)}>Submit Conflicts</Button>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit Conflicts"
        confirmLabel="Submit"
        onConfirm={handleSubmit}
        isLoading={submitting}
      >
        <p>
          You have selected {Object.keys(selected).length} conflict date(s). This action cannot be undone. Continue?
        </p>
      </Dialog>
    </div>
  );
}
