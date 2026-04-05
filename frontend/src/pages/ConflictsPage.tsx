import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { getSchedule } from '@/services/schedule';
import { getConflicts, submitConflicts } from '@/services/conflicts';
import { formatDate, formatTime } from '@/utils/format';
import { MAX_LENGTHS, SCHEDULE_COLORS } from '@/utils/constants';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageTour } from '@/tours/PageTour';
import { conflictsTourSteps } from '@/tours/pageTours';
import { Dialog } from '@/components/ui/Dialog';
import { ChalkText, StickyNote } from '@/components/theater/Chalkboard';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectedConflict {
  rehearsal_date_id: string;
  reason: string;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

export function ConflictsPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: dates, isLoading: datesLoading } = useApi(() => getSchedule(id!), [id]);
  const { data: existing, isLoading: conflictsLoading, refetch } = useApi(() => getConflicts(id!), [id]);

  const [selected, setSelected] = useState<Record<string, SelectedConflict>>({});
  const [weeklyConflicts, setWeeklyConflicts] = useState<Set<number>>(new Set());
  const [showSpecificDates, setShowSpecificDates] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isSubmitted = existing && existing.length > 0;

  const activeDates = useMemo(
    () => (dates || []).filter(d => !d.is_deleted && !d.is_cancelled),
    [dates],
  );

  // Group dates by day-of-week for the weekly picker display
  const datesByDow = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of activeDates) {
      const dow = new Date(d.date + 'T00:00:00').getDay();
      map[dow] = (map[dow] || 0) + 1;
    }
    return map;
  }, [activeDates]);

  // When a weekly day is toggled, auto-select/deselect all matching dates
  const toggleWeekDay = useCallback((dow: number) => {
    setWeeklyConflicts(prev => {
      const next = new Set(prev);
      const isRemoving = next.has(dow);
      if (isRemoving) {
        next.delete(dow);
      } else {
        next.add(dow);
      }

      // Sync individual date selections
      setSelected(prevSelected => {
        const updated = { ...prevSelected };
        for (const d of activeDates) {
          const dateDow = new Date(d.date + 'T00:00:00').getDay();
          if (dateDow === dow) {
            if (isRemoving) {
              delete updated[d.id];
            } else {
              updated[d.id] = { rehearsal_date_id: d.id, reason: '' };
            }
          }
        }
        return updated;
      });

      return next;
    });
  }, [activeDates]);

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

  // Already submitted view
  if (isSubmitted) {
    return (
      <div>
        <ChalkText size="lg">Conflicts Submitted</ChalkText>
        <p className="mt-2 mb-6" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
          Your conflicts are locked in. Your director can see which dates you can't make.
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {existing!.map((c: any) => {
            const d = activeDates.find(dt => dt.id === c.rehearsal_date_id);
            if (!d) return null;
            return (
              <div key={c.id} className="px-4 py-3 rounded-sm flex flex-wrap items-center gap-2"
                style={{ background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.1)' }}>
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{formatDate(d.date)}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatTime(d.start_time)} – {formatTime(d.end_time)}</span>
                {c.reason && <span className="text-xs truncate max-w-[250px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.reason}</span>}
              </div>
            );
          })}
          {existing!.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>No conflicts reported. You're available for all dates.</p>
          )}
        </div>
      </div>
    );
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <div>
      <PageTour tourId="page-conflicts" steps={conflictsTourSteps} />

      <div className="mb-6">
        <ChalkText size="lg">Submit Conflicts</ChalkText>
        <p className="mt-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
          Let your director know which dates you can't make. Start by picking days of the week, then fine-tune with specific dates.
        </p>
      </div>

      {/* Step 1: Weekly pattern picker */}
      <div data-tour="conflicts-weekly" className="mb-6">
        <StickyNote color="yellow" rotate={-0.3}>
          <p className="text-[10px] uppercase tracking-widest font-bold mb-3 opacity-60">
            Weekly Conflicts — which days are you generally unavailable?
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_DAYS.map((day, dow) => {
              const isConflict = weeklyConflicts.has(dow);
              const count = datesByDow[dow] || 0;
              return (
                <motion.button
                  key={dow}
                  onClick={() => toggleWeekDay(dow)}
                  className="flex flex-col items-center gap-1 py-3 rounded-sm cursor-pointer"
                  style={{
                    background: isConflict ? 'rgba(220,60,60,0.15)' : 'rgba(0,0,0,0.06)',
                    border: `1.5px solid ${isConflict ? 'rgba(220,60,60,0.4)' : 'rgba(0,0,0,0.08)'}`,
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-xs font-semibold" style={{ color: isConflict ? 'rgba(220,80,80,0.9)' : 'rgba(0,0,0,0.5)' }}>
                    {day}
                  </span>
                  {count > 0 && (
                    <span className="text-[9px]" style={{ color: isConflict ? 'rgba(220,80,80,0.6)' : 'rgba(0,0,0,0.3)' }}>
                      {count} dates
                    </span>
                  )}
                  {isConflict && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-[2px]"
                      style={{ background: 'rgba(220,60,60,0.2)', color: 'rgba(220,80,80,0.9)' }}>
                      OUT
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
          {weeklyConflicts.size > 0 && (
            <p className="mt-2 text-[10px]" style={{ opacity: 0.5 }}>
              {selectedCount} date{selectedCount !== 1 ? 's' : ''} marked as conflicts
            </p>
          )}
        </StickyNote>
      </div>

      {/* Toggle to show specific dates */}
      <div className="mb-4 flex items-center gap-3">
        <button
          data-tour="conflicts-specific-toggle"
          onClick={() => setShowSpecificDates(!showSpecificDates)}
          className="text-[10px] uppercase tracking-widest px-4 py-2 rounded cursor-pointer transition-colors"
          style={{
            background: showSpecificDates ? 'rgba(255,220,100,0.12)' : 'rgba(255,255,255,0.04)',
            color: showSpecificDates ? 'rgba(255,220,100,0.8)' : 'rgba(255,255,255,0.4)',
            border: `1px solid ${showSpecificDates ? 'rgba(255,220,100,0.2)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {showSpecificDates ? 'Hide Specific Dates' : 'Pick Specific Dates'}
        </button>
        {!showSpecificDates && selectedCount > 0 && (
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {selectedCount} conflict{selectedCount !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {/* Step 2: Specific dates list (collapsible) */}
      <AnimatePresence>
        {showSpecificDates && (
          <motion.div
            data-tour="conflicts-date-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 mb-6 max-h-[50vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {activeDates.map(d => {
                const isSelected = !!selected[d.id];
                const color = SCHEDULE_COLORS[d.type];
                return (
                  <div key={d.id}>
                    <button
                      type="button"
                      onClick={() => toggleDate(d.id)}
                      className="w-full text-left px-4 py-3 rounded-sm flex flex-wrap items-center gap-2 transition-colors cursor-pointer"
                      style={{
                        background: isSelected ? 'rgba(220,60,60,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? 'rgba(220,60,60,0.2)' : 'rgba(255,255,255,0.04)'}`,
                      }}
                    >
                      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{formatDate(d.date)}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatTime(d.start_time)} – {formatTime(d.end_time)}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]"
                        style={{ background: isSelected ? 'rgba(220,60,60,0.15)' : 'rgba(255,255,255,0.04)', color: isSelected ? 'rgba(220,80,80,0.8)' : 'rgba(255,255,255,0.3)' }}>
                        {isSelected ? 'CONFLICT' : d.type === 'blocked' ? 'Blocked' : color.label}
                      </span>
                    </button>
                    {isSelected && (
                      <div className="ml-4 mt-1 mb-1">
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={selected[d.id].reason}
                          onChange={e => setReason(d.id, e.target.value)}
                          maxLength={MAX_LENGTHS.conflict_reason}
                          className="w-full px-3 py-1.5 rounded-sm text-xs outline-none"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.6)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <div data-tour="conflicts-submit" className="mt-4">
        <motion.button
          onClick={() => setConfirmOpen(true)}
          className="px-6 py-3 rounded-sm text-sm font-semibold cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)',
            color: 'hsl(220, 6%, 9%)',
            boxShadow: '0 2px 8px rgba(212,175,55,0.2)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Submit Conflicts {selectedCount > 0 && `(${selectedCount})`}
        </motion.button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit Conflicts"
        confirmLabel="Submit"
        onConfirm={handleSubmit}
        isLoading={submitting}
      >
        <p>
          {selectedCount === 0
            ? 'You have no conflicts selected. This means you\'re available for all dates. Continue?'
            : `You have selected ${selectedCount} conflict date${selectedCount !== 1 ? 's' : ''}. This cannot be undone. Continue?`
          }
        </p>
      </Dialog>
    </div>
  );
}
