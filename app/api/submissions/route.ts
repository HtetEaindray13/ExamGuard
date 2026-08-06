import { env } from "cloudflare:workers";
import { ensureDatabase, getDb } from "../../../db";
import { submissions } from "../../../db/schema";

type Submission = { id: string; examCode?: string; studentId?: string; identityPhoto?: string } & Record<string, unknown>;

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const submission = await request.json() as Submission;
    const examCode = submission.examCode?.replace(/\D/g, "") ?? "";
    const studentId = submission.studentId?.trim() ?? "";
    if (!submission.id || examCode.length !== 6 || !studentId) {
      return Response.json({ error: "Invalid submission data." }, { status: 400 });
    }
    const recordId = `${submission.id}-${Date.now()}`;
    let photoKey: string | undefined;
    if (submission.identityPhoto) {
      const match = submission.identityPhoto.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
      if (!match || match[1].length > 700_000) return Response.json({ error: "Invalid identity photo." }, { status: 400 });
      const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
      photoKey = `identity/${examCode}/${recordId}.jpg`;
      await env.PHOTOS.put(photoKey, bytes, { httpMetadata: { contentType: "image/jpeg" } });
    }
    const { identityPhoto: _identityPhoto, ...storedSubmission } = submission;
    const db = getDb();
    await db.insert(submissions).values({
      id: recordId,
      examCode,
      studentId,
      payload: JSON.stringify({ ...storedSubmission, photoKey }),
    });
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the submission." }, { status: 500 });
  }
}
