import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureDatabase, getDb } from "../../../../db";
import { exams, submissions } from "../../../../db/schema";

type AdminEnv = { ADMIN_EMAIL?: string };

async function isAdmin() {
  const user = await getChatGPTUser();
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
  const [examRows, submissionRows] = await Promise.all([
    db.select().from(exams),
    db.select().from(submissions),
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
  });
}

export async function DELETE(request: Request) {
  if (!await isAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  await ensureDatabase();
  const payload = await request.json() as { table?: "exams" | "submissions"; id?: string };
  if (!payload.id || !payload.table) return Response.json({ error: "A table and record ID are required." }, { status: 400 });

  const db = getDb();
  if (payload.table === "submissions") {
    await db.delete(submissions).where(eq(submissions.id, payload.id));
  } else {
    const [exam] = await db.select({ code: exams.studentCode }).from(exams).where(eq(exams.id, payload.id)).limit(1);
    if (exam) {
      await db.delete(submissions).where(eq(submissions.examCode, exam.code));
      await db.delete(exams).where(eq(exams.id, payload.id));
    }
  }
  return Response.json({ deleted: true });
}
