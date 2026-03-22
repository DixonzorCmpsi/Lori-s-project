"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const pending = searchParams.get("pending");

  const [status, setStatus] = useState<"pending" | "verifying" | "success" | "error">(
    pending ? "pending" : token ? "verifying" : "pending"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;

    async function verify() {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("Your email has been verified. You can now log in.");
      } else {
        setStatus("error");
        setMessage(data.message || "Verification failed.");
      }
    }

    verify();
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-bold font-serif">Email Verification</h1>

        {status === "pending" && (
          <p className="text-muted-foreground">
            Check your email for a verification link. It may take a minute to arrive.
          </p>
        )}

        {status === "verifying" && (
          <p className="text-muted-foreground">Verifying your email...</p>
        )}

        {status === "success" && (
          <>
            <p className="text-success">{message}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/80"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-destructive">{message}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Back to Login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
