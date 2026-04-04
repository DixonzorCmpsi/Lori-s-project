import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { getConversations, getContacts, sendMessage } from '@/services/chat';
import { formatRelativeTime } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { ChalkText } from '@/components/theater/Chalkboard';

export function ChatListPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: conversations, isLoading, refetch } = useApi(() => getConversations(id!), [id]);
  const [showPicker, setShowPicker] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Compose state — after picking a contact
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string; role: string } | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  async function openContactPicker() {
    setShowPicker(true);
    setSelectedContact(null);
    setMessageBody('');
    setLoadingContacts(true);
    try {
      const data = await getContacts(id!);
      setContacts(data);
    } catch {
      toast('Failed to load contacts', 'error');
    } finally {
      setLoadingContacts(false);
    }
  }

  function pickContact(contact: { id: string; name: string; role: string }) {
    setSelectedContact(contact);
    setMessageBody('');
  }

  async function handleSendFirst() {
    if (!selectedContact || !messageBody.trim() || !id) return;
    setSendingMessage(true);
    try {
      const result = await sendMessage(id, selectedContact.id, messageBody.trim());
      toast('Message sent');
      setShowPicker(false);
      setSelectedContact(null);
      setMessageBody('');
      refetch();
      // Navigate to the conversation
      navigate(`/production/${id}/chat/${result.conversation_id}`);
    } catch (err: any) {
      toast(err.message || 'Failed to send', 'error');
    } finally {
      setSendingMessage(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <ChalkText size="lg">Messages</ChalkText>
        <button onClick={openContactPicker}
          className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
          style={{ background: 'rgba(255,220,100,0.1)', color: 'rgba(255,220,100,0.8)', border: '1px solid rgba(255,220,100,0.15)' }}>
          New Message
        </button>
      </div>

      {(!conversations || conversations.length === 0) ? (
        <div className="text-center py-12">
          <ChalkText size="md">No conversations yet</ChalkText>
          <p className="mt-2" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
            Start a new message to begin chatting.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => navigate(`/production/${id}/chat/${conv.id}`)}
              className="w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold"
                style={{ background: 'linear-gradient(135deg, hsl(25,20%,20%), hsl(25,15%,15%))', color: 'hsl(25,10%,60%)' }}>
                {(conv.participant_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'hsl(35,15%,75%)' }}>{conv.participant_name}</span>
                  <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'hsl(25,8%,50%)' }}>
                    {conv.participant_role}
                  </span>
                </div>
                {conv.last_message && (
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{conv.last_message}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {conv.last_message_at && (
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatRelativeTime(conv.last_message_at)}</span>
                )}
                {conv.unread_count > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'hsl(0,70%,50%)', color: 'white', minWidth: '18px', textAlign: 'center' }}>
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={showPicker}
        onClose={() => { setShowPicker(false); setSelectedContact(null); }}
        title={selectedContact ? `Message ${selectedContact.name}` : 'New Message'}
        confirmLabel={selectedContact ? 'Send' : undefined}
        onConfirm={selectedContact ? handleSendFirst : undefined}
        isLoading={sendingMessage}
      >
        {!selectedContact ? (
          /* Contact picker */
          loadingContacts ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : contacts.length === 0 ? (
            <p className="text-muted">No contacts available.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {contacts.map(c => (
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
          )
        ) : (
          /* Compose message */
          <div className="space-y-3">
            <button
              onClick={() => setSelectedContact(null)}
              className="text-xs text-muted hover:text-foreground cursor-pointer"
            >
              &larr; Pick a different contact
            </button>
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
                  handleSendFirst();
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
