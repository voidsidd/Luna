"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type SessionState = {
  email?: string;
  status: "local" | "signed_out" | "signed_in";
};

export function AuthPanel({ onSessionChange }: { onSessionChange: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<SessionState>({ status: isSupabaseConfigured ? "signed_out" : "local" });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user.email ? { status: "signed_in", email: data.session.user.email } : { status: "signed_out" });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession?.user.email ? { status: "signed_in", email: nextSession.user.email } : { status: "signed_out" });
      onSessionChange();
    });

    return () => data.subscription.unsubscribe();
  }, [onSessionChange]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured || !supabase) return;
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setEmail("");
      setPassword("");
      setMessage("Signed in.");
      return;
    }

    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) setMessage(signUp.error.message);
    else {
      setEmail("");
      setPassword("");
      setMessage("Account created. Check email confirmation settings in Supabase if sign-in is blocked.");
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMessage("Signed out.");
  }

  if (session.status === "local") {
    return (
      <section className="rounded-md border border-[var(--line)] bg-white">
        <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <UserRound size={18} />
          <h2 className="font-semibold">Account</h2>
        </header>
        <div className="p-4 text-sm leading-6 text-[var(--muted)]">Running locally. Add Supabase env vars to enable Auth and synced storage.</div>
      </section>
    );
  }

  if (session.status === "signed_in") {
    return (
      <section className="rounded-md border border-[var(--line)] bg-white">
        <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <UserRound size={18} />
          <h2 className="font-semibold">Account</h2>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-sm text-[var(--muted)]">Signed in as {session.email}</p>
          <button className="flex w-full items-center justify-center gap-2 rounded border border-[var(--line)] px-4 py-2 font-semibold" onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
          {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[var(--line)] bg-white">
      <header className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <UserRound size={18} />
        <h2 className="font-semibold">Account</h2>
      </header>
      <form className="space-y-3 p-4" onSubmit={submit}>
        <input className="w-full rounded border border-[var(--line)] px-3 py-2" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input
          className="w-full rounded border border-[var(--line)] px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="flex w-full items-center justify-center gap-2 rounded bg-ink px-4 py-2 font-semibold text-white">
          <LogIn size={16} />
          Sign in or create account
        </button>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </form>
    </section>
  );
}
