export const BUCKET = "fiddle-practice";

export function fail(error) {
  if (error) {
    throw new Error("Your practice history could not be saved or loaded. Check your connection and try again.");
  }
}

export async function requireOwner(client, userId) {
  const { data, error } = await client.auth.getSession();
  if (error || !userId || data.session?.user.id !== userId) {
    throw new Error("Your account changed. Sign in again before saving this session.");
  }
}

export async function createPracticeSession(client, userId, file = null, score = null, id = crypto.randomUUID()) {
  await requireOwner(client, userId);
  const pdfPath = file ? `${userId}/${id}/score.pdf` : null;
  const session = {
    id, user_id: userId,
    title: file ? file.name.slice(0, 255) : "Recording comparison",
    filename: file?.name ?? null, page_count: score?.page_count ?? 0, pdf_path: pdfPath,
  };
  const { data, error } = await client.from("practice_sessions").upsert(session, { onConflict: "id" }).select().single();
  fail(error);
  if (file) {
    const { error: uploadError } = await client.storage.from(BUCKET).upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
    if (uploadError && String(uploadError.statusCode) !== "409" && uploadError.status !== 409) {
      // Clean up an incomplete session without masking the original save failure.
      await client.storage.from(BUCKET).remove([pdfPath]).catch(() => {});
      await client.from("practice_sessions").delete().eq("id", id).eq("user_id", userId);
      fail(uploadError);
    }
  }
  return data;
}

export async function savePracticePage(client, userId, sessionId, pageNumber, result) {
  await requireOwner(client, userId);
  const { error } = await client.from("practice_pages").upsert({
    session_id: sessionId, user_id: userId, page_number: pageNumber, result,
  }, { onConflict: "session_id,page_number" });
  fail(error);
}

export async function loadPracticeSession(client, userId, id) {
  await requireOwner(client, userId);
  const { data: session, error } = await client.from("practice_sessions").select().eq("id", id).eq("user_id", userId).maybeSingle();
  fail(error);
  if (!session) {
    throw new Error("This practice session was not found in your account.");
  }
  const [{ data: pages, error: pagesError }, { data: recordings, error: recordingsError }] = await Promise.all([
    client.from("practice_pages").select().eq("session_id", id).eq("user_id", userId).order("page_number"),
    client.from("practice_recordings").select().eq("session_id", id).eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  fail(pagesError || recordingsError);
  let file = null;
  if (session.pdf_path) {
    const { data, error: downloadError } = await client.storage.from(BUCKET).download(session.pdf_path);
    fail(downloadError);
    file = new File([data], session.filename || "score.pdf", { type: "application/pdf" });
  }
  return { session, file, pageResults: Object.fromEntries(pages.map((row) => [row.page_number, row.result])), recordings };
}

export async function listPracticeSessions(client, userId, offset = 0) {
  await requireOwner(client, userId);
  const { data, error } = await client.from("practice_sessions").select("id,title,page_count,created_at").eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(offset, offset + 19);
  fail(error);
  return data;
}
