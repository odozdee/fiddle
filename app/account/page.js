"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../auth-provider";

export default function AccountPage() {
  const { client, user, loading, error: sessionError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.has("error")) {
      setError("Your confirmation link has expired or is invalid. Try signing in or creating your account again.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function signOut() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
    } catch {
      setError("We couldn’t sign you out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="site-width account-page">
      <section className="auth-card" aria-labelledby="account-title">
        <h1 id="account-title">My account</h1>
        {loading ? <p role="status">Checking your account…</p> : user ? (
          <>
            <p className="account-email">Signed in as <strong>{user.email}</strong></p>
            <Link className="primary-button" href="/practice">Open Practice Studio <span aria-hidden="true">↗</span></Link>
            <Link className="account-history-link" href="/history">Open practice history ↗</Link>
            <button className="auth-text-button" type="button" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
          </>
        ) : (
          <p>{client ? "Sign in to view your account." : "Accounts aren’t available yet."} <Link href="/login">Sign in</Link>.</p>
        )}
        {(error || sessionError) && <p className="error" role="alert">{error || sessionError}</p>}
      </section>
    </main>
  );
}
