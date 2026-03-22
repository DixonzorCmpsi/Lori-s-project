"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

type RehearsalDate = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  isCancelled: boolean;
  note: string | null;
};

type ConflictEntry = {
  rehearsalDateId: string;
  reason: string;
};

const typeColors: Record<string, string> = {
  regular: "bg-amber-600/20 text-amber-400",
  tech: "bg-blue-600/20 text-blue-400",
  dress: "bg-purple-600/20 text-purple-400",
  performance: "bg-red-600/20 text-red-400",
};

function parseLocal(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function ConflictsPage() {
  const { productionId } = useParams<{ productionId: string }>();
  const [dates, setDates] = useState<RehearsalDate[]>([]);
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // dateId -> reason
  const [submitted, setSubmitted] = useState(false);
  const [existingConflicts, setExistingConflicts] = useState<{ rehearsalDateId: string; reason: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/productions/${productionId}/schedule`).then((r) => r.json()),
      fetch(`/api/productions/${productionId}/conflicts`).then((r) => r.json()),
    ]).then(([scheduleDates, conflictData]) => {
      setDates(scheduleDates.filter((d: RehearsalDate) => !d.isCancelled));
      if (conflictData.submitted) {
        setSubmitted(true);
        setExistingConflicts(conflictData.conflicts);
      }
      setLoading(false);
    });
  }, [productionId]);

  function toggleDate(dateId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(dateId)) {
        next.delete(dateId);
      } else {
        next.set(dateId, "");
      }
      return next;
    });
  }

  function updateReason(dateId: string, reason: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(dateId, reason);
      return next;
    });
  }

  async function handleSubmit() {
    if (!confirm("Once submitted, your conflicts cannot be changed. Continue?")) return;

    setSubmitting(true);
    const payload = {
      dates: Array.from(selected.entries()).map(([rehearsalDateId, reason]) => ({
        rehearsalDateId,
        reason: reason || undefined,
      })),
    };

    const res = await fetch(`/api/productions/${productionId}/conflicts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSubmitted(true);
      setExistingConflicts(
        Array.from(selected.entries()).map(([rehearsalDateId, reason]) => ({
          rehearsalDateId,
          reason: reason || null,
        }))
      );
      toast.success("Conflicts submitted");
    } else if (res.status === 409) {
      toast.error("Conflicts already submitted");
      setSubmitted(true);
    } else {
      const data = await res.json();
      toast.error(data.message || "Failed to submit");
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4 mt-8">
          <div className="h-8 bg-surface-raised rounded w-48" />
          <div className="h-4 bg-surface-raised rounded w-64" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-surface-raised rounded" />
          ))}
        </div>
      </div>
    );
  }

  // State 2: Already submitted (read-only)
  if (submitted) {
    const conflictDateIds = new Set(existingConflicts.map((c) => c.rehearsalDateId));
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-serif font-bold">Your Conflicts</h1>
        <p className="text-muted-foreground mt-1">
          You submitted {existingConflicts.length} conflict{existingConflicts.length !== 1 ? "s" : ""}.
          Contact your director if you need to make changes.
        </p>

        <div className="mt-6 space-y-2">
          {dates.map((d) => {
            const isConflict = conflictDateIds.has(d.id);
            const conflictReason = existingConflicts.find((c) => c.rehearsalDateId === d.id)?.reason;
            return (
              <div
                key={d.id}
                className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                  isConflict ? "bg-red-500/10 border-red-500/30" : "bg-card border-border"
                }`}
              >
                <div>
                  <span className="font-mono text-sm">{format(parseLocal(d.date), "MMM d EEE")}</span>
                  <span className="ml-3 text-sm text-muted-foreground">{d.startTime}–{d.endTime}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[d.type] ?? ""}`}>{d.type}</span>
                  {isConflict && <span className="ml-2 text-xs text-red-400">Unavailable</span>}
                  {conflictReason && <p className="text-xs text-muted-foreground mt-0.5">{conflictReason}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // State 1: Not yet submitted
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-serif font-bold">Mark Your Conflicts</h1>
      <p className="text-muted-foreground mt-1">
        Select the dates you <strong>cannot</strong> attend. This can only be submitted once.
      </p>

      <div className="mt-6 space-y-2">
        {dates.map((d) => {
          const isSelected = selected.has(d.id);
          return (
            <div key={d.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleDate(d.id)}
                className={`w-full flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors ${
                  isSelected ? "bg-red-500/10 border-red-500/30" : "bg-card border-border hover:bg-surface-raised"
                }`}
              >
                <div>
                  <span className="font-mono text-sm">{format(parseLocal(d.date), "MMM d EEE")}</span>
                  <span className="ml-3 text-sm text-muted-foreground">{d.startTime}–{d.endTime}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[d.type] ?? ""}`}>{d.type}</span>
                </div>
                {isSelected && <span className="text-red-400 text-sm">Unavailable ✓</span>}
              </button>

              {isSelected && (
                <input
                  type="text"
                  placeholder="Reason (optional, max 500 chars)"
                  maxLength={500}
                  value={selected.get(d.id) ?? ""}
                  onChange={(e) => updateReason(d.id, e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ml-4"
                  style={{ width: "calc(100% - 1rem)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selected: {selected.size} date{selected.size !== 1 ? "s" : ""}
        </p>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Conflicts"}
        </Button>
      </div>

      <p className="mt-2 text-xs text-warning">
        Once submitted, conflicts cannot be changed.
      </p>
    </div>
  );
}
