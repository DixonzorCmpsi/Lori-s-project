"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProductionSettingsPage() {
  const { productionId } = useParams<{ productionId: string }>();
  const router = useRouter();
  const [production, setProduction] = useState<{
    name: string; firstRehearsal: string; openingNight: string;
    closingNight: string; isArchived: boolean; archivedAt: string | null;
  } | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/productions/${productionId}`).then(r => r.json()).then((data) => {
      setProduction(data);
      setName(data.name || "");
    });
  }, [productionId]);

  async function saveName() {
    setSaving(true);
    const res = await fetch(`/api/productions/${productionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) toast.success("Production updated");
    else toast.error("Failed to update");
    setSaving(false);
  }

  async function archive() {
    if (!confirm("Archiving will make this production read-only and deactivate the invite link. You can restore it within 90 days.")) return;
    const res = await fetch(`/api/productions/${productionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    });
    if (res.ok) {
      toast.success("Production archived");
      setProduction((p) => p ? { ...p, isArchived: true, archivedAt: new Date().toISOString() } : p);
    }
  }

  async function unarchive() {
    const res = await fetch(`/api/productions/${productionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: false }),
    });
    if (res.ok) {
      toast.success("Production restored");
      setProduction((p) => p ? { ...p, isArchived: false, archivedAt: null } : p);
    } else {
      const data = await res.json();
      toast.error(data.message || "Cannot restore");
    }
  }

  async function deleteProduction() {
    if (!confirm("This will permanently delete the production and all associated data. This cannot be undone.")) return;
    const res = await fetch(`/api/productions/${productionId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Production deleted");
      router.push("/");
    }
  }

  if (!production) return <div className="animate-pulse h-8 bg-surface-raised rounded w-48" />;

  const isArchived = production.isArchived;
  const archivedDate = production.archivedAt ? new Date(production.archivedAt) : null;
  const ninetyDaysExpired = archivedDate && (Date.now() - archivedDate.getTime()) > 90 * 24 * 60 * 60 * 1000;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-serif font-bold">Production Settings</h1>

      {/* Details */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Production Details</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <div className="flex gap-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <Button onClick={saveName} disabled={saving || name === production.name}>Save</Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <label className="block text-muted-foreground">First Rehearsal</label>
            <p>{production.firstRehearsal}</p>
          </div>
          <div>
            <label className="block text-muted-foreground">Opening Night</label>
            <p>{production.openingNight}</p>
          </div>
          <div>
            <label className="block text-muted-foreground">Closing Night</label>
            <p>{production.closingNight}</p>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="border border-destructive/30 rounded-md p-4 space-y-4">
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>

        {!isArchived && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Archive Production</p>
              <p className="text-xs text-muted-foreground">Make read-only. Restorable within 90 days.</p>
            </div>
            <Button variant="outline" onClick={archive}>Archive</Button>
          </div>
        )}

        {isArchived && !ninetyDaysExpired && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Restore Production</p>
              <p className="text-xs text-muted-foreground">Archived {archivedDate?.toLocaleDateString()}. Restore to full access.</p>
            </div>
            <Button variant="outline" onClick={unarchive}>Restore</Button>
          </div>
        )}

        {isArchived && ninetyDaysExpired && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">PII deleted — cannot be restored</p>
            <p className="text-xs text-muted-foreground">This production's personal data was automatically deleted 90 days after archiving.</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-destructive/20">
          <div>
            <p className="text-sm font-medium">Delete Production</p>
            <p className="text-xs text-muted-foreground">Permanently delete all data. Cannot be undone.</p>
          </div>
          <Button variant="destructive" onClick={deleteProduction}>Delete</Button>
        </div>
      </section>
    </div>
  );
}
