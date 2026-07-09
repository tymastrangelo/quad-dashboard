"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IoLockClosedOutline } from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Quad" className="size-14 shrink-0 rounded-2xl" />
          <div className="text-center">
            <h1 className="text-xl font-bold">Quad Admin</h1>
            <p className="text-sm text-subtle">Sign in with your Quad account</p>
          </div>
        </div>
        <form
          onSubmit={signIn}
          className="space-y-4 rounded-card border border-hairline bg-card p-6"
        >
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {error && <ErrorNote text={error} />}
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            <IoLockClosedOutline /> Sign in
          </Button>
          <p className="text-center text-xs text-muted">
            Authorized staff only. Accounts are managed in the Quad app.
          </p>
        </form>
      </div>
    </div>
  );
}
