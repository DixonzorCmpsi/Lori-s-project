import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getMembers, promoteMember, demoteMember, removeMember, resetConflicts, blockMember, unblockMember, getBlockedMembers } from '@/services/members';
import { getInvite, regenerateInvite, createInvite } from '@/services/invite';
import { getTeams, createTeam, deleteTeam, cycleMemberTeam } from '@/services/teams';
import { broadcastMessage } from '@/services/chat';
import { apiClient } from '@/services/api';
import { Dialog } from '@/components/ui/Dialog';
import { StickyNote, ChalkText } from '@/components/theater/Chalkboard';
import { ROLES } from '@/utils/constants';
import { formatRelativeTime } from '@/utils/format';
import type { Member, Team } from '@/types';
import { PageTour } from '@/tours/PageTour';
import { rosterTourSteps, teamsTourSteps } from '@/tours/pageTours';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };
const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.1 } } };
const fadeIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: spring } };

const roleColors: Record<string, { bg: string; text: string; label: string }> = {
  director: { bg: 'rgba(255,180,50,0.15)', text: 'hsl(38,70%,55%)', label: 'Director' },
  staff:    { bg: 'rgba(100,180,255,0.12)', text: 'hsl(210,60%,60%)', label: 'Staff' },
  cast:     { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', label: 'Cast' },
};

// Team colors for the teams tab
const TEAM_COLORS = [
  { bg: 'rgba(255,180,60,0.12)',  border: 'rgba(255,180,60,0.25)',  text: 'hsl(38,85%,62%)',   avatarBg: 'rgba(255,180,60,0.15)',  chipBg: 'rgba(255,180,60,0.1)' },
  { bg: 'rgba(100,180,255,0.10)', border: 'rgba(100,180,255,0.22)', text: 'hsl(210,80%,68%)',  avatarBg: 'rgba(100,180,255,0.12)', chipBg: 'rgba(100,180,255,0.08)' },
  { bg: 'rgba(160,120,255,0.10)', border: 'rgba(160,120,255,0.22)', text: 'hsl(265,75%,72%)',  avatarBg: 'rgba(160,120,255,0.12)', chipBg: 'rgba(160,120,255,0.08)' },
  { bg: 'rgba(80,220,140,0.10)',  border: 'rgba(80,220,140,0.22)',  text: 'hsl(155,65%,55%)',  avatarBg: 'rgba(80,220,140,0.12)',  chipBg: 'rgba(80,220,140,0.08)' },
  { bg: 'rgba(255,120,140,0.10)', border: 'rgba(255,120,140,0.22)', text: 'hsl(350,80%,70%)',  avatarBg: 'rgba(255,120,140,0.12)', chipBg: 'rgba(255,120,140,0.08)' },
  { bg: 'rgba(255,160,80,0.10)',  border: 'rgba(255,160,80,0.22)',  text: 'hsl(25,85%,62%)',   avatarBg: 'rgba(255,160,80,0.12)',  chipBg: 'rgba(255,160,80,0.08)' },
  { bg: 'rgba(80,200,220,0.10)',  border: 'rgba(80,200,220,0.22)',  text: 'hsl(188,65%,58%)',  avatarBg: 'rgba(80,200,220,0.12)',  chipBg: 'rgba(80,200,220,0.08)' },
  { bg: 'rgba(220,180,80,0.10)',  border: 'rgba(220,180,80,0.22)',  text: 'hsl(45,70%,58%)',   avatarBg: 'rgba(220,180,80,0.12)',  chipBg: 'rgba(220,180,80,0.08)' },
];

function getTeamColor(teams: Team[] | null, teamId: string) {
  if (!teams) return TEAM_COLORS[0];
  const idx = teams.findIndex(t => t.id === teamId);
  return TEAM_COLORS[idx % TEAM_COLORS.length];
}

export function RosterPage() {
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const { toast } = useToast();
  const isDirector = userRole === ROLES.DIRECTOR;
  const isDirectorOrStaff = isDirector || userRole === ROLES.STAFF;

  const [tab, setTab] = useState<'roster' | 'manage'>('roster');

  // ── Roster data ──
  const { data: members, isLoading, refetch } = useApi(() => getMembers(id!), [id]);
  const { data: invite, refetch: refetchInvite } = useApi(() => getInvite(id!).catch(() => null), [id]);
  const { data: blockedMembers, refetch: refetchBlocked } = useApi(
    () => isDirector && id ? getBlockedMembers(id) : Promise.resolve([]), [id, isDirector],
  );
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
      else if (type === 'block') { await blockMember(id, member.user_id); refetchBlocked(); }
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} done`);
      setConfirmAction(null); refetch();
    } catch (err: any) { toast(err.message || `Failed`, 'error'); }
    finally { setBusy(false); }
  }

  const dialogTitle: Record<string, string> = { promote: 'Promote', demote: 'Demote', remove: 'Remove', reset: 'Reset Conflicts', block: 'Block Member' };
  const dialogDesc: Record<string, string> = {
    promote: 'Promote to staff?', demote: 'Demote to cast?',
    remove: 'Remove from production? Cannot be undone.', reset: 'Reset conflicts? They must resubmit.',
    block: 'Block this member? They will be removed and cannot rejoin via invite link.',
  };

  const directors = (members || []).filter(m => m.role === 'director');
  const staff = (members || []).filter(m => m.role === 'staff');
  const cast = (members || []).filter(m => m.role === 'cast');

  // ── Teams data ──
  const { data: teams, refetch: refetchTeams } = useApi<Team[]>(
    () => id ? getTeams(id) : Promise.resolve([]), [id],
  );
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, string | null>>({});
  const [savingTeams, setSavingTeams] = useState(false);
  const pendingCount = Object.keys(localOverrides).length;

  // ── Manage tab state ──
  const [manageTeamId, setManageTeamId] = useState<string | null>(null);
  const [announceBody, setAnnounceBody] = useState('');
  const [announceType, setAnnounceType] = useState<'message' | 'announcement'>('message');
  const [announcing, setAnnouncing] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showTeamBuilder, setShowTeamBuilder] = useState(false);

  const castMembers = useMemo(() => (members || []).filter(m => m.role === 'cast'), [members]);

  useEffect(() => {
    if (!id || !manageTeamId) return;
    try {
      const key = `callboard.manage.announceType.${id}.${manageTeamId}`;
      const stored = window.localStorage.getItem(key);
      if (stored === 'message' || stored === 'announcement') setAnnounceType(stored);
    } catch {
      // ignore storage errors
    }
  }, [id, manageTeamId]);

  const serverTeamMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const m of castMembers) map[m.user_id] = null;
    if (teams) for (const t of teams) for (const uid of t.member_user_ids) map[uid] = t.id;
    return map;
  }, [castMembers, teams]);

  const memberTeamMap = useMemo(() => ({ ...serverTeamMap, ...localOverrides }), [serverTeamMap, localOverrides]);

  const teamCycle = useMemo(() => {
    const ids: (string | null)[] = [null];
    if (teams) for (const t of teams) ids.push(t.id);
    return ids;
  }, [teams]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (teams) for (const t of teams) counts[t.id] = 0;
    for (const tid of Object.values(memberTeamMap)) {
      if (tid) counts[tid] = (counts[tid] || 0) + 1;
    }
    return counts;
  }, [memberTeamMap, teams]);

  async function handleCreateTeam() {
    if (!id || !newTeamName.trim()) return;
    setCreatingTeam(true);
    try { await createTeam(id, newTeamName.trim()); setNewTeamName(''); refetchTeams(); }
    catch (err: any) { toast(err.message || 'Failed', 'error'); }
    finally { setCreatingTeam(false); }
  }

  async function handleDeleteTeam() {
    if (!id || !deleteTarget) return;
    setDeletingTeam(true);
    try {
      await deleteTeam(id, deleteTarget.id);
      setDeleteTarget(null);
      setLocalOverrides(prev => {
        const cleaned: Record<string, string | null> = {};
        for (const [uid, tid] of Object.entries(prev)) if (tid !== deleteTarget.id) cleaned[uid] = tid;
        return cleaned;
      });
      refetchTeams();
    } catch (err: any) { toast(err.message || 'Failed', 'error'); }
    finally { setDeletingTeam(false); }
  }

  const handleCycleMember = useCallback((userId: string) => {
    if (!teams || teams.length === 0) return;
    const current = memberTeamMap[userId];
    const idx = teamCycle.indexOf(current);
    const nextTeamId = teamCycle[(idx + 1) % teamCycle.length];
    if (nextTeamId === serverTeamMap[userId]) {
      setLocalOverrides(prev => { const n = { ...prev }; delete n[userId]; return n; });
    } else {
      setLocalOverrides(prev => ({ ...prev, [userId]: nextTeamId }));
    }
  }, [teams, memberTeamMap, teamCycle, serverTeamMap]);

  async function handleSaveTeams() {
    if (!id || pendingCount === 0) return;
    setSavingTeams(true);
    try {
      await Promise.all(Object.entries(localOverrides).map(([uid, tid]) => cycleMemberTeam(id!, uid, tid)));
      setLocalOverrides({});
      refetchTeams();
    } catch (err: any) { toast(err.message || 'Failed to save', 'error'); }
    finally { setSavingTeams(false); }
  }

  return (
    <div>
      {isDirector && <PageTour tourId={tab === 'roster' ? 'page-roster' : 'page-teams'} steps={tab === 'roster' ? rosterTourSteps : teamsTourSteps} />}

      {/* Tab switcher — Roster / Manage */}
      <div className="flex items-center justify-between mb-6">
        <ChalkText size="lg">{tab === 'roster' ? 'Company Roster' : 'Manage'}</ChalkText>
        <div className="flex items-center gap-1">
          {isDirectorOrStaff && (
            <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid var(--t-tab-border)` }}>
              {(['roster', 'manage'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setManageTeamId(null); setShowTeamBuilder(false); }}
                  className="px-4 py-1.5 text-[10px] uppercase tracking-widest cursor-pointer"
                  style={{
                    background: tab === t ? 'var(--t-tab-active-bg)' : 'transparent',
                    color: tab === t ? 'var(--t-tab-active-text)' : 'var(--t-tab-inactive-text)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <span className="ml-3" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>
            {(members || []).length} members
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
      {/* ═══ ROSTER TAB ═══ */}
      {tab === 'roster' && (
        <motion.div key="roster" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {/* Invite link section */}
          {isDirector && (
            <div className="mb-6" data-tour="roster-invite">
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
          <div data-tour="roster-members">
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
                          <button onClick={() => setConfirmAction({ type: 'block', member: m })}
                            className="text-[9px] px-1.5 py-1 rounded cursor-pointer" style={{ color: 'rgba(255,80,80,0.5)' }}>Ban</button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          ))}
          </div>

          {isLoading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 rounded animate-pulse" style={{ background: 'var(--t-subtle-bg)' }} />)}
            </div>
          )}

          {/* Blocked members — director only */}
          {isDirector && blockedMembers && blockedMembers.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <ChalkText size="sm">Blocked</ChalkText>
                <span style={{ color: 'rgba(255,120,120,0.5)', fontSize: '10px' }}>({blockedMembers.length})</span>
              </div>
              <div className="space-y-1.5">
                {blockedMembers.map(b => (
                  <div key={b.user_id} className="flex items-center justify-between px-4 py-2 rounded-sm"
                    style={{ background: 'rgba(255,80,80,0.04)', border: '1px solid rgba(255,80,80,0.1)' }}>
                    <div>
                      <span className="text-xs" style={{ color: 'rgba(255,150,150,0.7)' }}>{b.name || b.email}</span>
                      {b.reason && <span className="text-[9px] ml-2" style={{ color: 'var(--t-subtle-text)' }}>— {b.reason}</span>}
                    </div>
                    <button
                      onClick={async () => {
                        if (!id) return;
                        try { await unblockMember(id, b.user_id); toast('Unblocked'); refetchBlocked(); }
                        catch { toast('Failed', 'error'); }
                      }}
                      className="text-[9px] cursor-pointer px-2 py-0.5 rounded"
                      style={{ color: 'rgba(150,220,150,0.6)', background: 'rgba(100,200,100,0.06)' }}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Dialog
            open={!!confirmAction}
            onClose={() => setConfirmAction(null)}
            title={confirmAction ? dialogTitle[confirmAction.type] : ''}
            confirmLabel="Confirm"
            confirmVariant={confirmAction?.type === 'remove' || confirmAction?.type === 'block' ? 'destructive' : 'primary'}
            onConfirm={handleConfirm}
            isLoading={busy}
          >
            <p>{confirmAction ? `${dialogDesc[confirmAction.type]} (${confirmAction.member.name || confirmAction.member.email})` : ''}</p>
          </Dialog>
        </motion.div>
      )}

      {/* ═══ MANAGE TAB ═══ */}
      {tab === 'manage' && (
        <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <AnimatePresence mode="wait">
          {/* ── Team management (when teams exist and no specific team selected) ── */}
          {!manageTeamId && !showTeamBuilder && (
            <motion.div key="team-list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
              <p className="mb-4" style={{ color: 'var(--t-subtle-text-bright)', fontSize: '13px' }}>
                Select a team to send announcements or manage members.
              </p>

              {teams && teams.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {teams.map(team => {
                    const c = getTeamColor(teams, team.id);
                    const tmembers = castMembers.filter(m => team.member_user_ids.includes(m.user_id));
                    return (
                      <button
                        key={team.id}
                        onClick={() => setManageTeamId(team.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-sm cursor-pointer text-left"
                        style={{ background: c.bg, border: `1px solid ${c.border}` }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold" style={{ color: c.text }}>{team.name}</span>
                          <span className="text-[10px] font-mono" style={{ color: c.text, opacity: 0.6 }}>{tmembers.length} members</span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--t-subtle-text)' }}>Manage &rarr;</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mb-6 text-xs italic" style={{ color: 'var(--t-subtle-text)' }}>
                  No teams yet. Use Team Builder below to create your first team.
                </p>
              )}

              {/* Team Builder entry point */}
              <button
                data-tour="teams-create"
                onClick={() => setShowTeamBuilder(true)}
                className="w-full text-left px-4 py-3 rounded-sm cursor-pointer flex items-center justify-between"
                style={{ background: 'var(--t-subtle-bg)', border: `1px dashed var(--t-tab-border)` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--t-tab-active-text)' }}>+</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--t-tab-active-text)' }}>Team Builder</span>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--t-subtle-text)' }}>Create & assign teams</span>
              </button>
            </motion.div>
          )}

          {/* ── Managing a specific team ── */}
          {manageTeamId && !showTeamBuilder && (() => {
            const team = teams?.find(t => t.id === manageTeamId);
            if (!team) return null;
            const c = getTeamColor(teams, team.id);
            const tmembers = castMembers.filter(m => team.member_user_ids.includes(m.user_id));

            async function handleAnnounce() {
              if (!id || !announceBody.trim() || !manageTeamId) return;
              setAnnouncing(true);
              try {
                if (announceType === 'announcement') {
                  // Post to bulletin board
                  await apiClient(`/productions/${id}/bulletin`, {
                    method: 'POST',
                    body: JSON.stringify({ title: `${team?.name} — Announcement`, body: announceBody.trim(), notify_members: true }),
                  });
                  toast('Announcement posted to bulletin');
                } else {
                  // Send as direct messages
                  const result = await broadcastMessage(id, announceBody.trim(), manageTeamId);
                  toast(`Sent to ${result.sent_count} member${result.sent_count !== 1 ? 's' : ''}`);
                }
                setAnnounceBody('');
              } catch (err: any) {
                toast(err.message || 'Failed', 'error');
              } finally {
                setAnnouncing(false);
              }
            }

            async function handleRemoveFromTeam(userId: string) {
              if (!id) return;
              setRemovingUserId(userId);
              try {
                await cycleMemberTeam(id, userId, null);
                refetchTeams();
              } catch (err: any) {
                toast(err.message || 'Failed', 'error');
              } finally {
                setRemovingUserId(null);
              }
            }

            return (
              <motion.div key="team-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => { setManageTeamId(null); setAnnounceBody(''); }}
                    className="text-[10px] uppercase tracking-widest cursor-pointer"
                    style={{ color: 'var(--t-tab-active-text)' }}
                  >
                    &larr; All Teams
                  </button>
                  <span className="text-sm font-semibold" style={{ color: c.text }}>{team.name}</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--t-subtle-text)' }}>{tmembers.length} members</span>
                </div>

                {/* Send to team — message or announcement */}
                <div data-tour="teams-send-panel" className="mb-6 rounded-sm p-4" style={{ background: 'var(--t-subtle-bg)', border: `1px solid var(--t-tab-border)` }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>
                      Send to {team.name}
                    </p>
                    <div data-tour="teams-send-toggle" className="flex rounded overflow-hidden" style={{ border: `1px solid var(--t-tab-border)` }}>
                      {(['message', 'announcement'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setAnnounceType(t);
                            if (id && manageTeamId) {
                              try {
                                window.localStorage.setItem(`callboard.manage.announceType.${id}.${manageTeamId}`, t);
                              } catch {
                                // ignore storage errors
                              }
                            }
                          }}
                          className="px-2 py-0.5 text-[8px] uppercase tracking-widest cursor-pointer"
                          style={{
                            background: announceType === t ? 'var(--t-tab-active-bg)' : 'transparent',
                            color: announceType === t ? 'var(--t-tab-active-text)' : 'var(--t-tab-inactive-text)',
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[9px] mb-2" style={{ color: 'var(--t-subtle-text)' }}>
                    {announceType === 'message' ? 'Sends a direct message to each team member.' : 'Posts to the bulletin board visible to all.'}
                  </p>
                  <textarea
                    value={announceBody}
                    onChange={e => setAnnounceBody(e.target.value.slice(0, 2000))}
                    placeholder={`Message to all ${team.name} members...`}
                    rows={3}
                    className="w-full px-3 py-2 rounded-sm text-xs outline-none resize-none mb-2"
                    style={{ background: 'var(--t-subtle-bg)', border: `1px solid var(--t-section-border)`, color: 'var(--t-subtle-text-bright)' }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px]" style={{ color: 'var(--t-subtle-text)' }}>{announceBody.length}/2000</span>
                    <button
                      onClick={handleAnnounce}
                      disabled={announcing || !announceBody.trim()}
                      className="text-[10px] uppercase tracking-widest font-bold px-4 py-1.5 rounded-sm cursor-pointer"
                      style={{
                        background: !announceBody.trim() ? 'var(--t-subtle-bg)' : 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)',
                        color: !announceBody.trim() ? 'var(--t-subtle-text)' : 'hsl(220, 6%, 9%)',
                        opacity: announcing ? 0.5 : 1,
                      }}
                    >
                      {announcing ? 'Sending...' : announceType === 'message' ? 'Send Messages' : 'Post Announcement'}
                    </button>
                  </div>
                </div>

                {/* Team member list with remove */}
                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--t-subtle-text)' }}>Members</p>
                {tmembers.length === 0 ? (
                  <p className="text-xs italic" style={{ color: 'var(--t-subtle-text)' }}>No members in this team.</p>
                ) : (
                  <div className="space-y-1">
                    {tmembers.map(m => (
                      <div key={m.user_id} className="flex items-center justify-between px-3 py-2 rounded-sm"
                        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                            style={{ background: c.avatarBg, color: c.text }}>
                            {(m.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>
                            {m.name || 'Member'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveFromTeam(m.user_id)}
                          disabled={removingUserId === m.user_id}
                          className="text-[9px] cursor-pointer px-2 py-0.5 rounded"
                          style={{ color: 'rgba(255,150,150,0.7)', background: 'rgba(255,80,80,0.08)' }}
                        >
                          {removingUserId === m.user_id ? '...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })()}

          {/* ── Team Builder ── */}
          {showTeamBuilder && (
            <motion.div key="team-builder" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setShowTeamBuilder(false)}
                  className="text-[10px] uppercase tracking-widest cursor-pointer"
                  style={{ color: 'var(--t-tab-active-text)' }}
                >
                  &larr; Back
                </button>
                <span className="text-sm font-semibold" style={{ color: 'var(--t-subtle-text-bright)' }}>Team Builder</span>
              </div>

              <p className="mb-4" style={{ color: 'var(--t-subtle-text)', fontSize: '12px' }}>
                Create teams and assign cast members. Click a name to cycle through teams.
              </p>

              {/* Create team input */}
              <div data-tour="teams-create" className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="New team name..."
                  maxLength={200}
                  onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                  className="flex-1 px-3 py-2 rounded-sm text-xs outline-none"
                  style={{ background: 'var(--t-subtle-bg)', border: `1px solid var(--t-tab-border)`, color: 'var(--t-subtle-text-bright)' }}
                />
                <motion.button
                  onClick={handleCreateTeam}
                  disabled={creatingTeam || !newTeamName.trim()}
                  className="text-[10px] uppercase tracking-widest font-bold px-4 py-2 rounded-sm cursor-pointer"
                  style={{
                    background: !newTeamName.trim() ? 'var(--t-subtle-bg)' : 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)',
                    color: !newTeamName.trim() ? 'var(--t-subtle-text)' : 'hsl(220, 6%, 9%)',
                    opacity: creatingTeam ? 0.5 : 1,
                  }}
                  whileHover={newTeamName.trim() ? { scale: 1.02 } : {}}
                  whileTap={newTeamName.trim() ? { scale: 0.98 } : {}}
                >
                  {creatingTeam ? '...' : 'Create'}
                </motion.button>
              </div>

              {/* Team chips */}
              {teams && teams.length > 0 && (
                <div data-tour="teams-list" className="flex flex-wrap gap-2 mb-4">
                  {teams.map(t => {
                    const c = getTeamColor(teams, t.id);
                    return (
                      <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
                        style={{ background: c.chipBg, border: `1px solid ${c.border}` }}>
                        <span className="text-xs font-medium" style={{ color: c.text }}>{t.name}</span>
                        <span className="text-[9px] font-mono" style={{ color: c.text, opacity: 0.7 }}>{teamCounts[t.id] || 0}</span>
                        <button onClick={() => setDeleteTarget(t)} className="text-[10px] cursor-pointer ml-1" style={{ color: 'rgba(255,100,100,0.6)' }}>x</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cast assignment — click to cycle */}
              {teams && teams.length > 0 && (
                <div data-tour="teams-assign">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-subtle-text)' }}>
                      Click to cycle through teams
                    </p>
                    {pendingCount > 0 && (
                      <motion.button
                        onClick={handleSaveTeams}
                        disabled={savingTeams}
                        className="text-[10px] uppercase tracking-widest font-bold px-4 py-1.5 rounded-sm cursor-pointer"
                        style={{
                          background: 'linear-gradient(180deg, hsl(38, 70%, 50%) 0%, hsl(38, 65%, 42%) 100%)',
                          color: 'hsl(220, 6%, 9%)',
                          boxShadow: '0 2px 8px rgba(212,175,55,0.2)',
                          opacity: savingTeams ? 0.5 : 1,
                        }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {savingTeams ? 'Saving...' : `Save ${pendingCount}`}
                      </motion.button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {castMembers.map(m => {
                      const teamId = memberTeamMap[m.user_id];
                      const team = teams.find(t => t.id === teamId);
                      const hasOverride = m.user_id in localOverrides;
                      const c = teamId ? getTeamColor(teams, teamId) : null;
                      return (
                        <motion.button
                          key={m.user_id}
                          onClick={() => handleCycleMember(m.user_id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 rounded-sm cursor-pointer text-left"
                          style={{
                            background: c ? c.bg : 'var(--t-subtle-bg)',
                            border: `1px solid ${hasOverride && c ? c.border : c ? c.border.replace('0.22', '0.1').replace('0.25', '0.12') : 'var(--t-section-border)'}`,
                          }}
                          whileHover={{ background: c ? c.bg.replace('0.1', '0.16').replace('0.12', '0.18') : 'var(--t-tab-active-bg)' }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                              style={{ background: c ? c.avatarBg : 'var(--t-subtle-bg)', color: c ? c.text : 'var(--t-subtle-text)' }}>
                              {(m.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>
                              {m.name || 'Member'}
                            </span>
                          </div>
                          {team && c ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm"
                              style={{ background: c.chipBg, color: c.text, border: `1px solid ${c.border}` }}>
                              {team.name}
                            </span>
                          ) : (
                            <span className="text-[9px] italic" style={{ color: 'var(--t-subtle-text)' }}>No team</span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>

          <Dialog
            open={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title="Delete Team"
            confirmLabel="Delete"
            confirmVariant="destructive"
            onConfirm={handleDeleteTeam}
            isLoading={deletingTeam}
          >
            <p>Delete team "{deleteTarget?.name}"? Members will be unassigned.</p>
          </Dialog>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
