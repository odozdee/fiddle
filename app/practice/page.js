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
import SavedRecordings from "./saved-recordings";

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
  const recordingSection = useRef(null);
  const active = useRef(true);
  const history = usePracticeHistory(client, user?.id);
  const [comparing, setComparing] = useState(false);
  const [recordingSession, setRecordingSession] = useState(null);
  const recordingSessionId = useRef(null);
  const [savedRecordings, setSavedRecordings] = useState([]);
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
      setSavedRecordings(loaded.recordings);
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
    setSavedRecordings([]);
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
    setSavedRecordings([]);
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
    const saved = await savePracticeRecording(client, user.id, session.id, recording);
    setSavedRecordings((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
    return saved;
  }

  function stopTips(mode) {
    if (!currentRun.current) {
      return;
    }
    currentRun.current.abort();
    setStopMode(mode);
    if (mode === "finish") {
      recordingSection.current?.focus();
      recordingSection.current?.scrollIntoView({ block: "start" });
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

  const failedPages = score
    ? Array.from({ length: score.page_count }, (_, index) => index + 1).filter((number) => pageResults[number]?.error)
    : [];
  const analyzing = typeof busy === "number" && !stopMode;
  const pageIsAnalyzing = analyzing && busy === page;
  const completedPages = Object.keys(pageResults).length;
  const progressText = busy === "upload"
    ? "Uploading your score…"
    : analyzing
      ? `Analyzing page ${busy} of ${score.page_count}…`
      : score && (stopMode
        ? `${stopMode === "cancel" ? "Generation canceled" : "Finished early"} · ${completedPages} of ${score.page_count} pages processed.`
        : failedPages.length
        ? `Analysis finished. ${failedPages.length} of ${score.page_count} pages failed.`
        : remainingPages.length
          ? `${completedPages} of ${score.page_count} pages processed. Generate remaining tips whenever you’re ready.`
          : "Analysis complete for all pages.");

  return (
    <>
      <main className="site-width">
        {requestedSession && <p><Link href="/practice">Start a new session</Link></p>}
        <div className="practice-save-bar">
          <div role="status">{reopening ? "Reopening your saved practice…" : user ? history.saving ? "Saving your practice…" : history.saveError ? "Some work has not been saved." : history.session ? "Saved to your account." : "Your new sessions will save to your account." : "Guest practice is not saved. Sign in to keep future sessions."}</div>
          {user ? <Link href="/history">Practice history ↗</Link> : <Link href="/login">Sign in ↗</Link>}
        </div>
        {history.saveError && <div className="practice-save-error" role="alert"><p>{history.saveError} Your current results are still visible.</p><button type="button" disabled={history.saving || Boolean(busy) || reopening || comparing} onClick={() => history.retry(file, score, pageResults).catch(() => {})}>Retry saving score and tips</button></div>}
        {reopenError && <div className="practice-save-error" role="alert"><p>{reopenError}</p><button type="button" onClick={() => setReopenVersion(reopenVersion + 1)}>Retry opening session</button><Link href="/history">Back to history</Link></div>}
        <section className="hero" aria-labelledby="hero-title">
          <svg className="hero-staff" viewBox="0 0 720 440" fill="none" aria-hidden="true">
            {[0, 21, 42, 63, 84].map((offset) => (
              <path key={offset} d="M-10 350C177 442 282 128 485 161S631 261 751 128"
                transform={`translate(0 ${offset})`} />
            ))}
          </svg>
          <div className="hero-copy">
            <p className="eyebrow hero-label"><span />AI VIOLIN PRACTICE ASSISTANT</p>
            <h1 id="hero-title">Practice <em>studio.</em></h1>
            <p className="hero-description">Upload a score for practice tips, or compare your playing with a YouTube reference. No PDF is needed to compare recordings.</p>
          </div>
          <form className="upload-card" onSubmit={upload}>
            <h2>Upload your score</h2>
            <p className="upload-description">Choose a sheet music PDF up to 15 MB.</p>
            <label className={`file-picker${busy ? " is-disabled" : ""}`}>
              <input type="file" accept=".pdf,application/pdf" onChange={selectFile}
                disabled={Boolean(busy) || comparing || reopening || history.saving || Boolean(requestedSession)} required aria-label="Choose sheet music PDF" />
              <span className="file-symbol" aria-hidden="true">↥</span>
              <span className="file-copy">
                <strong>{file ? file.name : "Choose a PDF"}</strong>
                <small>{file ? "Click to choose a different score" : "Select a file from your device"}</small>
              </span>
            </label>
            <button className="primary-button" disabled={!file || Boolean(score) || Boolean(busy) || comparing || reopening || history.saving || Boolean(requestedSession)}>
              {busy === "upload" ? "Uploading…" : "Upload and analyze"}
            </button>
            {error && <p className="error" role="alert">{error}</p>}
          </form>
        </section>

        <section className="studio" aria-labelledby="studio-title">
          <div className="studio-heading">
            <div>
              <h2 id="studio-title">Practice Room</h2>
            </div>
            <div className="session-status" role="status">
              <span className={`status-dot${busy ? " is-working" : ""}`} aria-hidden="true" />
              {progressText || "Waiting for a score"}
            </div>
          </div>
          {analyzing && (
            <>
              <progress className="analysis-progress" value={completedPages} max={score.page_count}
                aria-label="Pages analyzed" />
              <div className="retry-controls analysis-actions">
                <button type="button" onClick={() => stopTips("cancel")}>
                  Cancel generating tips
                </button>
                <button type="button" onClick={() => stopTips("finish")}>
                  Finish generating tips early
                </button>
              </div>
            </>
          )}
          {!busy && !reopening && !reopenError && remainingPages.length > 0 && (
            <div className="retry-controls analysis-actions">
              <button type="button" onClick={() => generateTips(score, remainingPages)}>
                Generate remaining tips
              </button>
            </div>
          )}

          <div className="workspace">
            <section className="panel score-panel" aria-labelledby="preview-heading">
              <div className="panel-heading">
                <div className="panel-title">
                  <span className="panel-number" aria-hidden="true">01</span>
                  <h3 id="preview-heading">Score Preview</h3>
                </div>
                {score && <span className="page-badge">Page {page} / {score.page_count}</span>}
              </div>
              {score ? (
                <>
                  <div className="score-toolbar">
                    <span className="filename" title={file.name}>{file.name}</span>
                    <a href={new URL(`/files/${encodeURIComponent(score.file_id)}.pdf`, apiUrl).href}>
                      Open PDF <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                  {score.page_count > 1 && (
                    <nav className="page-controls" aria-label="Score pages">
                      <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>
                        <span aria-hidden="true">←</span> Previous page
                      </button>
                      <button type="button" onClick={() => setPage(page + 1)} disabled={page === score.page_count}>
                        Next page <span aria-hidden="true">→</span>
                      </button>
                    </nav>
                  )}
                  <div className="score-surface">
                    <img src={new URL(previewPath, apiUrl).href}
                      alt={`Page ${page} of the uploaded score`} />
                  </div>
                </>
              ) : (
                <div className="empty-score">
                  <div className="paper-sketch" aria-hidden="true"><MusicMark /></div>
                  <h4>Your score goes here</h4>
                  <p>Upload your sheet music to see the pages here.</p>
                </div>
              )}
            </section>

            <section className="panel tips-panel" aria-labelledby="tips-heading" aria-busy={pageIsAnalyzing}>
              <div className="panel-heading">
                <div className="panel-title">
                  <span className="panel-number" aria-hidden="true">02</span>
                  <h3 id="tips-heading" ref={tipsHeading} tabIndex={-1}>Practice tips</h3>
                </div>
                {score && <span className="page-badge">Page {page}</span>}
              </div>
              <div className="tips-body">
                {!score && (
                  <div className="tips-intro">
                    <span className="coach-mark" aria-hidden="true">✦</span>
                    <h4>A closer look at the music</h4>
                    <p>Fiddle reads each page and highlights passages worth practicing, with focused exercises for the score in front of you.</p>
                  </div>
                )}
                {score && !result && (
                  <p className="note-card">
                    {pageIsAnalyzing
                      ? `Reading page ${page} and generating tips…`
                      : !analyzing || stopMode
                        ? `Page ${page} hasn’t been analyzed yet.`
                        : `Page ${page} is waiting for analysis.`}
                  </p>
                )}
                {result?.error && <p className="note-card error" role="alert">{result.error}</p>}
                {result && !result.error && (
                  <div className="tips">
                    {result.warning && <p className="recognition-warning">{result.warning}</p>}
                    {result.practice_tips?.trim()
                      ? <Markdown>{result.practice_tips}</Markdown>
                      : <p className="note-card">No specific tips were returned for this page.</p>}
                  </div>
                )}
                {(failedPages.length > 0 || (result && !result.practice_tips?.trim())) && (
                  <div className="retry-controls">
                    {failedPages.length > 0 && (
                      <button type="button" onClick={() => generateTips(score, failedPages)} disabled={Boolean(busy)}>
                        Retry failed pages
                      </button>
                    )}
                    {result && !result.practice_tips?.trim() && (
                      <button type="button" onClick={() => generateTips(score, [page])} disabled={Boolean(busy)}>
                        Retry this page
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
          <div ref={recordingSection} className="recording-section" tabIndex={-1}>
            <PerformanceReview key={score?.file_id ?? "standalone"} post={post} canSave={Boolean(user)} disabled={reopening || busy === "upload" || Boolean(reopenError)} onBusyChange={setComparing}
              onSave={saveComparison} />
            {user && <SavedRecordings key={history.session?.id ?? recordingSession?.id ?? "new"} client={client} userId={user.id} recordings={savedRecordings} />}
          </div>
        </section>
        <footer className="footer"><span>Fiddle Studio</span><span>Made for the practice room.</span></footer>
      </main>
    </>
  );
}

function MusicMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M12 22V9l13-3v13M12 12l13-3" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="8.5" cy="22.5" rx="4" ry="2.9" fill="currentColor" transform="rotate(-19 8.5 22.5)" />
      <ellipse cx="21.5" cy="19.5" rx="4" ry="2.9" fill="currentColor" transform="rotate(-19 21.5 19.5)" />
    </svg>
  );
}
