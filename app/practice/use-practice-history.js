"use client";

import { useRef, useState } from "react";
import { createPracticeSession, loadPracticeSession, savePracticePage } from "../../lib/practice-history";

export default function usePracticeHistory(client, userId) {
  const [session, setSession] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const currentSession = useRef(null);
  const sessionId = useRef(null);

  function reset() {
    currentSession.current = null;
    sessionId.current = null;
    setSession(null);
    setSaveError("");
  }

  async function ensureSession(file, score) {
    if (currentSession.current) {
      return currentSession.current;
    }
    if (!sessionId.current) {
      sessionId.current = crypto.randomUUID();
    }
    const saved = await createPracticeSession(client, userId, file, score, sessionId.current);
    currentSession.current = saved;
    setSession(saved);
    return saved;
  }

  async function save(operation) {
    if (!client || !userId) {
      return;
    }
    setSaving(true);
    try {
      await operation();
    } catch (failure) {
      setSaveError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  async function prepare(file, score) {
    await save(() => ensureSession(file, score));
  }

  async function reopen(id, upload, signal) {
    const loaded = await loadPracticeSession(client, userId, id);
    signal.throwIfAborted();
    let score = null;
    if (loaded.file) {
      const body = new FormData();
      body.append("file", loaded.file);
      score = await upload("/upload", body, signal);
    }
    signal.throwIfAborted();
    currentSession.current = loaded.session;
    sessionId.current = loaded.session.id;
    setSession(loaded.session);
    setSaveError("");
    return { ...loaded, score };
  }

  async function savePage(number, result) {
    if (!currentSession.current) {
      return;
    }
    const id = currentSession.current.id;
    await save(() => savePracticePage(client, userId, id, number, result));
  }

  async function retry(file, score, results) {
    if (saving) {
      return;
    }
    await save(async () => {
      const saved = await ensureSession(file, score);
      for (const [number, result] of Object.entries(results)) {
        await savePracticePage(client, userId, saved.id, Number(number), result);
      }
      setSaveError("");
    });
  }

  return { session, saving, saveError, reset, prepare, reopen, savePage, retry };
}
