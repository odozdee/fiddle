import { BUCKET, fail, requireOwner } from "./practice-history.js";

export async function savePracticeRecording(client, userId, sessionId, recording) {
  await requireOwner(client, userId);
  const id = recording.id;
  const takePath = `${userId}/${sessionId}/${id}.wav`;
  // Retrying a save uses the same recording ID, so an ambiguous response cannot duplicate it.
  const { data: existing, error: lookupError } = await client.from("practice_recordings").select().eq("id", id).eq("user_id", userId).maybeSingle();
  fail(lookupError);
  if (existing) {
    return existing;
  }
  const { error: uploadError } = await client.storage.from(BUCKET).upload(takePath, recording.audio, { contentType: "audio/wav", upsert: false });
  if (uploadError && String(uploadError.statusCode) !== "409" && uploadError.status !== 409) {
    fail(uploadError);
  }
  const { data, error } = await client.from("practice_recordings").upsert({
    id, user_id: userId, session_id: sessionId, take_path: takePath,
    reference_url: recording.referenceUrl, reference_start: Number(recording.referenceStart),
    reference_duration: Number(recording.referenceDuration), feedback: recording.feedback,
  }, { onConflict: "id" }).select().single();
  fail(error);
  return data;
}

export async function recordingPlayback(client, userId, path) {
  await requireOwner(client, userId);
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("This recording does not belong to your account.");
  }
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 600);
  fail(error);
  return data.signedUrl;
}
