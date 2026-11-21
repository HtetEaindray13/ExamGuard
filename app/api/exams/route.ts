import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { getAuthUser } from "../../auth";
import { ensureDatabase, getDb } from "../../../db";
import { ensureUserProfile } from "../../../db/user-profile";
import { exams, submissionReviews, submissions } from "../../../db/schema";

type StoredExam = { id: string; studentCode: string; teacherKey: string; createdAt: string } & Record<string, unknown>;

function publicExam(exam: StoredExam) {
  const safeExam = { ...exam };
  Reflect.deleteProperty(safeExam, "teacherKey");
  return safeExam;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.replace(/\D/g, "") ?? "";
    const teacherKey = request.headers.get("x-teacher-key")?.trim() ?? "";
    if (code.length !== 6) return Response.json({ error: "A six-digit exam code is required." }, { status: 400 });

    const db = getDb();
    const [row] = await db.select().from(exams).where(eq(exams.studentCode, code)).limit(1);
    if (!row) return Response.json({ error: "Exam not found." }, { status: 404 });
    const exam = { ...JSON.parse(row.payload) as StoredExam, status: row.status };

    if (!teacherKey) {
      if (row.status !== "active") return Response.json({ error: row.status === "archived" ? "This exam has been archived." : "This exam is not accepting students yet." }, { status: 403 });
      return Response.json({ exam: publicExam(exam) });
    }
    const identity = await getAuthUser();
    if (!identity) return Response.json({ error: "Log in with a teacher account to manage this exam." }, { status: 401 });
    const profile = await ensureUserProfile(identity);
    if (profile.role !== "teacher") return Response.json({ error: "A teacher account is required to manage exams." }, { status: 403 });
    if (row.teacherKey !== teacherKey) return Response.json({ error: "The teacher key is incorrect." }, { status: 403 });
    if (row.teacherUserId && row.teacherUserId !== identity.userId) return Response.json({ error: "This exam belongs to another teacher account." }, { status: 403 });
    if (!row.teacherUserId) await db.update(exams).set({ teacherUserId: identity.userId }).where(eq(exams.id, row.id));

    const submissionRows = await db.select().from(submissions).where(eq(submissions.examCode, code));
    const reviewRows = submissionRows.length ? await db.select().from(submissionReviews).where(inArray(submissionReviews.submissionId, submissionRows.map((item) => item.id))) : [];
    const reviewBySubmission = new Map(reviewRows.map((review) => [review.submissionId, { decision: review.decision, feedback: review.feedback, manualScore: review.manualScore, reviewedAt: review.reviewedAt }]));
    const teacherSubmissions = await Promise.all(submissionRows.map(async (item) => {
      const submission = JSON.parse(item.payload) as Record<string, unknown> & { photoKey?: string };
      const submittedAt = item.createdAt.includes("T") ? item.createdAt : `${item.createdAt.replace(" ", "T")}Z`;
      const databaseSubmission = { ...submission, id: item.id, submitted: submittedAt, review: reviewBySubmission.get(item.id) };
      if (!submission.photoKey) return databaseSubmission;
      const photo = await env.PHOTOS.get(submission.photoKey);
      if (!photo) return databaseSubmission;
      return { ...databaseSubmission, photo: `data:${photo.httpMetadata?.contentType || "image/jpeg"};base64,${bytesToBase64(new Uint8Array(await photo.arrayBuffer()))}` };
    }));
    return Response.json({ exam, submissions: teacherSubmissions });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database request failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const identity = await getAuthUser();
    if (!identity) return Response.json({ error: "Log in with a teacher account to create an exam." }, { status: 401 });
    const profile = await ensureUserProfile(identity);
    if (profile.role !== "teacher") return Response.json({ error: "A teacher account is required to create exams." }, { status: 403 });
    const exam = await request.json() as StoredExam;
    if (!exam.id || !/^\d{6}$/.test(exam.studentCode) || !exam.teacherKey) {
      return Response.json({ error: "Invalid exam data." }, { status: 400 });
    }
    const db = getDb();
    const existing = await db.select({ id: exams.id }).from(exams).where(and(eq(exams.studentCode, exam.studentCode))).limit(1);
    if (existing.length) return Response.json({ error: "That exam code is already in use." }, { status: 409 });
    await db.insert(exams).values({ id: exam.id, studentCode: exam.studentCode, teacherKey: exam.teacherKey, teacherUserId: identity.userId, status: "active", payload: JSON.stringify({ ...exam, status: "active" }), createdAt: exam.createdAt });
    return Response.json({ exam: publicExam({ ...exam, status: "active" }) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not publish the exam." }, { status: 500 });
  }
}
