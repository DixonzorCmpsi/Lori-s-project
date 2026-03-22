"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function JoinPage() {
  return (
    <Suspense>
      <JoinHandler />
    </Suspense>
  );
}

function JoinHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = searchParams.get("token");

  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Store token for after auth
    if (token) {
      sessionStorage.setItem("pendingInviteToken", token);
      // Clean URL
      window.history.replaceState({}, "", "/join");
    }
  }, [token]);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      // Redirect to login — token is in sessionStorage
      router.push("/login?callbackUrl=/join");
      return;
    }

    // Authenticated — try to join
    const storedToken = sessionStorage.getItem("pendingInviteToken") || token;
    if (!storedToken) {
      setError("No invite token provided.");
      return;
    }

    if (joining) return;
    setJoining(true);

    fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: storedToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        sessionStorage.removeItem("pendingInviteToken");
        if (data.productionId) {
          if (data.alreadyMember) {
            router.push(`/production/${data.productionId}/bulletin`);
          } else {
            router.push(`/production/${data.productionId}/profile`);
          }
        } else {
          setError(data.message || "Failed to join production.");
        }
      })
      .catch(() => setError("Something went wrong. Please try again."));
  }, [status, token, router, joining]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-serif font-bold">Joining Production...</h1>
        {error ? (
          <>
            <p className="text-destructive">{error}</p>
            <Link href="/login" className="text-accent hover:underline">Go to Login</Link>
          </>
        ) : (
          <p className="text-muted-foreground">Please wait...</p>
        )}
      </div>
    </main>
  );
}
