import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getAuthUser } from "../../auth";
import { ensureDatabase, getDb } from "../../../db";
import { ensureUserProfile } from "../../../db/user-profile";
import { exams, submissions } from "../../../db/schema";

type Submission = { id: string; examCode?: string; studentId?: string; identityPhoto?: string } & Record<string, unknown>;

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const identity = await getAuthUser();
    if (!identity) return Response.json({ error: "Log in with a student account before submitting an exam." }, { status: 401 });
    const profile = await ensureUserProfile(identity);
    if (profile.role !== "student") return Response.json({ error: "A student account is required to submit an exam." }, { status: 403 });
    const submission = await request.json() as Submission;
    const examCode = submission.examCode?.replace(/\D/g, "") ?? "";
    const studentId = submission.studentId?.trim() ?? "";
    if (!submission.id || examCode.length !== 6 || !studentId) {
      return Response.json({ error: "Invalid submission data." }, { status: 400 });
    }
    const db = getDb();
    const [exam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.studentCode, examCode)).limit(1);
    if (!exam) return Response.json({ error: "Exam not found." }, { status: 404 });
    const recordId = `${submission.id}-${Date.now()}`;
    let photoKey: string | undefined;
    if (submission.identityPhoto) {
      const match = submission.identityPhoto.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
      if (!match || match[1].length > 700_000) return Response.json({ error: "Invalid identity photo." }, { status: 400 });
      const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
      photoKey = `identity/${examCode}/${recordId}.jpg`;
      await env.PHOTOS.put(photoKey, bytes, { httpMetadata: { contentType: "image/jpeg" } });
    }
    const storedSubmission = { ...submission };
    Reflect.deleteProperty(storedSubmission, "identityPhoto");
    await db.insert(submissions).values({
      id: recordId,
      examCode,
      studentId,
      studentUserId: identity.userId,
      payload: JSON.stringify({ ...storedSubmission, photoKey }),
    });
    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the submission." }, { status: 500 });
  }
}
