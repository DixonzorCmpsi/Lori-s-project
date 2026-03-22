"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateSchedule, type ScheduleInput, type GeneratedDate } from "@/shared/schedule/generator";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type WizardData = {
  name: string;
  estimatedCastSize: number;
  firstRehearsal: string;
  openingNight: string;
  closingNight: string;
  selectedDays: number[];
  startTime: string;
  endTime: string;
  blockedDates: string[];
  techWeekEnabled: boolean;
  techWeekDays: number;
  dressRehearsalEnabled: boolean;
};

const initial: WizardData = {
  name: "",
  estimatedCastSize: 30,
  firstRehearsal: "",
  openingNight: "",
  closingNight: "",
  selectedDays: [1, 3, 5],
  startTime: "18:00",
  endTime: "21:00",
  blockedDates: [],
  techWeekEnabled: true,
  techWeekDays: 5,
  dressRehearsalEnabled: true,
};

export default function NewProductionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initial);
  const [preview, setPreview] = useState<GeneratedDate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if user already has active production
  useEffect(() => {
    fetch("/api/productions").then(r => r.json()).then((prods) => {
      if (Array.isArray(prods)) {
        const active = prods.find((p: { isArchived: boolean }) => !p.isArchived);
        if (active) router.replace(`/production/${active.id}`);
      }
    });
  }, [router]);

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function generatePreview() {
    const input: ScheduleInput = {
      firstRehearsal: data.firstRehearsal,
      openingNight: data.openingNight,
      closingNight: data.closingNight,
      selectedDays: data.selectedDays,
      startTime: data.startTime,
      endTime: data.endTime,
      blockedDates: data.blockedDates,
      techWeekEnabled: data.techWeekEnabled,
      techWeekDays: data.techWeekDays,
      dressRehearsalEnabled: data.dressRehearsalEnabled,
    };
    const result = generateSchedule(input);
    setPreview(result.dates);
    setWarnings(result.warnings);
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!data.name && !!data.firstRehearsal && !!data.openingNight && !!data.closingNight;
      case 2: return data.selectedDays.length > 0;
      case 3: return !!data.startTime && !!data.endTime && data.startTime < data.endTime;
      default: return true;
    }
  }

  function next() {
    if (step === 6) {
      generatePreview();
    }
    setStep((s) => Math.min(s + 1, 7));
  }

  async function handleCreate() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/productions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok) {
      router.push(`/production/${result.id}`);
    } else {
      setError(result.message || "Failed to create production");
      setLoading(false);
    }
  }

  const typeColors: Record<string, string> = {
    regular: "bg-amber-600/20 text-amber-400",
    tech: "bg-blue-600/20 text-blue-400",
    dress: "bg-purple-600/20 text-purple-400",
    performance: "bg-red-600/20 text-red-400",
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-serif font-bold">Create Production</h1>

      {/* Stepper */}
      <div className="flex items-center gap-1 mt-4 mb-8">
        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              s === step ? "bg-accent text-accent-foreground" :
              s < step ? "bg-accent/30 text-accent" : "bg-muted text-muted-foreground"
            }`}>
              {s < step ? "✓" : s}
            </div>
            {s < 7 && <div className={`w-6 h-0.5 ${s < step ? "bg-accent/30" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Production Details */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Production Details</h2>
          <Field label="Production Name" value={data.name} onChange={(v) => update("name", v)} max={200} placeholder="Into the Woods" />
          <div>
            <label className="block text-sm font-medium mb-1">Estimated Cast Size</label>
            <input type="number" min={1} max={200} value={data.estimatedCastSize}
              onChange={(e) => update("estimatedCastSize", parseInt(e.target.value) || 1)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          </div>
          <Field label="First Rehearsal" value={data.firstRehearsal} onChange={(v) => update("firstRehearsal", v)} type="date" />
          <Field label="Opening Night" value={data.openingNight} onChange={(v) => update("openingNight", v)} type="date" />
          <Field label="Closing Night" value={data.closingNight} onChange={(v) => update("closingNight", v)} type="date" />
        </div>
      )}

      {/* Step 2: Rehearsal Days */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Rehearsal Days</h2>
          <p className="text-sm text-muted-foreground">Select which days of the week you rehearse.</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((name, i) => (
              <button key={i} type="button"
                onClick={() => {
                  const days = data.selectedDays.includes(i)
                    ? data.selectedDays.filter((d) => d !== i)
                    : [...data.selectedDays, i].sort();
                  update("selectedDays", days);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  data.selectedDays.includes(i) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}
              >{name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Rehearsal Times */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Rehearsal Times</h2>
          <Field label="Start Time" value={data.startTime} onChange={(v) => update("startTime", v)} type="time" />
          <Field label="End Time" value={data.endTime} onChange={(v) => update("endTime", v)} type="time" />
          {data.startTime >= data.endTime && data.endTime && (
            <p className="text-xs text-destructive">End time must be after start time</p>
          )}
        </div>
      )}

      {/* Step 4: Blocked Dates */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Blocked Dates</h2>
          <p className="text-sm text-muted-foreground">Add holidays, breaks, or other dates to skip.</p>
          <div className="flex gap-2">
            <input type="date" id="blocked-input"
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            <Button type="button" onClick={() => {
              const input = document.getElementById("blocked-input") as HTMLInputElement;
              if (input.value && !data.blockedDates.includes(input.value)) {
                update("blockedDates", [...data.blockedDates, input.value].sort());
                input.value = "";
              }
            }}>Add</Button>
          </div>
          {data.blockedDates.length > 0 && (
            <ul className="space-y-1">
              {data.blockedDates.map((d) => (
                <li key={d} className="flex items-center justify-between text-sm bg-muted rounded px-3 py-1">
                  <span className="font-mono">{d}</span>
                  <button type="button" onClick={() => update("blockedDates", data.blockedDates.filter((x) => x !== d))}
                    className="text-destructive text-xs hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Step 5: Tech Week */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Tech Week</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={data.techWeekEnabled}
              onChange={(e) => update("techWeekEnabled", e.target.checked)}
              className="rounded border-border" />
            <span className="text-sm">Include a tech week before opening?</span>
          </label>
          {data.techWeekEnabled && (
            <div>
              <label className="block text-sm font-medium mb-1">Number of tech days</label>
              <input type="number" min={1} max={14} value={data.techWeekDays}
                onChange={(e) => update("techWeekDays", parseInt(e.target.value) || 5)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>
          )}
        </div>
      )}

      {/* Step 6: Dress Rehearsal */}
      {step === 6 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Dress Rehearsal</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={data.dressRehearsalEnabled}
              onChange={(e) => update("dressRehearsalEnabled", e.target.checked)}
              disabled={!data.techWeekEnabled}
              className="rounded border-border" />
            <span className="text-sm">
              Include a dress rehearsal?
              {!data.techWeekEnabled && <span className="text-muted-foreground ml-1">(requires tech week)</span>}
            </span>
          </label>
        </div>
      )}

      {/* Step 7: Review */}
      {step === 7 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Review & Create</h2>
          <div className="bg-card border border-border rounded-md p-4 space-y-2 text-sm">
            <p><strong>Production:</strong> {data.name}</p>
            <p><strong>Cast size:</strong> {data.estimatedCastSize}</p>
            <p><strong>Dates:</strong> {data.firstRehearsal} to {data.closingNight}</p>
            <p><strong>Rehearsal days:</strong> {data.selectedDays.map((d) => DAYS[d]).join(", ")}</p>
            <p><strong>Times:</strong> {data.startTime}–{data.endTime}</p>
            {data.techWeekEnabled && <p><strong>Tech week:</strong> {data.techWeekDays} days</p>}
            {data.dressRehearsalEnabled && <p><strong>Dress rehearsal:</strong> Yes</p>}
          </div>

          {warnings.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-md p-3">
              {warnings.map((w, i) => <p key={i} className="text-sm text-warning">{w}</p>)}
            </div>
          )}

          <div className="space-y-1 max-h-64 overflow-y-auto border border-border rounded-md">
            {preview.length === 0 ? (
              <p className="text-sm text-destructive p-4">No rehearsal dates could be generated. Go back and adjust your settings.</p>
            ) : (
              preview.map((d) => (
                <div key={d.date} className="flex items-center justify-between px-3 py-2 text-sm border-b border-border last:border-0">
                  <span className="font-mono">{d.date}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[d.type]}`}>{d.type}</span>
                </div>
              ))
            )}
          </div>
          <p className="text-sm text-muted-foreground">{preview.length} dates generated</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-4">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 1))} disabled={step === 1}>
          Back
        </Button>
        {step < 7 ? (
          <Button onClick={next} disabled={!canAdvance()}>Next</Button>
        ) : (
          <Button onClick={handleCreate} disabled={loading || preview.length === 0}>
            {loading ? "Creating..." : "Create Production"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", max, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; max?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        maxLength={max} placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
    </div>
  );
}
