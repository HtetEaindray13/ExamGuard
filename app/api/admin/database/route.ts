import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";
import { getAuthUser } from "../../../auth";
import { ensureDatabase, getDb } from "../../../../db";
import { exams, submissionReviews, submissions, users } from "../../../../db/schema";

type AdminEnv = { ADMIN_EMAIL?: string };

async function isAdmin() {
  const user = await getAuthUser();
  const adminEmail = (env as unknown as AdminEnv).ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(user && adminEmail && user.email.toLowerCase() === adminEmail);
}

function parsePayload(payload: string) {
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET() {
  if (!await isAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  await ensureDatabase();
  const db = getDb();
  const [examRows, submissionRows, userRows] = await Promise.all([
    db.select().from(exams),
    db.select().from(submissions),
    db.select().from(users),
  ]);

  return Response.json({
    exams: examRows.map((row) => {
      const data = parsePayload(row.payload);
      return { id: row.id, code: row.studentCode, title: String(data.title ?? "Untitled exam"), subject: String(data.subject ?? ""), createdAt: row.createdAt };
    }),
    submissions: submissionRows.map((row) => {
      const data = parsePayload(row.payload);
      return { id: row.id, examCode: row.examCode, studentId: row.studentId, name: String(data.name ?? "Student"), score: data.score ?? null, total: data.total ?? null, risk: String(data.risk ?? "Low"), createdAt: row.createdAt };
    }),
    users: userRows.map((row) => ({ id: row.id, displayName: row.displayName, email: row.email, role: row.role, createdAt: row.createdAt })),
  });
}

export async function PATCH(request: Request) {
  if (!await isAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const payload = await request.json() as { userId?: unknown; role?: unknown };
  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const role = payload.role === "student" || payload.role === "teacher" ? payload.role : null;
  if (!userId || !role) return Response.json({ error: "Choose a valid user and account role." }, { status: 400 });
  await ensureDatabase();
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return Response.json({ error: "User not found." }, { status: 404 });
  await db.update(users).set({ role, studentId: role === "teacher" ? null : undefined, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
  return Response.json({ updated: true, role });
}

export async function DELETE(request: Request) {
  if (!await isAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  await ensureDatabase();
  const payload = await request.json() as { table?: "exams" | "submissions"; id?: string };
  if (!payload.id || !payload.table) return Response.json({ error: "A table and record ID are required." }, { status: 400 });

  const db = getDb();
  if (payload.table === "submissions") {
    const [submission] = await db.select({ payload: submissions.payload }).from(submissions).where(eq(submissions.id, payload.id)).limit(1);
    const photoKey = submission ? parsePayload(submission.payload).photoKey : null;
    if (typeof photoKey === "string") await env.PHOTOS.delete(photoKey);
    await db.delete(submissionReviews).where(eq(submissionReviews.submissionId, payload.id));
    await db.delete(submissions).where(eq(submissions.id, payload.id));
  } else {
    const [exam] = await db.select({ code: exams.studentCode }).from(exams).where(eq(exams.id, payload.id)).limit(1);
    if (exam) {
      const linkedSubmissions = await db.select({ id: submissions.id, payload: submissions.payload }).from(submissions).where(eq(submissions.examCode, exam.code));
      const photoKeys = linkedSubmissions.map((item) => parsePayload(item.payload).photoKey).filter((key): key is string => typeof key === "string");
      if (photoKeys.length) await env.PHOTOS.delete(photoKeys);
      if (linkedSubmissions.length) await db.delete(submissionReviews).where(inArray(submissionReviews.submissionId, linkedSubmissions.map((item) => item.id)));
      await db.delete(submissions).where(eq(submissions.examCode, exam.code));
      await db.delete(exams).where(eq(exams.id, payload.id));
    }
  }
  return Response.json({ deleted: true });
}
