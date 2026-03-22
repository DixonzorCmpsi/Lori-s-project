"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NewTheaterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", city: "", state: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Redirect guard: if user already has a theater, go to dashboard
  useEffect(() => {
    fetch("/api/theaters")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          router.replace("/");
        }
      });
  }, [router]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const res = await fetch("/api/theaters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (res.status === 409) {
      router.replace("/");
      return;
    }

    if (!res.ok && data.fields) {
      const fieldErrors: Record<string, string> = {};
      for (const f of data.fields) fieldErrors[f.field] = f.message;
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    if (res.ok) {
      router.push("/production/new");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-serif font-bold">Add Your Theater</h1>
      <p className="text-muted-foreground mt-1">Register your theater or school.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Theater / School Name</label>
          <input
            id="name"
            type="text"
            required
            maxLength={200}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Lincoln High School"
          />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium mb-1">City</label>
          <input
            id="city"
            type="text"
            required
            maxLength={100}
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
        </div>

        <div>
          <label htmlFor="state" className="block text-sm font-medium mb-1">State</label>
          <input
            id="state"
            type="text"
            required
            maxLength={100}
            value={form.state}
            onChange={(e) => updateField("state", e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.state && <p className="text-xs text-destructive mt-1">{errors.state}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Add Theater"}
        </Button>
      </form>
    </div>
  );
}
