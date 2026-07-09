"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IoArrowForwardOutline, IoLockClosedOutline } from "react-icons/io5";
import { createClient } from "@/lib/supabase/client";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

// Two-step login: the password field only appears after the email is
// confirmed to be a dashboard admin (is_dashboard_admin_email RPC). This also
// stops the dashboard acting as a password-checking oracle — credentials for
// non-admin Quad accounts are never sent to auth at all, and if the allowlist
// changes mid-flow we sign straight back out without confirming validity.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const NOT_ADMIN = "No dashboard admin account exists for that email.";

  const checkEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("is_dashboard_admin_email", {
      p_email: email.trim(),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data) {
      setError(NOT_ADMIN);
      return;
    }
    setStep("password");
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const [superRes, elonRes] = await Promise.all([
      supabase.rpc("is_app_super_admin"),
      supabase.rpc("is_elon_admin"),
    ]);
    if (!superRes.data && !elonRes.data) {
      await supabase.auth.signOut();
      setError(NOT_ADMIN); // same message as the email step — confirms nothing
      setStep("email");
      setPassword("");
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
          onSubmit={step === "email" ? checkEmail : signIn}
          className="space-y-4 rounded-card border border-hairline bg-card p-6"
        >
          {step === "email" ? (
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
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-field px-3 py-2">
                <span className="min-w-0 truncate text-sm">{email.trim()}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                    setError(null);
                  }}
                  className="shrink-0 text-xs font-medium text-maroon hover:underline"
                >
                  Change
                </button>
              </div>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </Field>
            </>
          )}
          {error && <ErrorNote text={error} />}
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            {step === "email" ? (
              <>
                Continue <IoArrowForwardOutline />
              </>
            ) : (
              <>
                <IoLockClosedOutline /> Sign in
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted">
            Authorized staff only. Accounts are managed in the Quad app.
          </p>
        </form>
      </div>
    </div>
  );
}
