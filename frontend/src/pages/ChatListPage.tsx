import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/theater/BackstageLayout';
import { getConversations, getContacts, sendMessage, broadcastMessage } from '@/services/chat';
import { getTeams } from '@/services/teams';
import { formatMessageTime } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { ChalkText } from '@/components/theater/Chalkboard';
import { PageTour } from '@/tours/PageTour';
import { chatTourSteps } from '@/tours/pageTours';
import { useAuth } from '@/hooks/useAuth';
import type { Team, Conversation } from '@/types';

function ConversationRow({ conv, productionId, navigate }: { conv: Conversation; productionId: string; navigate: (path: string) => void }) {
  return (
    <button
      onClick={() => navigate(`/production/${productionId}/chat/${conv.id}`)}
      className="w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors"
      style={{ background: 'var(--t-subtle-bg)', border: `1px solid var(--t-section-border)` }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-tab-active-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--t-subtle-bg)')}
    >
      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold"
        style={{ background: 'var(--t-member-avatar-cast)', color: 'var(--t-member-avatar-cast-text)' }}>
        {(conv.participant_name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--t-member-name)' }}>{conv.participant_name}</span>
          <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded"
            style={{ background: 'var(--t-subtle-bg)', color: 'var(--t-subtle-text)' }}>
            {conv.participant_role}
          </span>
        </div>
        {conv.last_message && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--t-subtle-text)' }}>{conv.last_message}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {conv.last_message_at && (
          <span className="text-[9px]" style={{ color: 'var(--t-subtle-text)' }}>{formatMessageTime(conv.last_message_at)}</span>
        )}
        {conv.unread_count > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: 'hsl(0,70%,50%)', color: 'white', minWidth: '18px', textAlign: 'center' }}>
            {conv.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

export function ChatListPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userRole, members } = useProduction();
  const { user } = useAuth();
  const isDirectorOrStaff = userRole === 'director' || userRole === 'staff';

  const { data: conversations, isLoading, refetch } = useApi(() => getConversations(id!), [id]);
  const [expandedChatTeams, setExpandedChatTeams] = useState<Set<string>>(new Set());
  const { data: persistentTeams } = useApi<Team[]>(
    () => isDirectorOrStaff && id ? getTeams(id) : Promise.resolve([]), [id, isDirectorOrStaff],
  );
  const [showPicker, setShowPicker] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; role: string }[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Compose state
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string; role: string } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  async function openContactPicker() {
    setShowPicker(true);
    setSelectedContact(null);
    setSelectedTeam(null);
    setMessageBody('');
    setLoadingContacts(true);
    try {
      const [contactData, teamData] = await Promise.all([
        getContacts(id!),
        isDirectorOrStaff ? getTeams(id!) : Promise.resolve([]),
      ]);
      setContacts(contactData);
      setTeams(teamData);
    } catch {
      toast('Failed to load contacts', 'error');
    } finally {
      setLoadingContacts(false);
    }
  }

  function pickContact(contact: { id: string; name: string; role: string }) {
    setSelectedContact(contact);
    setSelectedTeam(null);
    setMessageBody('');
  }

  function pickTeam(team: Team) {
    setSelectedTeam(team);
    setSelectedContact(null);
    setMessageBody('');
  }

  async function handleSend() {
    if (!id || !messageBody.trim()) return;
    setSendingMessage(true);
    try {
      if (selectedTeam) {
        const result = await broadcastMessage(id, messageBody.trim(), selectedTeam.id);
        toast(`Sent to ${result.sent_count} team member${result.sent_count !== 1 ? 's' : ''}`);
        setShowPicker(false);
        setSelectedTeam(null);
        setMessageBody('');
        refetch();
      } else if (selectedContact) {
        const result = await sendMessage(id, selectedContact.id, messageBody.trim());
        setShowPicker(false);
        setSelectedContact(null);
        setMessageBody('');
        refetch();
        navigate(`/production/${id}/chat/${result.conversation_id}`);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to send', 'error');
    } finally {
      setSendingMessage(false);
    }
  }

  // Group contacts: staff/director first, then individuals
  const staffContacts = contacts.filter(c => c.role === 'director' || c.role === 'staff');
  const castContacts = contacts.filter(c => c.role === 'cast');

  // Group conversations by team for director/staff
  const groupedConversations = useMemo(() => {
    if (!conversations) return { teamGroups: [], individual: [] };
    const allTeams = persistentTeams || [];
    if (allTeams.length === 0) return { teamGroups: [], individual: conversations };

    const teamMemberIds = new Map<string, Set<string>>();
    for (const t of allTeams) {
      teamMemberIds.set(t.id, new Set(t.member_user_ids));
    }

    // Find which conversations belong to which team
    const claimed = new Set<string>();
    const teamGroups: { team: Team; convs: typeof conversations }[] = [];

    for (const t of allTeams) {
      const memberSet = teamMemberIds.get(t.id)!;
      const teamConvs = conversations.filter(c => memberSet.has(c.participant_id));
      if (teamConvs.length > 0) {
        teamGroups.push({ team: t, convs: teamConvs });
        for (const c of teamConvs) claimed.add(c.id);
      }
    }

    const individual = conversations.filter(c => !claimed.has(c.id));
    return { teamGroups, individual };
  }, [conversations, persistentTeams]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--t-subtle-bg)' }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageTour tourId="page-chat" steps={chatTourSteps} />
      <div className="flex items-center justify-between mb-6">
        <ChalkText size="lg">Messages</ChalkText>
        <button data-tour="chat-new-message" onClick={openContactPicker}
          className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
          style={{ background: 'rgba(255,220,100,0.1)', color: 'rgba(255,220,100,0.8)', border: '1px solid rgba(255,220,100,0.15)' }}>
          New Message
        </button>
      </div>

      {(!conversations || conversations.length === 0) ? (
        <div className="text-center py-12">
          <ChalkText size="md">No conversations yet</ChalkText>
          <p className="mt-2" style={{ color: 'var(--t-subtle-text)', fontSize: '12px' }}>
            Start a new message to begin chatting.
          </p>
        </div>
      ) : (
        <div data-tour="chat-conversations" className="space-y-4">
          {/* Team groups at top — collapsed, click to expand */}
          {groupedConversations.teamGroups.map(({ team, convs }) => {
            const totalUnread = convs.reduce((sum, c) => sum + c.unread_count, 0);
            const isExpanded = expandedChatTeams.has(team.id);
            const lastConv = convs
              .filter(c => c.last_message_at)
              .sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''))[0];
            const lastMsg = lastConv?.last_message || null;
            const lastMsgAt = lastConv?.last_message_at || null;
            const lastSenderId = lastConv?.last_message_sender_id || null;
            const lastSender =
              lastSenderId === user?.id ? 'You' :
              members.find(m => m.user_id === lastSenderId)?.name ||
              (lastSenderId === lastConv?.participant_id ? lastConv?.participant_name : null) ||
              null;
            return (
              <div key={team.id}>
                <button
                  onClick={() => setExpandedChatTeams(prev => {
                    const next = new Set(prev);
                    if (next.has(team.id)) next.delete(team.id); else next.add(team.id);
                    return next;
                  })}
                  className="w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors"
                  style={{ background: 'var(--t-subtle-bg)', border: `1px solid var(--t-section-border)` }}
                >
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'rgba(212,175,55,0.12)', color: 'var(--color-accent)' }}>
                    {isExpanded ? '▾' : '▸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>{team.name}</span>
                      <span className="text-[9px]" style={{ color: 'var(--t-subtle-text)' }}>{convs.length} members</span>
                    </div>
                    {!isExpanded && lastMsg && (
                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--t-subtle-text)' }}>
                        {lastSender ? `${lastSender}: ` : ''}{lastMsg}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {lastMsgAt && (
                      <span className="text-[9px]" style={{ color: 'var(--t-subtle-text)' }}>
                        {formatMessageTime(lastMsgAt)}
                      </span>
                    )}
                    {totalUnread > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'hsl(0,70%,50%)', color: 'white', minWidth: '18px', textAlign: 'center' }}>
                        {totalUnread}
                      </span>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {convs.map(conv => (
                      <ConversationRow key={conv.id} conv={conv} productionId={id!} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Individual conversations at bottom */}
          {groupedConversations.individual.length > 0 && (
            <div>
              {groupedConversations.teamGroups.length > 0 && (
                <p className="text-[9px] uppercase tracking-widest font-bold mb-1.5 px-1" style={{ color: 'var(--t-subtle-text)' }}>
                  Direct Messages
                </p>
              )}
              <div className="space-y-1">
                {groupedConversations.individual.map(conv => (
                  <ConversationRow key={conv.id} conv={conv} productionId={id!} navigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={showPicker}
        onClose={() => { setShowPicker(false); setSelectedContact(null); setSelectedTeam(null); }}
        title={selectedTeam ? `Message ${selectedTeam.name}` : selectedContact ? `Message ${selectedContact.name}` : 'New Message'}
        confirmLabel={(selectedContact || selectedTeam) ? 'Send' : undefined}
        onConfirm={(selectedContact || selectedTeam) ? handleSend : undefined}
        isLoading={sendingMessage}
      >
        {!selectedContact && !selectedTeam ? (
          /* ── Contact / Team picker ── */
          loadingContacts ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 w-full rounded animate-pulse" style={{ background: 'var(--t-subtle-bg)' }} />)}</div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {/* Teams section — director/staff only */}
              {isDirectorOrStaff && teams.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-muted">Teams</p>
                  <div className="space-y-1">
                    {teams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => pickTeam(t)}
                        className="w-full text-left p-3 rounded-md hover:bg-surface-raised transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>
                            {t.name}
                          </span>
                          <span className="text-[9px] text-muted">{t.member_count} members</span>
                        </div>
                        <Badge>team</Badge>
                      </button>
                    ))}
                    {/* Broadcast to all cast */}
                    <button
                      onClick={() => { setSelectedTeam({ id: 'cast', name: 'All Cast', member_count: castContacts.length, member_user_ids: [] }); setMessageBody(''); }}
                      className="w-full text-left p-3 rounded-md hover:bg-surface-raised transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">All Cast</span>
                        <span className="text-[9px] text-muted">{castContacts.length} members</span>
                      </div>
                      <Badge>broadcast</Badge>
                    </button>
                  </div>
                </div>
              )}

              {/* Staff / Director contacts */}
              {staffContacts.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-muted">Staff & Direction</p>
                  <div className="space-y-1">
                    {staffContacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => pickContact(c)}
                        className="w-full text-left p-3 rounded-md hover:bg-surface-raised transition-colors flex items-center gap-2"
                      >
                        <span className="text-foreground">{c.name}</span>
                        <Badge>{c.role}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual cast contacts */}
              {castContacts.length > 0 && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-2 text-muted">
                    {isDirectorOrStaff ? 'Individual Cast' : 'Contacts'}
                  </p>
                  <div className="space-y-1">
                    {castContacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => pickContact(c)}
                        className="w-full text-left p-3 rounded-md hover:bg-surface-raised transition-colors flex items-center gap-2"
                      >
                        <span className="text-foreground">{c.name}</span>
                        <Badge>{c.role}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {contacts.length === 0 && teams.length === 0 && (
                <p className="text-muted">No contacts available.</p>
              )}
            </div>
          )
        ) : (
          /* ── Compose message ── */
          <div className="space-y-3">
            <button
              onClick={() => { setSelectedContact(null); setSelectedTeam(null); }}
              className="text-xs text-muted hover:text-foreground cursor-pointer"
            >
              &larr; Pick a different {selectedTeam ? 'team' : 'contact'}
            </button>
            {selectedTeam && (
              <p className="text-[10px] text-muted">
                This will send a message to {selectedTeam.id === 'cast' ? 'all cast members' : `everyone in ${selectedTeam.name}`}.
              </p>
            )}
            <textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value.slice(0, 2000))}
              placeholder="Type your message..."
              className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border text-foreground placeholder-muted resize-none min-h-[100px] focus:outline-none focus:ring-2 focus:ring-accent"
              rows={4}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <p className="text-xs text-muted text-right">{messageBody.length}/2000</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
