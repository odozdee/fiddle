"use client";

import { useState } from "react";
import { recordingPlayback } from "../../lib/practice-recordings";

const videoStyle = {
  display: "block",
  width: "100%",
  maxWidth: "42rem",
  aspectRatio: "16 / 9",
  border: 0,
  marginBlock: "1rem",
};

export default function SavedRecordings({ client, userId, recordings }) {
  const [playback, setPlayback] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function play(recording) {
    if (busy) {
      return;
    }
    setBusy(recording.id);
    setError("");
    try {
      const url = await recordingPlayback(client, userId, recording.take_path);
      setPlayback((previous) => ({ ...previous, [recording.id]: url }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(null);
    }
  }

  if (!recordings.length) {
    return null;
  }

  return (
    <section className="panel" style={{ marginTop: "1rem" }} aria-labelledby="saved-recordings-title">
      <h2 id="saved-recordings-title">Saved comparisons</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {recordings.map((recording) => {
        const feedback = recording.feedback ?? {};
        const referenceId = feedback.reference_video_id;
        const hasReference = /^[a-zA-Z0-9_-]{11}$/.test(referenceId ?? "");
        const lessons = Array.isArray(feedback.lessons) ? feedback.lessons : [];
        return (
          <details key={recording.id} style={{ marginBottom: "1rem" }}>
            <summary>Comparison · {new Date(recording.created_at).toLocaleString()}</summary>
            <div>
              <button type="button" onClick={() => play(recording)} disabled={Boolean(busy)}>
                {busy === recording.id ? "Loading recording…" : "Load my recording"}
              </button>
              {playback[recording.id] && (
                <audio controls src={playback[recording.id]} aria-label="Saved performance recording"
                  style={{ display: "block", maxWidth: "100%", marginBlock: "1rem" }}
                  onError={() => setError("The playback link may have expired. Load your recording again.")} />
              )}
              <p><strong>Pacing</strong> · {feedback.pacing}</p>
              <p><strong>Pitch pattern</strong> · {feedback.pitch_feedback}</p>
              {hasReference && (
                <iframe style={videoStyle} title="Saved YouTube reference"
                  src={`https://www.youtube-nocookie.com/embed/${referenceId}?start=${Math.floor(Number(recording.reference_start) || 0)}`}
                  loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
              )}
              {lessons.filter((lesson) => /^[a-zA-Z0-9_-]{11}$/.test(lesson.video_id)).map((lesson) => (
                <article key={lesson.video_id}>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.teacher} · {lesson.reason}</p>
                  <iframe style={videoStyle} title={lesson.title}
                    src={`https://www.youtube-nocookie.com/embed/${lesson.video_id}`}
                    loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
                  <a href={`https://www.youtube.com/watch?v=${lesson.video_id}`} target="_blank" rel="noreferrer">
                    Open lesson on YouTube ↗
                  </a>
                </article>
              ))}
            </div>
          </details>
        );
      })}
    </section>
  );
}
