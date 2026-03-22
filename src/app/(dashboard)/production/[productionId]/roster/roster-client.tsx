"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
  conflictsSubmitted: boolean;
};

type InviteInfo = {
  token: string;
  expiresAt: string;
  useCount: number;
  maxUses: number;
} | null;

export function RosterClient({
  productionId,
  members,
  currentUserRole,
  currentUserId,
  invite,
}: {
  productionId: string;
  members: Member[];
  currentUserRole: string;
  currentUserId: string;
  invite: InviteInfo;
}) {
  const router = useRouter();
  const [inviteData, setInviteData] = useState(invite);
  const isDirector = currentUserRole === "director";

  async function regenerateInvite() {
    const res = await fetch(`/api/productions/${productionId}/invite`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setInviteData({
        token: data.token,
        expiresAt: data.expiresAt,
        useCount: data.useCount,
        maxUses: data.maxUses,
      });
      toast.success("New invite link generated");
    }
  }

  function copyLink() {
    if (!inviteData) return;
    const url = `${window.location.origin}/join?token=${inviteData.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  }

  async function handleAction(userId: string, action: "promote" | "demote" | "remove" | "resetConflicts") {
    if (action === "promote" || action === "demote") {
      const role = action === "promote" ? "staff" : "cast";
      await fetch(`/api/productions/${productionId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
    } else if (action === "remove") {
      if (!confirm("Remove this member from the production? This cannot be undone.")) return;
      await fetch(`/api/productions/${productionId}/members/${userId}`, { method: "DELETE" });
    } else if (action === "resetConflicts") {
      if (!confirm("This will delete all conflicts for this member and allow them to re-submit. Continue?")) return;
      await fetch(`/api/productions/${productionId}/members/${userId}/conflicts`, { method: "DELETE" });
    }
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-serif font-bold">Members</h1>

      {/* Invite Link */}
      <div className="mt-6 rounded-md border border-border bg-card p-4">
        {inviteData ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded px-2 py-1 truncate font-mono">
                {`${typeof window !== "undefined" ? window.location.origin : ""}/join?token=${inviteData.token}`}
              </code>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={regenerateInvite}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires: {format(new Date(inviteData.expiresAt), "MMM d, yyyy")} | Used: {inviteData.useCount}/{inviteData.maxUses}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No invite link yet.</p>
            <Button size="sm" onClick={regenerateInvite}>Generate Invite Link</Button>
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Conflicts</th>
              {isDirector && <th className="py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-b border-border/50">
                <td className="py-3 pr-4">
                  <div>{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </td>
                <td className="py-3 pr-4 capitalize">{m.role}</td>
                <td className="py-3 pr-4">
                  {m.role === "cast" ? (
                    m.conflictsSubmitted
                      ? <span className="text-success text-xs">Submitted</span>
                      : <span className="text-warning text-xs">Pending</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">N/A</span>
                  )}
                </td>
                {isDirector && m.userId !== currentUserId && (
                  <td className="py-3">
                    <div className="flex gap-1 flex-wrap">
                      {m.role === "cast" && (
                        <Button variant="ghost" size="sm" onClick={() => handleAction(m.userId, "promote")}>
                          Promote
                        </Button>
                      )}
                      {m.role === "staff" && (
                        <Button variant="ghost" size="sm" onClick={() => handleAction(m.userId, "demote")}>
                          Demote
                        </Button>
                      )}
                      {m.role === "cast" && m.conflictsSubmitted && (
                        <Button variant="ghost" size="sm" onClick={() => handleAction(m.userId, "resetConflicts")}>
                          Reset Conflicts
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => handleAction(m.userId, "remove")}>
                        Remove
                      </Button>
                    </div>
                  </td>
                )}
                {isDirector && m.userId === currentUserId && <td className="py-3 text-xs text-muted-foreground">You</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
