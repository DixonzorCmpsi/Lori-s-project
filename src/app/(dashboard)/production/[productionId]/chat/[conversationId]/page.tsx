"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";

type Message = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
};

export default function ConversationPage() {
  const { productionId, conversationId } = useParams<{ productionId: string; conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(s => {
      if (s?.user?.id) setCurrentUserId(s.user.id);
    });
    loadMessages();
    markRead();

    // Poll for new messages every 5 seconds
    pollRef.current = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const res = await fetch(`/api/productions/${productionId}/chat/conversations/${conversationId}/messages`);
    if (res.ok) {
      setMessages(await res.json());
      setLoading(false);
    }
  }

  async function markRead() {
    await fetch(`/api/productions/${productionId}/chat/conversations/${conversationId}/mark-read`, {
      method: "POST",
    });
  }

  async function handleSend() {
    if (!input.trim()) return;
    setSending(true);

    const res = await fetch(`/api/productions/${productionId}/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: input.trim() }),
    });

    if (res.ok) {
      setInput("");
      loadMessages();
    } else if (res.status === 429) {
      toast.error("Rate limited. Max 30 messages per minute.");
    } else {
      const data = await res.json();
      toast.error(data.message || "Failed to send");
    }
    setSending(false);
  }

  async function handleDelete(msgId: string) {
    const res = await fetch(`/api/productions/${productionId}/chat/messages/${msgId}`, { method: "DELETE" });
    if (res.ok) {
      loadMessages();
    } else {
      const data = await res.json();
      toast.error(data.message || "Cannot delete");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function canDelete(msg: Message): boolean {
    if (msg.isDeleted) return false;
    if (msg.senderId === currentUserId) {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      return new Date(msg.createdAt).getTime() > fiveMinAgo;
    }
    return false; // Director deletion handled separately
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <Link href={`/production/${productionId}/chat`} className="md:hidden">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div className="w-2 h-2 rounded-full bg-green-500" title="Connected" />
        <span className="text-sm text-muted-foreground">Connected</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-surface-raised rounded-md animate-pulse" />)}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`group max-w-[75%] rounded-lg px-3 py-2 ${
                  isMine ? "bg-accent/20 text-foreground" : "bg-surface text-foreground"
                } ${msg.isDeleted ? "opacity-60 italic" : ""}`}>
                  {!isMine && (
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">{msg.senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.createdAt), "h:mm a")}
                    </span>
                    {canDelete(msg) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border pt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={2000}
          rows={1}
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-right mt-1">{input.length}/2000</p>
    </div>
  );
}
