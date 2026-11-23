"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import PerformanceReview from "./performance-review";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../auth-provider";
import usePracticeHistory from "./use-practice-history";
import { createPracticeSession } from "../../lib/practice-history";
import { savePracticeRecording } from "../../lib/practice-recordings";

const apiUrl = process.env.NEXT_PUBLIC_FIDDLE_API_URL ?? "http://127.0.0.1:8000";

async function post(path, body, signal) {
  let response;
  try {
    response = await fetch(new URL(path, apiUrl), { method: "POST", body, signal });
  } catch (failure) {
    if (signal?.aborted) {
      throw failure;
    }
    throw new Error("Could not reach Fiddle. Check that the FastAPI server is running.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" && (response.status < 500 || (path === "/performance-feedback" && response.status === 502))
      ? data.detail : `Fiddle could not complete this request (HTTP ${response.status}).`);
  }
  return data;
}

export default function PracticePage() {
  return (
    <Suspense fallback={<main className="site-width"><p role="status">Opening Practice Studio…</p></main>}>
      <PracticeEntry />
    </Suspense>
  );
}

function PracticeEntry() {
  const requestedSession = useSearchParams().get("session");
  const { client, user, loading } = useAuth();
  if (loading) {
    return <main className="site-width"><p role="status">Opening Practice Studio…</p></main>;
  }
  if (requestedSession && !user) {
    return <main className="site-width"><p><Link href="/login">Sign in</Link> to reopen a saved session.</p></main>;
  }
  return <PracticeWorkspace key={`${user?.id ?? "guest"}:${requestedSession ?? "new"}`} client={client} user={user} requestedSession={requestedSession} />;
}

function PracticeWorkspace({ client, user, requestedSession }) {
  const [file, setFile] = useState(null);
  const [score, setScore] = useState(null);
  const [page, setPage] = useState(1);
  const [pageResults, setPageResults] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [stopMode, setStopMode] = useState(null);
  const currentRun = useRef(null);
  const tipsHeading = useRef(null);
  const active = useRef(true);
  const history = usePracticeHistory(client, user?.id);
  const [comparing, setComparing] = useState(false);
  const [recordingSession, setRecordingSession] = useState(null);
  const recordingSessionId = useRef(null);
  const [reopening, setReopening] = useState(Boolean(requestedSession));
  const [reopenError, setReopenError] = useState("");
  const [reopenVersion, setReopenVersion] = useState(0);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      currentRun.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!requestedSession) {
      return;
    }
    const run = new AbortController();
    setReopening(true);
    setReopenError("");
    history.reopen(requestedSession, post, run.signal).then((loaded) => {
      if (run.signal.aborted) {
        return;
      }
      setFile(loaded.file);
      setScore(loaded.score);
      setPageResults(loaded.pageResults);
      setPage(1);
    }).catch((failure) => {
      if (!run.signal.aborted) {
        setReopenError(failure.message);
      }
    }).finally(() => {
      if (!run.signal.aborted) {
        setReopening(false);
      }
    });
    return () => {
      run.abort();
    };
  }, [requestedSession, reopenVersion]);

  function selectFile(event) {
    history.reset();
    setRecordingSession(null);
    recordingSessionId.current = null;
    setFile(event.target.files[0] ?? null);
    setScore(null);
    setPage(1);
    setPageResults({});
    setStopMode(null);
    setError("");
  }

  async function upload(event) {
    event.preventDefault();
    if (!file || busy || history.saving || reopening || requestedSession || comparing) {
      return;
    }
    history.reset();
    setRecordingSession(null);
    recordingSessionId.current = null;
    if (file.size > 15 * 1024 * 1024) {
      setError("Choose a PDF up to 15 MB.");
      return;
    }
    setBusy("upload");
    setError("");
    setPage(1);
    setPageResults({});
    setScore(null);
    setStopMode(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const uploaded = await post("/upload", body);
      if (!active.current) {
        return;
      }
      setScore(uploaded);
      await history.prepare(file, uploaded);
      if (!active.current) {
        return;
      }
      const numbers = Array.from({ length: uploaded.page_count }, (_, index) => index + 1);
      await generateTips(uploaded, numbers);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(null);
    }
  }

  async function generateTips(uploaded, numbers) {
    if (currentRun.current || numbers.length === 0) {
      return;
    }
    const run = new AbortController();
    currentRun.current = run;
    setStopMode(null);
    try {
      for (const number of numbers) {
        if (run.signal.aborted) {
          break;
        }
        setBusy(number);
        let result;
        try {
          result = await post(`/scores/${encodeURIComponent(uploaded.file_id)}/pages/${number}/practice-tips`, undefined, run.signal);
        } catch (failure) {
          result = { error: failure.message };
        }
        if (run.signal.aborted) {
          break;
        }
        setPageResults((previous) => ({ ...previous, [number]: result }));
        await history.savePage(number, result);
      }
    } finally {
      currentRun.current = null;
      setBusy(null);
    }
  }

  async function saveComparison(recording) {
    if (!user || !client) {
      throw new Error("Sign in to save your recording.");
    }
    if (score && !history.session) {
      throw new Error("Save the score and tips first, then retry saving this comparison.");
    }
    let session = history.session ?? recordingSession;
    if (!session) {
      if (!recordingSessionId.current) {
        recordingSessionId.current = crypto.randomUUID();
      }
      session = await createPracticeSession(client, user.id, null, null, recordingSessionId.current);
      setRecordingSession(session);
    }
    return savePracticeRecording(client, user.id, session.id, recording);
  }

  function stopTips(mode) {
    if (!currentRun.current) {
      return;
    }
    currentRun.current.abort();
    setStopMode(mode);
    if (mode === "finish") {
      document.getElementById("performance-title")?.focus();
      return;
    }
    tipsHeading.current?.focus();
  }

  const result = pageResults[page];
  const remainingPages = score
    ? Array.from({ length: score.page_count }, (_, index) => index + 1).filter((number) => !pageResults[number])
    : [];
  const previewPath = score && (page === 1
    ? score.preview_url
    : `/scores/${encodeURIComponent(score.file_id)}/pages/${page}/preview`);

  return (
    <main className="site-width">
      <p className="eyebrow">VIOLIN PRACTICE</p>
      <h1>Practice Studio</h1>
      <p>Bring your score and get focused practice tips.</p>
      <form className="panel upload-form" onSubmit={upload}>
        <label htmlFor="score">Sheet music PDF · up to 15 MB</label>
        <input id="score" type="file" accept=".pdf,application/pdf" onChange={selectFile} disabled={Boolean(busy) || history.saving || reopening || Boolean(requestedSession) || comparing} required />
        <button className="primary-button" disabled={!file || Boolean(busy) || history.saving || reopening || Boolean(requestedSession) || comparing}>{busy === "upload" ? "Uploading…" : "Upload score"}</button>
      </form>
      {requestedSession && <p><Link href="/practice">Start a new session</Link></p>}
      {reopening && <p role="status">Reopening your saved score and tips…</p>}
      {reopenError && (
        <div role="alert">
          <p className="error">{reopenError}</p>
          <button type="button" onClick={() => setReopenVersion(reopenVersion + 1)}>Try reopening again</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {user ? (
        <div>
          <p role="status">{history.saving ? "Saving your score and tips…" : history.saveError ? "Some work has not been saved." : history.session ? "Score and completed tips saved to your account." : "New scores and completed tips will save to your account."}</p>
          <Link href="/history">Practice history</Link>
          {history.saveError && (
            <div role="alert">
              <p className="error">{history.saveError} Your current results are still visible.</p>
              <button type="button" disabled={Boolean(busy) || history.saving} onClick={() => history.retry(file, score, pageResults)}>Retry saving</button>
            </div>
          )}
        </div>
      ) : <p><Link href="/login">Sign in</Link> to save future scores and tips.</p>}
      <div className="workspace">
        <section className="panel" aria-labelledby="score-title">
          <h2 id="score-title">Score preview</h2>
          {score ? (
            <>
              <p>{file.name} · Page {page} of {score.page_count}</p>
              <a href={new URL(`/files/${encodeURIComponent(score.file_id)}.pdf`, apiUrl).href}>Open PDF ↗</a>
              {score.page_count > 1 && (
                <nav className="page-controls" aria-label="Score pages">
                  <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous page</button>
                  <button type="button" disabled={page === score.page_count} onClick={() => setPage(page + 1)}>Next page</button>
                </nav>
              )}
              <img className="score-preview" src={new URL(previewPath, apiUrl).href} alt={`Page ${page} of your uploaded score`} />
            </>
          ) : <p>Upload a PDF to see your score here.</p>}
        </section>
        <section className="panel" aria-labelledby="tips-title" aria-busy={busy === page}>
          <h2 id="tips-title" ref={tipsHeading} tabIndex={-1}>{score ? `Practice tips · Page ${page}` : "Practice tips"}</h2>
          <p role="status" hidden={typeof busy !== "number" && !stopMode}>
            {stopMode === "cancel" ? "Tip generation canceled." : stopMode === "finish" ? "Finished early. Your completed tips are still available." : typeof busy === "number" ? `Analyzing page ${busy} of ${score.page_count}…` : ""}
          </p>
          {typeof busy === "number" && !stopMode && (
            <div className="page-controls">
              <button type="button" onClick={() => stopTips("cancel")}>Cancel generating tips</button>
              <button type="button" onClick={() => stopTips("finish")}>Finish generating tips early</button>
            </div>
          )}
          {!busy && !reopening && !reopenError && remainingPages.length > 0 && (
            <button className="primary-button" type="button" onClick={() => generateTips(score, remainingPages)}>Generate remaining tips</button>
          )}
          {!score && <p>Upload a score to generate tips for every page.</p>}
          {score && !result && busy !== page && <p>{stopMode ? "This page hasn’t been analyzed yet." : "This page is waiting for analysis."}</p>}
          {result?.error && <p className="error" role="alert">{result.error}</p>}
          {result?.warning && <p>{result.warning}</p>}
          {result && !result.error && (
            <div className="tips"><Markdown>{result.practice_tips?.trim() || "No specific practice tips were returned."}</Markdown></div>
          )}
          {result?.error && <button className="primary-button" type="button" onClick={() => generateTips(score, [page])} disabled={Boolean(busy)}>Retry this page</button>}
        </section>
      </div>
      <PerformanceReview key={score?.file_id ?? "standalone"} post={post} canSave={Boolean(user)} onSave={saveComparison}
        disabled={reopening || Boolean(reopenError) || busy === "upload"} onBusyChange={setComparing} />
    </main>
  );
}
