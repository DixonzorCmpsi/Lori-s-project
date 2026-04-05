import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getMessages, getConversations, sendMessage, markRead } from '@/services/chat';
import { formatMessageTime } from '@/utils/format';
import { MAX_LENGTHS } from '@/utils/constants';
import type { Message, Conversation } from '@/types';

export function ChatConversationPage() {
  const { id, convId } = useParams<{ id: string; convId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members } = useProduction();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useApi(
    () => getMessages(id!, convId!), [id, convId]
  );
  const { data: conversations } = useApi<Conversation[]>(
    () => getConversations(id!), [id]
  );
  const messages = data?.messages || [];

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Find the other participant
  const conv = conversations?.find(c => c.id === convId);
  const otherParticipant = conv
    ? members.find(m => m.user_id === conv.participant_id)
    : members.find(m => messages.some((msg: Message) => msg.sender_id === m.user_id && m.user_id !== user?.id));

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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--t-subtle-bg)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMobile ? 'h-[calc(100dvh-18rem)]' : 'h-[calc(100vh-8rem)]'}`}>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(`/production/${id}/chat`)}
          className="text-[10px] cursor-pointer px-2 py-1 rounded"
          style={{ color: 'var(--t-chalk-text)', background: 'rgba(255,255,255,0.06)' }}>
          &larr;
        </button>
        <h1 className="text-base font-semibold" style={{ color: 'var(--t-chalk-text)', fontFamily: '"Playfair Display", serif' }}>
          {otherParticipant?.name || 'Conversation'}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((msg: Message) => {
          const isMine = msg.sender_id === user?.id;
          const sender = members.find(m => m.user_id === msg.sender_id);

          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%] px-3 py-2 rounded-lg"
                style={{
                  background: isMine ? 'rgba(212,175,55,0.1)' : 'var(--t-subtle-bg)',
                  border: isMine ? '1px solid rgba(212,175,55,0.12)' : `1px solid var(--t-section-border)`,
                }}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-medium" style={{ color: isMine ? 'hsl(43,55%,55%)' : 'var(--t-subtle-text)' }}>
                    {isMine ? 'You' : sender?.name || 'Unknown'}
                  </span>
                  <span className="text-[9px]" style={{ color: 'var(--t-subtle-text)' }}>{formatMessageTime(msg.created_at)}</span>
                </div>
                <p className="text-[12px] whitespace-pre-wrap break-words" style={{ color: 'var(--t-subtle-text-bright)' }}>{msg.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="pt-3" style={{ borderTop: `1px solid var(--t-section-border)` }}>
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value.slice(0, MAX_LENGTHS.message_body))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-lg resize-none min-h-[44px] max-h-32 text-[12px] outline-none"
            style={{
              background: 'var(--t-subtle-bg)',
              border: `1px solid var(--t-section-border)`,
              color: 'var(--t-subtle-text-bright)',
            }}
            rows={1}
          />
          <button onClick={handleSend} disabled={!body.trim() || sending}
            className="px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest font-semibold cursor-pointer"
            style={{
              background: body.trim() ? 'rgba(212,175,55,0.15)' : 'var(--t-subtle-bg)',
              color: body.trim() ? 'hsl(43,60%,58%)' : 'var(--t-subtle-text)',
              border: '1px solid rgba(212,175,55,0.1)',
            }}>
            {sending ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-[9px] mt-1 text-right" style={{ color: 'var(--t-subtle-text)' }}>{body.length}/{MAX_LENGTHS.message_body}</p>
      </div>
    </div>
  );
}
