"use client";

import { useEffect, useState } from "react";

const MAX_SECONDS = 60;
const SAMPLE_RATE = 22050;

function youtubeVideo(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return null;
    }
    const [, route, videoId] = url.pathname.split("/");
    let id = null;
    if (url.hostname === "youtu.be") {
      id = route;
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (route === "watch") {
        id = url.searchParams.get("v");
      }
      if (["shorts", "live", "embed"].includes(route)) {
        id = videoId;
      }
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id ?? "") ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch {
    return null;
  }
}

async function wavExcerpt(blob, label) {
  if (blob.size > 15 * 1024 * 1024) {
    throw new Error(`${label} must be under 15 MB.`);
  }
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    let audio;
    try {
      audio = await context.decodeAudioData(await blob.arrayBuffer());
    } catch {
      throw new Error(`${label} could not be opened. Try a WAV, MP3, or M4A excerpt.`);
    }
    if (audio.length < 2 * SAMPLE_RATE || audio.length > MAX_SECONDS * SAMPLE_RATE) {
      throw new Error(`${label} must be between 2 and 60 seconds.`);
    }

    const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
    const bytes = new DataView(new ArrayBuffer(44 + audio.length * 2));
    const text = (offset, value) => [...value].forEach((character, index) => {
      bytes.setUint8(offset + index, character.charCodeAt(0));
    });
    text(0, "RIFF");
    bytes.setUint32(4, bytes.byteLength - 8, true);
    text(8, "WAVEfmt ");
    bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 1, true);
    bytes.setUint16(22, 1, true);
    bytes.setUint32(24, SAMPLE_RATE, true);
    bytes.setUint32(28, SAMPLE_RATE * 2, true);
    bytes.setUint16(32, 2, true);
    bytes.setUint16(34, 16, true);
    text(36, "data");
    bytes.setUint32(40, audio.length * 2, true);
    for (let frame = 0; frame < audio.length; frame++) {
      const mono = channels.reduce((sum, channel) => sum + channel[frame], 0) / channels.length;
      bytes.setInt16(44 + frame * 2, Math.round(Math.max(-1, Math.min(1, mono)) * 32767), true);
    }
    return new Blob([bytes.buffer], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}

export default function PerformanceReview({ post, canSave = false, onSave, disabled = false, onBusyChange }) {
  const [videoUrl, setVideoUrl] = useState("");
  const [referenceStart, setReferenceStart] = useState("0");
  const [referenceDuration, setReferenceDuration] = useState("30");
  const [take, setTake] = useState(null);
  const [playback, setPlayback] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [unsavedRecording, setUnsavedRecording] = useState(null);
  const [saved, setSaved] = useState(false);
  const video = youtubeVideo(videoUrl);
  const videoId = video && new URL(video).searchParams.get("v");

  useEffect(() => {
    if (!take) {
      setPlayback("");
      return;
    }
    const url = URL.createObjectURL(take);
    setPlayback(url);
    return () => URL.revokeObjectURL(url);
  }, [take]);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  async function persist(recording) {
    setSaveError("");
    try {
      await onSave(recording);
      setSaved(true);
      setUnsavedRecording(null);
    } catch (failure) {
      setSaveError(failure.message);
      setUnsavedRecording(recording);
    }
  }

  async function retrySave() {
    if (!unsavedRecording || busy) {
      return;
    }
    setBusy(true);
    try {
      await persist(unsavedRecording);
    } finally {
      setBusy(false);
    }
  }

  async function analyze(event) {
    event.preventDefault();
    if (busy || disabled || !take || !video) {
      return;
    }
    setError("");
    setResult(null);
    setSaveError("");
    setUnsavedRecording(null);
    setSaved(false);
    setBusy(true);
    try {
      const body = new FormData();
      const audio = await wavExcerpt(take, "Your recording");
      body.append("take", audio, "take.wav");
      body.append("reference_url", video);
      body.append("reference_start", referenceStart);
      body.append("reference_duration", referenceDuration);
      const feedback = await post("/performance-feedback", body);
      setResult(feedback);
      if (canSave && onSave) {
        await persist({
          id: crypto.randomUUID(),
          audio,
          feedback,
          referenceUrl: video,
          referenceStart,
          referenceDuration,
        });
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel performance-panel" aria-labelledby="performance-title">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-number" aria-hidden="true">03</span>
          <h3 id="performance-title" tabIndex={-1}>Compare your playing</h3>
        </div>
      </div>
      <form className="performance-form" onSubmit={analyze}>
        <p>Upload your playing and choose a YouTube performance of the same passage. Set the start time to where your excerpt begins in the video. Use a reference you have permission to analyze.</p>
        <div className="performance-fields">
          <label>
            Your recording · 2–60 seconds
            <input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm" disabled={busy || disabled}
              onChange={(event) => { setTake(event.target.files[0] ?? null); setResult(null); setError(""); }} required />
            <small>Up to 15 MB. Choose a format your browser can play.</small>
          </label>
          <label>
            YouTube reference
            <input type="url" value={videoUrl} placeholder="https://www.youtube.com/watch?v=…" disabled={busy || disabled}
              onChange={(event) => { setVideoUrl(event.target.value); setResult(null); }} required />
            {videoUrl && !video && <small>Enter a valid YouTube video link.</small>}
          </label>
          <label>
            Reference start time · seconds
            <input type="number" min="0" max="36000" step="1" value={referenceStart} disabled={busy || disabled}
              onChange={(event) => { setReferenceStart(event.target.value); setResult(null); }} required />
            <small>Find the first note of the passage you played.</small>
          </label>
          <label>
            Reference excerpt length · seconds
            <input type="number" min="2" max="60" step="1" value={referenceDuration} disabled={busy || disabled}
              onChange={(event) => { setReferenceDuration(event.target.value); setResult(null); }} required />
            <small>End at the same musical point as your take, even if the tempo differs.</small>
          </label>
        </div>
        {video && <iframe className="lesson-video" title="Your YouTube reference"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${Math.floor(Number(referenceStart) || 0)}`}
          loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />}
        {playback && <audio controls src={playback} aria-label="Play your uploaded recording" />}
        <div className="performance-actions">
          <button type="submit" disabled={!take || !video || busy || disabled}>Compare performances</button>
        </div>
        {busy && <p role="status">Retrieving the YouTube excerpt and comparing performances…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {result && canSave && (
          <div role="status">
            {saved && <p>Recording and feedback saved to your account.</p>}
            {saveError && (
              <>
                <p className="error">{saveError} Your feedback is still available below.</p>
                <button type="button" onClick={retrySave} disabled={busy || disabled}>Retry saving comparison</button>
              </>
            )}
          </div>
        )}
        {result && (
          <div className="performance-result" role="status">
            <p><strong>Pacing</strong> · Your take {result.take_seconds}s · Reference {result.reference_seconds}s</p>
            <p>{result.pacing}</p>
            <p><strong>Pitch pattern</strong></p>
            <p>{result.pitch_feedback}</p>
            <small>Recording quality, accompaniment, and different passages can affect this comparison.</small>
          </div>
        )}
      </form>
      {result?.lessons?.length > 0 && (
        <div className="technique-lessons">
          <h3>Practice with a lesson</h3>
          {result.lessons.map((lesson) => (
            <article key={lesson.video_id}>
              <h4>{lesson.title}</h4>
              <p>{lesson.teacher} · {lesson.reason}</p>
              <iframe className="lesson-video" title={lesson.title}
                src={`https://www.youtube-nocookie.com/embed/${lesson.video_id}`}
                loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
              <a href={`https://www.youtube.com/watch?v=${lesson.video_id}`} target="_blank" rel="noreferrer">
                Open on YouTube if the player is unavailable ↗
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
