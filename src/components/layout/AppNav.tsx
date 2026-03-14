"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth, getDisplayNameFromAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/profile", label: "Profile" },
  { href: "/ask", label: "Ask" },
  { href: "/history", label: "History" },
];

export function AppNav() {
  const pathname = usePathname();
  const { user, profile, isLoggedIn, loading, signOut } = useAuth();
  const displayName = getDisplayNameFromAuth(profile, user);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          Future Me
        </Link>
        <nav className="flex items-center gap-8">
          {navItems
            .filter((item) => item.href !== "/")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  pathname === item.href && "text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          {/* Auth slot: mutually exclusive — either logged-in UI or Sign in, never both */}
          {loading ? (
            <span className="h-10 w-24 rounded-2xl bg-muted/50" aria-hidden />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                {displayName}
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-2xl border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
