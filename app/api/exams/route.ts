import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { exams, submissions } from "../../../db/schema";

type StoredExam = { id: string; studentCode: string; teacherKey: string; createdAt: string } & Record<string, unknown>;

function publicExam(exam: StoredExam) {
  const { teacherKey: _teacherKey, ...safeExam } = exam;
  return safeExam;
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
    const exam = JSON.parse(row.payload) as StoredExam;

    if (!teacherKey) return Response.json({ exam: publicExam(exam) });
    if (row.teacherKey !== teacherKey) return Response.json({ error: "The teacher key is incorrect." }, { status: 403 });

    const submissionRows = await db.select().from(submissions).where(eq(submissions.examCode, code));
    return Response.json({ exam, submissions: submissionRows.map((item) => JSON.parse(item.payload)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database request failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const exam = await request.json() as StoredExam;
    if (!exam.id || !/^\d{6}$/.test(exam.studentCode) || !exam.teacherKey) {
      return Response.json({ error: "Invalid exam data." }, { status: 400 });
    }
    const db = getDb();
    const existing = await db.select({ id: exams.id }).from(exams).where(and(eq(exams.studentCode, exam.studentCode))).limit(1);
    if (existing.length) return Response.json({ error: "That exam code is already in use." }, { status: 409 });
    await db.insert(exams).values({ id: exam.id, studentCode: exam.studentCode, teacherKey: exam.teacherKey, payload: JSON.stringify(exam), createdAt: exam.createdAt });
    return Response.json({ exam: publicExam(exam) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not publish the exam." }, { status: 500 });
  }
}
