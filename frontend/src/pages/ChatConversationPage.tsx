import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getMessages, sendMessage, markRead, deleteMessage } from '@/services/chat';
import { formatRelativeTime } from '@/utils/format';
import { MAX_LENGTHS, ROLES } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Message } from '@/types';

export function ChatConversationPage() {
  const { id, convId } = useParams<{ id: string; convId: string }>();
  const { user } = useAuth();
  const { userRole, members } = useProduction();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useApi(
    () => getMessages(id!, convId!), [id, convId]
  );
  const messages = data?.messages || [];

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const isDirector = userRole === ROLES.DIRECTOR;

  // Find the other participant's ID from the conversation
  const otherParticipant = members.find(m => {
    const msgs = messages;
    return msgs.some((msg: Message) => msg.sender_id === m.user_id && m.user_id !== user?.id);
  });

  useEffect(() => {
    if (id && convId) markRead(id, convId).catch(() => {});
  }, [id, convId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    if (!body.trim() || !id || !otherParticipant) return;
    setSending(true);
    try {
      await sendMessage(id, otherParticipant.user_id, body.trim());
      setBody('');
      refetch();
    } catch (err: any) {
      toast(err.message || 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleDelete(messageId: string) {
    if (!id) return;
    try {
      await deleteMessage(id, messageId);
      toast('Message deleted');
      refetch();
    } catch {
      toast('Failed to delete', 'error');
    }
  }

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-3/4" />)}</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-xl font-bold text-foreground mb-4">
        {otherParticipant?.name || 'Conversation'}
      </h1>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.filter((m: Message) => !m.is_deleted).map((msg: Message) => {
          const isMine = msg.sender_id === user?.id;
          const sender = members.find(m => m.user_id === msg.sender_id);
          const canDelete = isDirector || isMine;

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] p-3 rounded-lg ${
                isMine ? 'bg-accent/20 text-foreground' : 'bg-surface-raised border border-border text-foreground'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted">
                    {isMine ? 'You' : sender?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted">{formatRelativeTime(msg.created_at)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="text-xs text-destructive hover:underline mt-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LENGTHS.message_body))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 px-3 py-2 rounded-md bg-surface-raised border border-border text-foreground placeholder-muted resize-none min-h-[44px] max-h-32 focus:outline-none focus:ring-2 focus:ring-accent"
            rows={1}
          />
          <Button onClick={handleSend} isLoading={sending} disabled={!body.trim()}>
            Send
          </Button>
        </div>
        <p className="text-xs text-muted mt-1 text-right">{body.length}/{MAX_LENGTHS.message_body}</p>
      </div>
    </div>
  );
}
