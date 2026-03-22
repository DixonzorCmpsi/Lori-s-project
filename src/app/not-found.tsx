import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-serif font-bold">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/80"
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
