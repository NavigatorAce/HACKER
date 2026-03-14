"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const { isLoggedIn, loading } = useAuth();

  return (
    <div className="relative min-h-[90vh] overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />

      <section className="relative section-padding flex flex-col items-center justify-center text-center">
        {/* Hero */}
        <div className="mb-6 animate-fade-in">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            A letter from the future
          </span>
        </div>

        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight text-foreground max-w-3xl mx-auto leading-[1.15] animate-fade-in">
          What would the future you say?
        </h1>

        <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed animate-fade-in-up [animation-delay:0.1s] opacity-0 [animation-fill-mode:forwards]">
          Chat with yourself 5, 10, or 15 years from now. Not fortune-telling — a reflective conversation grounded in who you are today.
        </p>

        {/* CTA: show different buttons based on login state */}
        {!loading && (
          <div className="mt-14 animate-fade-in-up [animation-delay:0.2s] opacity-0 [animation-fill-mode:forwards]">
            {isLoggedIn ? (
              <Link
                href="/ask"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
              >
                Start chatting ☕
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
              >
                Meet your future self
              </Link>
            )}
          </div>
        )}

        {/* Feature highlights */}
        <div className="mt-24 grid gap-8 md:grid-cols-3 max-w-4xl mx-auto animate-fade-in-up [animation-delay:0.35s] opacity-0 [animation-fill-mode:forwards]">
          <div className="rounded-2xl border border-border/40 bg-card/60 p-6 text-left backdrop-blur-sm">
            <div className="mb-3 text-2xl">🪞</div>
            <h3 className="font-display text-lg text-foreground mb-2">Build your profile</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Age, personality, goals, fears, struggles — a snapshot of who you are right now.
            </p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/60 p-6 text-left backdrop-blur-sm">
            <div className="mb-3 text-2xl">⏳</div>
            <h3 className="font-display text-lg text-foreground mb-2">Pick a time horizon</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              5, 10, or 15 years ahead. Each version of you has walked a different length of road.
            </p>
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/60 p-6 text-left backdrop-blur-sm">
            <div className="mb-3 text-2xl">💬</div>
            <h3 className="font-display text-lg text-foreground mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask anything. Your future self answers with warmth, honesty, and your own personality.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
