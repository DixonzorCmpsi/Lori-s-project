"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CastProfilePage() {
  const { productionId } = useParams<{ productionId: string }>();
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", phone: "", roleCharacter: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    fetch(`/api/productions/${productionId}/profile`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.displayName) {
          setForm({
            displayName: data.displayName,
            phone: data.phone || "",
            roleCharacter: data.roleCharacter || "",
          });
          setHasProfile(true);
          if (data.headshotUrl) {
            setPhotoPreview(`/api/uploads/${data.headshotUrl}`);
          }
        }
      });
  }, [productionId]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors({ photo: "File must be under 5MB" });
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setErrors({ photo: "Only JPEG and PNG files are accepted" });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, photo: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const method = hasProfile ? "PATCH" : "POST";
    const res = await fetch(`/api/productions/${productionId}/profile`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok && data.fields) {
      const fieldErrors: Record<string, string> = {};
      for (const f of data.fields) fieldErrors[f.field] = f.message;
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    // Upload photo if selected
    if (photoFile) {
      const formData = new FormData();
      formData.append("file", photoFile);
      await fetch(`/api/productions/${productionId}/profile/headshot`, {
        method: "POST",
        body: formData,
      });
    }

    router.push(`/production/${productionId}/conflicts`);
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-serif font-bold">
        {hasProfile ? "Edit Profile" : "Welcome! Complete your profile"}
      </h1>
      <p className="text-muted-foreground mt-1">This info is visible to the Director and Staff.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-1">Full Name</label>
          <input id="displayName" type="text" required maxLength={200}
            value={form.displayName} onChange={(e) => updateField("displayName", e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          {errors.displayName && <p className="text-xs text-destructive mt-1">{errors.displayName}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone (optional)</label>
          <input id="phone" type="tel" maxLength={20}
            value={form.phone} onChange={(e) => updateField("phone", e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>

        <div>
          <label htmlFor="roleCharacter" className="block text-sm font-medium mb-1">Role / Character (optional)</label>
          <input id="roleCharacter" type="text" maxLength={200}
            value={form.roleCharacter} onChange={(e) => updateField("roleCharacter", e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Photo (optional)</label>
          {photoPreview && (
            <div className="mb-2">
              <img src={photoPreview} alt="Preview" className="w-[120px] h-[120px] rounded-full object-cover border border-border" />
            </div>
          )}
          <input type="file" accept="image/jpeg,image/png" onChange={handlePhoto}
            className="text-sm text-muted-foreground" />
          <p className="text-xs text-muted-foreground mt-1">JPEG or PNG, max 5MB</p>
          {errors.photo && <p className="text-xs text-destructive mt-1">{errors.photo}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving..." : "Save & Continue"}
        </Button>
      </form>
    </div>
  );
}
