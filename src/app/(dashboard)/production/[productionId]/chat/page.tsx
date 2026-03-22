"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

type Conversation = {
  conversationId: string;
  participant: { userId: string; name: string; role: string } | null;
  lastMessage: { body: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
};

type Contact = {
  userId: string;
  name: string;
  role: string;
};

export default function ChatPage() {
  const { productionId } = useParams<{ productionId: string }>();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [productionId]);

  async function loadConversations() {
    const res = await fetch(`/api/productions/${productionId}/chat/conversations`);
    if (res.ok) setConversations(await res.json());
    setLoading(false);
  }

  async function openContactPicker() {
    const res = await fetch(`/api/productions/${productionId}/chat/contacts`);
    if (res.ok) {
      setContacts(await res.json());
      setShowContacts(true);
    }
  }

  async function startConversation(participantId: string) {
    const res = await fetch(`/api/productions/${productionId}/chat/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/production/${productionId}/chat/${data.conversationId}`);
    }
  }

  // Total unread across all conversations
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold">
          Chat
          {totalUnread > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </h1>
        <Button variant="outline" size="sm" onClick={openContactPicker}>
          <Plus className="h-4 w-4 mr-1" /> New Message
        </Button>
      </div>

      {/* Contact picker */}
      {showContacts && (
        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Select a contact</h3>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts available.</p>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => (
                <button
                  key={c.userId}
                  onClick={() => { setShowContacts(false); startConversation(c.userId); }}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-raised transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.role}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowContacts(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Conversation list */}
      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-surface-raised rounded-md animate-pulse" />)}
        </div>
      ) : conversations.length === 0 && !showContacts ? (
        <div className="mt-12 text-center py-16" style={{
          background: "radial-gradient(ellipse at center, hsl(38 75% 55% / 0.05), transparent 70%)"
        }}>
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No conversations yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openContactPicker}>
            Start a conversation
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-1">
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => router.push(`/production/${productionId}/chat/${c.conversationId}`)}
              className="w-full flex items-center gap-3 rounded-md px-4 py-3 text-left hover:bg-surface-raised transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                {c.participant?.name?.[0] ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{c.participant?.name ?? "Unknown"}</p>
                  {c.lastMessage?.createdAt && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(c.lastMessage.createdAt), { addSuffix: false })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground truncate">
                    {c.lastMessage?.body ?? "No messages yet"}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 ml-2 inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold w-5 h-5">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
