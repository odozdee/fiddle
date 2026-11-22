"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../auth-provider";
import { listPracticeSessions } from "../../lib/practice-history";

function SessionList({ client, userId }) {
  const [sessions, setSessions] = useState([]);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listPracticeSessions(client, userId, offset).then((rows) => {
      if (active) {
        setSessions(rows);
      }
    }).catch((failure) => {
      if (active) {
        setError(failure.message);
      }
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [client, userId, offset, retry]);

  if (loading) {
    return <p role="status">Loading your practice history…</p>;
  }

  if (error) {
    return (
      <div role="alert">
        <p className="error">{error}</p>
        <button type="button" onClick={() => setRetry(retry + 1)}>Try again</button>
      </div>
    );
  }

  return (
    <>
      {sessions.length === 0 && <p>No saved sessions on this page yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {sessions.map((session) => (
          <li className="panel" key={session.id} style={{ marginBottom: "1rem" }}>
            <h2><Link href={`/practice?session=${encodeURIComponent(session.id)}`}>{session.title}</Link></h2>
            <p>{session.page_count ? `${session.page_count} score pages` : "Recording comparison"}</p>
            <time dateTime={session.created_at}>
              {new Date(session.created_at).toLocaleDateString()}
            </time>
          </li>
        ))}
      </ul>
      <nav className="page-controls" aria-label="Practice history pages">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>
          Previous
        </button>
        <button type="button" disabled={sessions.length < 20} onClick={() => setOffset(offset + 20)}>
          Next
        </button>
      </nav>
    </>
  );
}

export default function HistoryPage() {
  const { client, user, loading } = useAuth();

  useEffect(() => {
    document.title = "Practice history";
  }, []);

  let content;
  if (loading) {
    content = <p role="status">Checking your account…</p>;
  } else if (user && client) {
    content = <SessionList key={user.id} client={client} userId={user.id} />;
  } else {
    content = <p><Link href="/login">Sign in</Link> to view your saved sessions.</p>;
  }

  return (
    <main className="site-width">
      <h1>Practice history</h1>
      <p><Link href="/practice">Open Practice Studio</Link></p>
      {content}
    </main>
  );
}
