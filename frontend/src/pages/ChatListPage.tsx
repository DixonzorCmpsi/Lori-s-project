import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { getConversations, getContacts, sendMessage } from '@/services/chat';
import { formatRelativeTime } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

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
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <Button onClick={openContactPicker}>New Message</Button>
      </div>

      {(!conversations || conversations.length === 0) ? (
        <EmptyState title="No conversations" description="Start a new message to begin chatting." />
      ) : (
        <div className="space-y-1">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => navigate(`/production/${id}/chat/${conv.id}`)}
              className="w-full text-left p-4 rounded-md bg-surface border border-border hover:bg-surface-raised transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{conv.participant_name}</span>
                  <Badge>{conv.participant_role}</Badge>
                </div>
                {conv.last_message && (
                  <p className="text-sm text-muted truncate mt-0.5">{conv.last_message}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {conv.last_message_at && (
                  <span className="text-xs text-muted">{formatRelativeTime(conv.last_message_at)}</span>
                )}
                {conv.unread_count > 0 && (
                  <Badge variant="warning">{conv.unread_count}</Badge>
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
