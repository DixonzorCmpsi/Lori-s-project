"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validateAge(dateStr: string) {
    if (!dateStr) return;
    const [y, m, d] = dateStr.split("-").map(Number);
    const birth = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const mo = today.getMonth() - birth.getMonth();
    if (mo < 0 || (mo === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 13) {
      setError("You must be 13 or older to use this app.");
    } else {
      setError("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error) return;
    setLoading(true);

    const res = await fetch("/api/account/age-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateOfBirth: dob }),
    });

    const data = await res.json();
    if (res.ok) {
      router.push("/");
    } else {
      setError(data.fields?.[0]?.message || data.message || "Failed");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-bold">Complete Your Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We need your date of birth to verify your age.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dob" className="block text-sm font-medium mb-1">Date of Birth</label>
            <input
              id="dob"
              type="date"
              required
              value={dob}
              onChange={(e) => { setDob(e.target.value); validateAge(e.target.value); }}
              onBlur={(e) => validateAge(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {error && <p className="text-xs text-destructive mt-1" aria-live="polite">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading || !!error || !dob}>
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </main>
  );
}
