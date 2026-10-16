import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AvatarDisplay } from '@/components/ui/AvatarPicker';
import { Skeleton } from '@/components/ui/Skeleton';
import { getMemberDetails, type MemberDetails } from '@/services/castAssignments';
import { formatDate, formatTime } from '@/utils/format';
import type { Member } from '@/types';

type Tab = 'cast' | 'team' | 'staff';

interface MemberDirectoryProps {
  open: boolean;
  onClose: () => void;
  productionId: string;
  currentUserId?: string;
  members: Member[];
  /** Cast users with a team get a "Team" tab listing their teammates. */
  teammateIds?: Set<string>;
  showTeamTab: boolean;
  onMessage: (member: { id: string; name: string; role: string }) => void;
}

const sectionLabel = 'text-[11px] uppercase tracking-wider font-semibold mb-1.5';

/** Slide-over listing everyone in the production, with a per-person detail view (Default style). */
export function MemberDirectory({
  open, onClose, productionId, currentUserId, members, teammateIds, showTeamTab, onMessage,
}: MemberDirectoryProps) {
  const [tab, setTab] = useState<Tab>('cast');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<MemberDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) { setDetails(null); return; }
    let cancelled = false;
    setLoading(true);
    getMemberDetails(productionId, selectedId)
      .then(d => { if (!cancelled) setDetails(d); })
      .catch(() => { if (!cancelled) setDetails(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, productionId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'cast', label: 'Cast', count: members.filter(m => m.role === 'cast').length },
    ...(showTeamTab ? [{ key: 'team' as Tab, label: 'Team', count: teammateIds?.size ?? 0 }] : []),
    { key: 'staff', label: 'Staff', count: members.filter(m => m.role !== 'cast').length },
  ];
  const visible = members.filter(m => {
    if (tab === 'staff') return m.role === 'director' || m.role === 'staff';
    if (tab === 'team') return teammateIds?.has(m.user_id);
    return m.role === 'cast';
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70]"
            style={{ background: 'var(--t-drawer-backdrop)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Cast and crew"
            className="fixed top-0 right-0 bottom-0 z-[75] w-[380px] max-w-[94vw] flex flex-col"
            style={{ background: 'var(--t-surface)', borderLeft: '1px solid var(--t-border)', color: 'var(--t-foreground)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          >
            <div className="flex items-center justify-between px-5 h-14 flex-none" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <h2 className="text-sm font-semibold">Cast &amp; crew</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg cursor-pointer hover:bg-[var(--t-nav-hover)]"
                style={{ color: 'var(--t-muted)' }}
              >
                ✕
              </button>
            </div>

            {selectedId ? (
              <div className="flex-1 overflow-y-auto p-5">
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-xs mb-4 cursor-pointer"
                  style={{ color: 'var(--color-accent)' }}
                >
                  ← Back to list
                </button>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : details ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-lg font-semibold leading-tight">{details.display_name || details.name || 'Member'}</p>
                      <p className="text-sm capitalize" style={{ color: 'var(--t-muted)' }}>
                        {details.role}{details.character && ` · ${details.character}`}
                      </p>
                      {details.email && <p className="text-sm mt-1 break-all" style={{ color: 'var(--t-muted)' }}>{details.email}</p>}
                      {!details.profile_complete && (
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgb(var(--c-255-80-80) / 0.12)', color: 'hsl(var(--h-0-70-50))' }}>
                          Incomplete profile
                        </span>
                      )}
                    </div>

                    {details.user_id !== currentUserId && (
                      <button
                        onClick={() => onMessage({
                          id: details.user_id,
                          name: details.display_name || details.name || 'Member',
                          role: details.role,
                        })}
                        className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer"
                        style={{ background: 'var(--color-accent)', color: 'var(--btn-primary-text)' }}
                      >
                        Message
                      </button>
                    )}

                    {details.emergency_contacts && details.emergency_contacts.length > 0 && (
                      <div>
                        <p className={sectionLabel} style={{ color: 'var(--t-muted)' }}>Emergency contacts</p>
                        <div className="space-y-2">
                          {details.emergency_contacts.map((ec, i) => (
                            <div key={i} className="text-sm rounded-lg p-2.5"
                              style={{ background: 'var(--t-subtle-bg)', border: '1px solid var(--t-border)' }}>
                              <p className="font-medium">{ec.name} <span className="text-xs font-normal" style={{ color: 'var(--t-muted)' }}>· {ec.relationship}</span></p>
                              {ec.phone && <p style={{ color: 'var(--t-muted)' }}>{ec.phone}</p>}
                              {ec.email && <p className="break-all" style={{ color: 'var(--t-muted)' }}>{ec.email}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className={sectionLabel} style={{ color: 'var(--t-muted)' }}>
                        Conflicts {details.conflicts_submitted ? `(${details.conflicts.length})` : '· not submitted'}
                      </p>
                      {details.conflicts.length > 0 ? (
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {details.conflicts.map((c, i) => (
                            <div key={i} className="text-sm rounded-md px-2.5 py-1"
                              style={{ background: 'rgb(var(--c-255-80-80) / 0.08)', color: 'hsl(var(--h-0-70-50))' }}>
                              {c.date ? formatDate(c.date) : 'Unknown'}{c.reason ? ` · ${c.reason}` : ''}
                            </div>
                          ))}
                        </div>
                      ) : details.conflicts_submitted ? (
                        <p className="text-sm" style={{ color: 'var(--t-muted)' }}>No conflicts</p>
                      ) : null}
                    </div>

                    <div>
                      <p className={sectionLabel} style={{ color: 'var(--t-muted)' }}>Assigned dates ({details.assigned_dates.length})</p>
                      {details.assigned_dates.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {details.assigned_dates.map(d => (
                            <div key={d.id} className="text-sm rounded-md px-2.5 py-1 flex justify-between"
                              style={{ background: 'var(--t-subtle-bg)' }}>
                              <span>{formatDate(d.date)}</span>
                              <span style={{ color: 'var(--t-muted)' }}>{formatTime(d.start_time)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--t-muted)' }}>No dates assigned yet</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Could not load details.</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-1 px-5 pt-3 flex-none" role="tablist" style={{ borderBottom: '1px solid var(--t-border)' }}>
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className="px-3 py-2 text-sm font-medium cursor-pointer -mb-px"
                      style={{
                        color: tab === t.key ? 'var(--t-tab-active-text)' : 'var(--t-muted)',
                        borderBottom: `2px solid ${tab === t.key ? 'var(--color-accent)' : 'transparent'}`,
                      }}
                    >
                      {t.label} ({t.count})
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {visible.length === 0 && (
                    <p className="p-4 text-sm" style={{ color: 'var(--t-muted)' }}>No one here yet.</p>
                  )}
                  {visible.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.user_id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left cursor-pointer hover:bg-[var(--t-nav-hover)]"
                    >
                      <AvatarDisplay avatarId={m.avatar_url} name={m.name || m.user_id} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{m.name || 'Member'}</span>
                        <span className="block text-xs capitalize" style={{ color: 'var(--t-muted)' }}>{m.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
