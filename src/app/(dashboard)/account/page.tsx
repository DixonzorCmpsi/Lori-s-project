"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    name: string; email: string; ageRange: string;
    hasPassword: boolean; hasGoogle: boolean;
  } | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/account").then(r => r.json()).then((data) => {
      setProfile(data);
      setName(data.name || "");
    });
  }, []);

  async function saveName() {
    setSaving(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) toast.success("Name updated");
    else toast.error("Failed to update name");
    setSaving(false);
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Password changed");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } else {
      toast.error(data.fields?.[0]?.message || data.message || "Failed");
    }
  }

  async function logoutAll() {
    if (!confirm("This will sign you out everywhere. Continue?")) return;
    await fetch("/api/auth/logout-all", { method: "POST" });
    signOut({ callbackUrl: "/login" });
  }

  async function deleteAccount() {
    if (!confirm("This will permanently delete your account and all associated data. This cannot be undone.")) return;
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      signOut({ callbackUrl: "/login" });
      toast.success("Account deleted");
    }
  }

  if (!profile) return <div className="flex h-screen"><Sidebar /><main className="flex-1 p-8"><div className="animate-pulse h-8 bg-surface-raised rounded w-48" /></main></div>;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-lg mx-auto space-y-8">
          <h1 className="text-2xl font-serif font-bold">Account Settings</h1>

          {/* Profile */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Profile</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <div className="flex gap-2">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
                  className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                <Button onClick={saveName} disabled={saving || name === profile.name}>Save</Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Age Range</label>
              <p className="text-sm text-muted-foreground">{profile.ageRange || "Not set"}</p>
            </div>
          </section>

          {/* Password */}
          {profile.hasPassword && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Change Password</h2>
              <input type="password" placeholder="Current password" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <input type="password" placeholder="New password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <input type="password" placeholder="Confirm new password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              <Button onClick={changePassword} disabled={!currentPassword || !newPassword}>Change Password</Button>
            </section>
          )}

          {/* Sessions */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Sessions</h2>
            <Button variant="outline" onClick={logoutAll}>Log out of all devices</Button>
          </section>

          {/* Danger Zone */}
          <section className="space-y-3 border border-destructive/30 rounded-md p-4">
            <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all associated data.
            </p>
            <Button variant="destructive" onClick={deleteAccount}>Delete My Account</Button>
          </section>
        </div>
      </main>
    </div>
  );
}
